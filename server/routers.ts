import crypto from 'crypto';
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure } from "./_core/trpc";
import {
  saveUserProfile, getUsersByGender, getMessages, saveMessage,
  upsertUser, getUserByOpenId, getRecentUsers, incrementProfileViews,
  getUserCredits, deductCredits, addCredits, saveGift, upgradeToPremium,
  getCountryStats, getNewRegistrations, getTotalUsersCount, getOnlineUsersCount, getPremiumCount, searchUsers, broadcastNotificationToAll,
  createFriendRequest, acceptFriendRequest, getFriends, getIncomingFriendRequests,
  getUserPublicProfile, getFriendStatus,
  createNotification, getNotifications, markNotificationsAsRead,
  getUnreadMessageCount, markMessagesRead, updateUserPresence,
  getDb,
} from "./db";
import { eq, sql } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { detectCountry } from "./_core/detectCountry";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { transcribeAudio } from "./_core/voiceTranscription";
import { makeRequest } from "./_core/map";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";

const aiMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(20_000),
});

// ── Admin HMAC token verification (no session required) ─────────────────
function verifyAdminHmac(token: string, secret: string): boolean {
  if (!token || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update('admin-session').digest('hex');
  return token === expected;
}

export const appRouter = router({
  system: systemRouter,

  ai: router({
    chat: protectedProcedure
      .input(z.object({
        messages: z.array(aiMessageSchema).min(1).max(100),
        model: z.string().min(1).max(100).optional(),
        maxTokens: z.number().int().min(1).max(4_000).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const systemPrompt = {
            role: "system" as const,
            content: "أنت المساعد الذكي الرسمي لمنصة ConnectLive. أنت خبير، ودود، ومحترف. تساعد المستخدمين في الدردشة، توليد الصور، والخرائط. أجب دائماً باللغة العربية بأسلوب راقٍ ومفيد."
          };

          const messages = input.messages.some(m => m.role === "system")
            ? input.messages
            : [systemPrompt, ...input.messages];

          const result = await invokeLLM({
            messages,
            model: input.model,
            maxTokens: input.maxTokens ?? 500,
          });
          const content = result.choices[0]?.message?.content;
          const text = typeof content === "string"
            ? content
            : Array.isArray(content)
              ? content.filter(part => part.type === "text").map(part => part.text).join("\n")
              : "";

          if (!text) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "لم تُرجع خدمة الذكاء الاصطناعي نصاً صالحاً.",
            });
          }
          return { text };
        } catch (error: any) {
          console.error("[AI Chat Error]", error);
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: `فشل الاتصال بالذكاء الاصطناعي: ${error.message || "خطأ غير معروف"}`,
          });
        }
      }),

    generateImage: protectedProcedure
      .input(z.object({
        prompt: z.string().trim().min(3).max(2_000),
        model: z.string().trim().min(1).max(100).optional(),
        quality: z.enum(["low", "medium", "high"]).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await generateImage(input);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: error instanceof Error ? error.message : "تعذر توليد الصورة.",
          });
        }
      }),

    transcribe: protectedProcedure
      .input(z.object({
        audioBase64: z.string().min(20).max(24_000_000),
        mimeType: z.string().regex(/^audio\//).max(100),
        language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).optional(),
        prompt: z.string().trim().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const audio = Buffer.from(input.audioBase64, "base64");
          if (!audio.length) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "ملف الصوت فارغ.",
            });
          }

          let result;
          // If Forge keys are missing, we can't use storagePut. 
          // We need to modify transcribeAudio to accept a buffer or handle it here.
          if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
             result = await transcribeAudio({
                audioBuffer: audio,
                mimeType: input.mimeType,
                language: input.language,
                prompt: input.prompt,
             } as any);
          } else {
            const uploaded = await storagePut(
              `voice/${ctx.user.id}-${Date.now()}.${input.mimeType.split("/")[1] || "audio"}`,
              audio,
              input.mimeType,
            );
            const origin = `${ctx.req.protocol}://${ctx.req.get("host")}`;
            result = await transcribeAudio({
              audioUrl: new URL(uploaded.url, origin).toString(),
              language: input.language,
              prompt: input.prompt,
            });
          }

          if ("error" in result) {
            throw new TRPCError({
              code: "BAD_GATEWAY",
              message: result.error,
              cause: result.details,
            });
          }
          return result;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: error instanceof Error ? error.message : "تعذر تحويل الصوت إلى نص.",
          });
        }
      }),
  }),

  maps: router({
    geocode: publicProcedure
      .input(z.object({
        address: z.string().trim().min(2).max(300),
        language: z.string().regex(/^[a-z]{2}$/).optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await makeRequest("/maps/api/geocode/json", {
            address: input.address,
            language: input.language,
          });
        } catch (error) {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: error instanceof Error ? error.message : "تعذر البحث عن الموقع.",
          });
        }
      }),

    directions: publicProcedure
      .input(z.object({
        origin: z.string().trim().min(2).max(300),
        destination: z.string().trim().min(2).max(300),
        mode: z.enum(["driving", "walking", "bicycling", "transit"]).optional(),
        language: z.string().regex(/^[a-z]{2}$/).optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await makeRequest("/maps/api/directions/json", {
            origin: input.origin,
            destination: input.destination,
            mode: input.mode,
            language: input.language,
          });
        } catch (error) {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: error instanceof Error ? error.message : "تعذر حساب الطريق.",
          });
        }
      }),
  }),

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    /** Detect and save country — accepts client-detected country or falls back to IP */
    updateCountry: protectedProcedure
      .input(z.object({ country: z.string().length(2).optional() }).optional())
      .mutation(async ({ ctx, input }) => {
        // Prefer client-side browser country (always accurate), fall back to IP
        const country = input?.country?.toUpperCase() || await detectCountry(ctx.req);
        if (country && ctx.user) {
          await upsertUser({ openId: ctx.user.openId, country });
        }
        return { country };
      }),

    /**
     * Save a signed, long-lived recovery session for an existing guest.
     * The client stores this token on the same device so logout only ends the
     * active session and does not abandon the guest's database account.
     */
    rememberGuest: protectedProcedure.mutation(async ({ ctx }) => {
      if (
        ctx.user.loginMethod !== "guest" ||
        !ctx.user.openId.startsWith("guest_")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only guest accounts can be remembered on this device",
        });
      }

      const guestToken = await sdk.createSessionToken(ctx.user.openId, {
        name: ctx.user.name || "زائر",
        expiresInMs: ONE_YEAR_MS,
      });

      return { success: true, guestToken };
    }),
  }),

  users: router({
    guestLogin: publicProcedure
      .input(z.object({
        name: z.string().min(1, "الاسم مطلوب"),
        age: z.number().min(13).max(100),
        gender: z.enum(['male', 'female', 'other']),
        avatar: z.string().optional(),
        country: z.string().length(2).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // If the request already carries a valid guest session (the
        // persistent device token), continue using that account. Otherwise
        // create a new guest identity.
        const existingGuestOpenId =
          ctx.user?.loginMethod === "guest" &&
          ctx.user.openId.startsWith("guest_")
            ? ctx.user.openId
            : null;
        const guestOpenId = existingGuestOpenId ?? `guest_${nanoid()}`;
        // 🔒 FIX: Validate avatar URL — block SSRF via private/internal addresses
        const _defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(input.name)}`;
        const avatarUrl = (() => {
          if (!input.avatar) return _defaultAvatar;
          try {
            const u = new URL(input.avatar);
            if (u.protocol !== 'https:') return _defaultAvatar;
            if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|::1)/i.test(u.hostname)) return _defaultAvatar;
            return input.avatar;
          } catch { return _defaultAvatar; }
        })();

        // Use client-provided browser country first (always accurate), then IP fallback
        const country = input.country?.toUpperCase() || await detectCountry(ctx.req);

        try {
          await upsertUser({ openId: guestOpenId, name: input.name, loginMethod: 'guest', lastSignedIn: new Date(), ...(country ? { country } : {}) });
          const user = await getUserByOpenId(guestOpenId);
          if (user) {
            await saveUserProfile(user.id, { name: input.name, age: input.age, gender: input.gender, avatar: avatarUrl });
          }
        } catch (dbErr) {
          console.warn('[GuestLogin] DB unavailable, continuing with JWT-only session:', dbErr);
        }

        const sessionToken = await sdk.createSessionToken(guestOpenId, { name: input.name, expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        // The guest token is intentionally returned so the browser can keep
        // the same guest identity after logout. It contains no profile data;
        // it is only a signed session credential and is never logged.
        return { success: true, guestToken: sessionToken };
      }),

    saveProfile: protectedProcedure
      .input(z.object({
        // 🔒 FIX: Max lengths to prevent oversized payloads
        name: z.string().max(100).optional(),
        age: z.number().min(13).max(120).optional(),
        gender: z.enum(['male', 'female', 'other']).optional(),
        avatar: z.string().url().max(512).optional(),
        bio: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await saveUserProfile(ctx.user.id, input);
        return { success: true };
      }),

    getByGender: publicProcedure
      .input(z.enum(['male', 'female', 'other']))
      .query(async ({ input }) => getUsersByGender(input)),

    getRecent: publicProcedure
      .input(z.number().min(1).max(50).optional())
      .query(async ({ input }) => getRecentUsers(input ?? 20)),

    countryStats: publicProcedure
      .query(async () => getCountryStats()),

    recordView: publicProcedure
      .input(z.number())
      .mutation(async ({ input }) => {
        const views = await incrementProfileViews(input);
        return { views };
      }),

    getPublicProfile: publicProcedure
      .input(z.number().min(1))
      .query(async ({ input }) => {
        const profile = await getUserPublicProfile(input);
        return profile;
      }),

    claimDailyBonus: protectedProcedure
      .mutation(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Load user row
        const rows = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        if (!rows[0]) throw new Error("User not found");
        const userRow = rows[0];

        // Check if already claimed today via notification log
        const notifs = await getNotifications(ctx.user.id);
        const alreadyClaimed = notifs.some(n =>
          n.type === 'system' &&
          n.title === 'مكافأة يومية 🎁' &&
          (Date.now() - new Date(n.createdAt).getTime()) < 24 * 60 * 60 * 1000
        );
        if (alreadyClaimed) throw new Error("لقد استلمت مكافأتك اليومية بالفعل!");

        // Grant bonus
        await db.update(users)
          .set({
            credits:      sql`${users.credits} + 10`,
            wallet:       sql`${users.wallet}  + 5`,
            lastSignedIn: new Date(),
          })
          .where(eq(users.id, ctx.user.id));

        await createNotification(ctx.user.id, {
          type:    'system',
          title:   'مكافأة يومية 🎁',
          message: 'لقد حصلت على 10 نقاط و 5 نجوم مجانية لزيارتك اليوم! استخدم النجوم في الرادار الآن.',
        });

        return { success: true, starsGained: 5, creditsGained: 10 };
      }),

    /** Presence ping — updates lastSignedIn and isOnline so admin stats are accurate */
    ping: protectedProcedure
      .mutation(async ({ ctx }) => {
        await updateUserPresence(ctx.user.id);
        return { success: true };
      }),
  }),

  messages: router({
    save: protectedProcedure
      // 🔒 FIX: Limit message length to prevent spam/DoS
      .input(z.object({ receiverId: z.number(), content: z.string().min(1).max(2000) }))
      .mutation(async ({ ctx, input }) => {
        await saveMessage(ctx.user.id, input.receiverId, input.content);
        return { success: true };
      }),

    getMessages: protectedProcedure
      .input(z.number())
      .query(async ({ ctx, input }) => getMessages(ctx.user.id, input)),

    getUnreadCount: protectedProcedure
      .query(async ({ ctx }) => {
        const count = await getUnreadMessageCount(ctx.user.id);
        return { count };
      }),

    markRead: protectedProcedure
      .input(z.object({ senderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await markMessagesRead(ctx.user.id, input.senderId);
        return { success: true };
      }),
  }),

  gifts: router({
    /** Return the authenticated user's credit balance */
    getBalance: protectedProcedure.query(async ({ ctx }) => {
      const credits = await getUserCredits(ctx.user.id);
      return { credits };
    }),

    /** Submit manual payment request  admin approves from dashboard */
    submitPaymentRequest: protectedProcedure
      .input(z.object({
        // = FIX: All fields strictly validated
        method: z.enum(['binance_pay', 'usdt_trc20']),
        transactionId: z.string().min(5).max(200).trim(),
        itemType: z.enum(['vip', 'stars']),
        itemAmount: z.number().optional(),
        // amount is whitelisted  user cannot forge an arbitrary price
        amount: z.enum(['$0.99', '$2.49', '$6.99']),
      }))
      .mutation(async ({ ctx, input }) => {
        // = FIX: Validate itemAmount matches the claimed price for star packages
        if (input.itemType === 'stars') {
          const STAR_PRICES: Record<number, string> = {
            5000:  '$0.99',
            15000: '$2.49',
            50000: '$6.99',
          };
          const expected = input.itemAmount ? STAR_PRICES[input.itemAmount] : undefined;
          if (!expected || expected !== input.amount) {
            throw new Error("سعر باقة النجوم غير صالح.");
          }
        }

        const { createPaymentRequest } = await import("./db");
        await createPaymentRequest({
          userId: ctx.user.id,
          amount: input.amount,
          method: input.method,
          transactionId: input.transactionId,
          itemType: input.itemType,
          itemAmount: input.itemAmount,
        });
        await createNotification(ctx.user.id, {
          type: 'system',
          title: 'تم استلام طلب الدفع',
          message: 'سنراجع طلب الدفع ونحدّث حالته بعد التحقق من العملية.',
        });
        return { success: true };
      }),

    /** Get pending payment requests (Admin only) */
    getPendingPayments: adminProcedure.query(async () => {
      const { getPendingPaymentRequests } = await import("./db");
      return await getPendingPaymentRequests();
    }),

    /** Approve or reject a payment request (Admin only) */
    handlePaymentRequest: adminProcedure
      .input(z.object({
        requestId: z.number(),
        status: z.enum(['approved', 'rejected'])
      }))
      .mutation(async ({ input }) => {
        const { updatePaymentRequestStatus } = await import("./db");
        await updatePaymentRequestStatus(input.requestId, input.status);
        return { success: true };
      }),

    /** Revoke VIP from a user (Admin only) */
    revokeVip: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.update(users).set({ isPremium: false }).where(eq(users.id, input.userId));
        return { success: true };
      }),

    /** Reset all non-admin VIPs (Admin only) */
    resetAllVips: adminProcedure
      .mutation(async () => {
        const { getDb } = await import("./db");
        const { users } = await import("../drizzle/schema");
        const { and, eq, ne } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.update(users).set({ isPremium: false }).where(and(eq(users.isPremium, true), ne(users.role, 'admin')));
        return { success: true };
      }),

    /** Deduct credits and record the gift (relay to peer via signal is done client-side) */
    spend: protectedProcedure
      .input(z.object({
        giftType: z.string(),
        cost: z.number().min(1).max(1000),
        receiverId: z.number().optional(),
        receiverName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = (ctx.user as any).role === 'admin';
        if (!isAdmin) {
          const current = await getUserCredits(ctx.user.id);
          if (current < input.cost) throw new Error('رصيدك غير كافٍ لإرسال هذه الهدية');
        }
        
        const receiverId = input.receiverId || 0;
        await saveGift(ctx.user.id, receiverId, input.giftType, input.cost);
        
        if (receiverId > 0) {
          await createNotification(receiverId, {
            type: 'gift',
            fromName: ctx.user.name || 'مستخدم',
            fromAvatar: ctx.user.avatar || '',
            message: `أرسل لك هدية: ${input.giftType}`,
          });
        }
        
        const newBalance = await getUserCredits(ctx.user.id);
        return { success: true, newBalance };
      }),

    getWallet: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { wallet: 0 };
      const result = await db.select({ wallet: users.wallet }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      return { wallet: result[0]?.wallet ?? 0 };
    }),

    convertStars: protectedProcedure
      .input(z.object({ amount: z.number().min(10) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const user = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        if (!user[0] || user[0].wallet < input.amount) {
          throw new Error("رصيد نجوم غير كافٍ للتحويل");
        }
        
        // Conversion rate: 2 stars = 1 credit
        const creditsToGain = Math.floor(input.amount / 2);
        
        await db.transaction(async (tx) => {
          await tx.update(users)
            .set({ 
              wallet: sql`${users.wallet} - ${input.amount}`,
              credits: sql`${users.credits} + ${creditsToGain}`
            })
            .where(eq(users.id, ctx.user.id));
        });
        
        return { success: true, creditsGained: creditsToGain };
      }),

    /** Grant credits — ADMIN ONLY. Prevents free credit generation by regular users */
    buyCredits: adminProcedure
      .input(z.number().min(1).max(100000))
      .mutation(async ({ ctx, input }) => {
        // 🔒 FIX: Was publicly callable — now restricted to admins only
        await addCredits(ctx.user.id, input);
        const newBalance = await getUserCredits(ctx.user.id);
        return { success: true, newBalance };
      }),

    /** Upgrade user to premium (free/admin) */
    upgrade: protectedProcedure
      .mutation(async ({ ctx }) => {
        await upgradeToPremium(ctx.user.id);
        return { success: true };
      }),

    /** Upgrade to Premium by spending 50000 credits */
    upgradeWithCredits: protectedProcedure
      .mutation(async ({ ctx }) => {
        if ((ctx.user as any).isPremium) throw new Error("أنت مشترك بالفعل في Premium!");
        const COST = 50000;
        const balance = await getUserCredits(ctx.user.id);
        if (balance < COST) throw new Error(`رصيدك ${balance} نقطة فقط. تحتاج ${COST} نقطة للاشتراك.`);
        const ok = await deductCredits(ctx.user.id, COST);
        if (!ok) throw new Error("فشل خصم النقاط، حاول مجدداً.");
        await upgradeToPremium(ctx.user.id);
        await createNotification(ctx.user.id, {
          type: 'system',
          title: '🎉 مرحباً بك في Premium!',
          message: `تم اشتراكك بـ ${COST} نقطة. استمتع بجميع الميزات الحصرية!`,
        });
        return { success: true };
      }),

    /** Deduct stars for using Star Radar (paid filter — skipped for admin) */
    deductRadarStars: protectedProcedure
      .input(z.object({ amount: z.number().min(1).max(50) }))
      .mutation(async ({ ctx, input }) => {
        if ((ctx.user as any).role === 'admin') return { success: true };
        const { deductStars } = await import("./db");
        const success = await deductStars(ctx.user.id, input.amount);
        if (!success) throw new Error("رصيد نجوم غير كافٍ لاستخدام الرادار");
        return { success: true };
      }),
  }),

  admin: router({
    newRegistrations: publicProcedure
      .input(z.object({ adminToken: z.string(), limit: z.number().min(1).max(200).optional() }))
      .query(async ({ input }) => {
        const { ENV } = await import('./_core/env');
        if (!verifyAdminHmac(input.adminToken, ENV.adminSecret)) throw new TRPCError({ code: 'FORBIDDEN' });
        return getNewRegistrations(input.limit ?? 100);
      }),

    countryStats: publicProcedure
      .input(z.object({ adminToken: z.string() }))
      .query(async ({ input }) => {
        const { ENV } = await import('./_core/env');
        if (!verifyAdminHmac(input.adminToken, ENV.adminSecret)) throw new TRPCError({ code: 'FORBIDDEN' });
        return getCountryStats();
      }),

    totalCount: publicProcedure
      .input(z.object({ adminToken: z.string() }))
      .query(async ({ input }) => {
        const { ENV } = await import('./_core/env');
        if (!verifyAdminHmac(input.adminToken, ENV.adminSecret)) throw new TRPCError({ code: 'FORBIDDEN' });
        return getTotalUsersCount();
      }),

    onlineCount: publicProcedure
      .input(z.object({ adminToken: z.string() }))
      .query(async ({ input }) => {
        const { ENV } = await import('./_core/env');
        if (!verifyAdminHmac(input.adminToken, ENV.adminSecret)) throw new TRPCError({ code: 'FORBIDDEN' });
        return getOnlineUsersCount();
      }),

    premiumCount: publicProcedure
      .input(z.object({ adminToken: z.string() }))
      .query(async ({ input }) => {
        const { ENV } = await import('./_core/env');
        if (!verifyAdminHmac(input.adminToken, ENV.adminSecret)) throw new TRPCError({ code: 'FORBIDDEN' });
        return getPremiumCount();
      }),

    searchUsers: publicProcedure
      .input(z.object({ adminToken: z.string(), query: z.string().min(1).max(100) }))
      .query(async ({ input }) => {
        const { ENV } = await import('./_core/env');
        if (!verifyAdminHmac(input.adminToken, ENV.adminSecret)) throw new TRPCError({ code: 'FORBIDDEN' });
        return searchUsers(input.query);
      }),

    /** DB health check — returns connection status and row counts */
    dbStatus: publicProcedure
      .input(z.object({ adminToken: z.string() }))
      .query(async ({ input }) => {
        const { ENV } = await import('./_core/env');
        if (!verifyAdminHmac(input.adminToken, ENV.adminSecret)) throw new TRPCError({ code: 'FORBIDDEN' });
        const db = await getDb();
        if (!db) {
          return { connected: false, totalUsers: 0, reason: 'DATABASE_URL غير مضبوط أو الاتصال فشل' };
        }
        try {
          // Fetch multiple stats in a single query to reduce latency
          const [totalResult, premiumResult, onlineResult] = await Promise.all([
            db.select({ count: sql<number>`cast(count(*) as int)` }).from(users),
            db.select({ count: sql<number>`cast(count(*) as int)` }).from(users).where(eq(users.isPremium, true)),
            db.select({ count: sql<number>`cast(count(*) as int)` }).from(users).where(sql`${users.lastSignedIn} > ${new Date(Date.now() - 5 * 60 * 1000)}`),
          ]);
          return {
            connected: true,
            totalUsers: totalResult[0]?.count ?? 0,
            premiumUsers: premiumResult[0]?.count ?? 0,
            onlineUsers: onlineResult[0]?.count ?? 0,
            reason: null,
          };
        } catch (err: any) {
          const reason = err?.cause?.message ?? err?.message ?? String(err);
          return { connected: false, totalUsers: 0, reason: String(reason) };
        }
      }),

        broadcast: publicProcedure
      .input(z.object({ adminToken: z.string(), title: z.string().min(1).max(200), message: z.string().min(1).max(1000) }))
      .mutation(async ({ input }) => {
        const { ENV } = await import('./_core/env');
        if (!verifyAdminHmac(input.adminToken, ENV.adminSecret)) throw new TRPCError({ code: 'FORBIDDEN' });
        const count = await broadcastNotificationToAll(input.title, input.message);
        return { success: true, count };
      }),

    /**
     * Public endpoint — verify admin password without needing a user session.
     * Returns a signed token the client stores in sessionStorage.
     */
    verifySecret: publicProcedure
      .input(z.object({ secret: z.string() }))
      .mutation(async ({ input }) => {
        const { ENV } = await import('./_core/env');
        if (input.secret !== ENV.adminSecret) {
          throw new Error("كلمة المرور خاطئة");
        }
        const hmacToken = crypto
          .createHmac('sha256', ENV.adminSecret)
          .update('admin-session')
          .digest('hex');
        return { verified: true, token: hmacToken };
      }),

    /** If the caller is logged in, also promote them to admin in the DB */
    activate: protectedProcedure
      .input(z.object({ secret: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { ENV } = await import('./_core/env');
        if (input.secret !== ENV.adminSecret) {
          throw new Error("الكود غير صحيح");
        }
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        await db.update(users)
          .set({
            role: 'admin',
            isPremium: true,
            credits: 999999,
            wallet: 999999,
          })
          .where(eq(users.id, ctx.user.id));
        return { success: true };
      }),
  }),

  social: router({
    sendRequest: protectedProcedure
      .input(z.object({ receiverId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.id <= 0) throw new Error("يجب تسجيل الدخول لإضافة أصدقاء");
        await createFriendRequest(ctx.user.id, input.receiverId);
        await createNotification(input.receiverId, {
          type: 'friend-request',
          fromName: ctx.user.name || 'مستخدم',
          fromAvatar: ctx.user.avatar || '',
          message: 'أرسل لك طلب صداقة جديد',
        });
        return { success: true };
      }),

    acceptRequest: protectedProcedure
      .input(z.object({ senderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.id <= 0) throw new Error("يجب تسجيل الدخول لقبول الصداقة");
        await acceptFriendRequest(input.senderId, ctx.user.id);
        await createNotification(input.senderId, {
          type: 'friend-accepted',
          fromName: ctx.user.name || 'مستخدم',
          fromAvatar: ctx.user.avatar || '',
          message: 'قبل طلب صداقتك',
        });
        return { success: true };
      }),

    getFriends: protectedProcedure
      .query(async ({ ctx }) => getFriends(ctx.user.id)),

    getIncomingRequests: protectedProcedure
      .query(async ({ ctx }) => getIncomingFriendRequests(ctx.user.id)),

    getFriendStatus: protectedProcedure
      .input(z.number().min(1))
      .query(async ({ ctx, input }) => {
        const status = await getFriendStatus(ctx.user.id, input);
        return { status };
      }),
  }),

  notifications: router({
    get: protectedProcedure
      .query(async ({ ctx }) => getNotifications(ctx.user.id)),

    markAsRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        await markNotificationsAsRead(ctx.user.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;

