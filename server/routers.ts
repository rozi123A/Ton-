import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure } from "./_core/trpc";
import {
  saveUserProfile, getUsersByGender, getMessages, saveMessage,
  upsertUser, getUserByOpenId, getRecentUsers, incrementProfileViews,
  getUserCredits, deductCredits, addCredits, saveGift, upgradeToPremium,
  getCountryStats, getNewRegistrations,
  createFriendRequest, acceptFriendRequest, getFriends, getIncomingFriendRequests,
  createNotification, getNotifications, markNotificationsAsRead,
  getUnreadMessageCount, markMessagesRead,
  getDb,
} from "./db";
import { eq, sql } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { detectCountry } from "./_core/detectCountry";
import { nanoid } from "nanoid";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,

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
        const guestOpenId = `guest_${nanoid()}`;
        const avatarUrl = input.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(input.name)}`;

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
        return { success: true, token: sessionToken };
      }),

    saveProfile: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        age: z.number().optional(),
        gender: z.enum(['male', 'female', 'other']).optional(),
        avatar: z.string().optional(),
        bio: z.string().optional(),
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
          new Date(n.createdAt).toDateString() === new Date().toDateString()
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
  }),

  messages: router({
    save: protectedProcedure
      .input(z.object({ receiverId: z.number(), content: z.string() }))
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

    /** Deduct credits and record the gift (relay to peer via signal is done client-side) */
    spend: protectedProcedure
      .input(z.object({
        giftType: z.string(),
        cost: z.number().min(1).max(1000),
        receiverId: z.number().optional(),
        receiverName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const current = await getUserCredits(ctx.user.id);
        if (current < input.cost) throw new Error('رصيدك غير كافٍ لإرسال هذه الهدية');
        
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

    /** Simulate purchasing credits (Stripe coming soon) */
    buyCredits: protectedProcedure
      .input(z.number().min(1).max(10000))
      .mutation(async ({ ctx, input }) => {
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

    /** Upgrade to Premium by spending 500 credits */
    upgradeWithCredits: protectedProcedure
      .mutation(async ({ ctx }) => {
        if ((ctx.user as any).isPremium) throw new Error("أنت مشترك بالفعل في Premium!");
        const COST = 500;
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

    /** Deduct stars for using Star Radar (paid filter) */
    deductRadarStars: protectedProcedure
      .input(z.object({ amount: z.number().min(1).max(50) }))
      .mutation(async ({ ctx, input }) => {
        const { deductStars } = await import("./db");
        const success = await deductStars(ctx.user.id, input.amount);
        if (!success) throw new Error("رصيد نجوم غير كافٍ لاستخدام الرادار");
        return { success: true };
      }),
  }),

  admin: router({
    newRegistrations: adminProcedure
      .input(z.number().min(1).max(200).optional())
      .query(async ({ input }) => getNewRegistrations(input ?? 50)),

    countryStats: adminProcedure
      .query(async () => getCountryStats()),
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
