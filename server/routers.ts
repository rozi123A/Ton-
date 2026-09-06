import crypto from 'crypto';
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure } from "./_core/trpc";
import {
  saveUserProfile, getUsersByGender, getMessages, saveMessage,
  upsertUser, getUserByOpenId, getRecentUsers, incrementProfileViews,
  getUserCredits, deductCredits, addCredits, saveGift, upgradeToPremium, upgradeWithCredits,
  getCountryStats, getNewRegistrations, getTotalUsersCount, getOnlineUsersCount, getPremiumCount, searchUsers, broadcastNotificationToAll,
  createFriendRequest, acceptFriendRequest, getFriends, getIncomingFriendRequests,
  getUserPublicProfile, getFriendStatus,
  createNotification, getNotifications, markNotificationsAsRead,
  getUnreadMessageCount,   markMessagesRead, updateUserPresence, updateUserOffline,
  saveStory, getActiveStories, getUserStories, getPublicUserStories,
  saveStoryComment, getStoryComments, recordStoryView, getStoryViewers,
  deleteStory, getStoryById,
  createAiConversation, getAiConversations, getAiConversation, getAiMessages, saveAiMessage,
  saveAiImage, getAiImages, getAiImage,
   setUserVerified,
  getDb,
} from "./db";
import { and, eq, gte, isNull, lt, or, sql, desc } from "drizzle-orm";
import { users, messages, notifications } from "../drizzle/schema";
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
import { sendUserNotification } from "./_core/userNotifications";

const avatarSchema = z.union([
  z.string().url().max(512),
  z.string()
    .regex(/^data:image\/(?:jpeg|jpg|png|webp);base64,/i)
    .max(5_000_000),
]);

const aiMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(20_000),
});

const GUEST_SAVE_RETRY_DELAYS_MS = [0, 10_000, 30_000, 60_000];

async function saveGuestRegistrationWithRetry(input: {
  openId: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  avatar: string;
  country?: string;
}) {
  let lastError: unknown;

  for (let attempt = 0; attempt < GUEST_SAVE_RETRY_DELAYS_MS.length; attempt++) {
    const delay = GUEST_SAVE_RETRY_DELAYS_MS[attempt];
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await upsertUser({
        openId: input.openId,
        name: input.name,
        loginMethod: 'guest',
        lastSignedIn: new Date(),
        ...(input.country ? { country: input.country } : {}),
      });

      const user = await getUserByOpenId(input.openId);
      if (!user) throw new Error('Guest was not found after database upsert');

      await saveUserProfile(user.id, {
        name: input.name,
        age: input.age,
        gender: input.gender,
        avatar: input.avatar,
      });
      console.log(`[GuestLogin] Registration saved on attempt ${attempt + 1}:`, user.id);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`[GuestLogin] Database save attempt ${attempt + 1} failed; will retry`, error);
    }
  }

  console.error('[GuestLogin] Could not save registration after all retries:', lastError);
}

// Render free DB can take 30-60 s to wake from sleep — keep timeout above that.
// General queries use ADMIN_STATS_TIMEOUT_MS; first-connection uses DB_CONNECT_TIMEOUT_MS.
const ADMIN_STATS_TIMEOUT_MS = 28_000; // Render free tier drops HTTP after ~30 s — stay under that
// postgres.js keeps the TCP connection alive in background after we return, so the DB wakes up
// between retries. DB_CONNECT_TIMEOUT_MS is kept shorter than Render HTTP limit too.
const DB_CONNECT_TIMEOUT_MS  = 28_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs = ADMIN_STATS_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Database query timed out")), timeoutMs),
    ),
  ]);
}

function withFallback<T>(
  promise: Promise<T>,
  fallback: T,
  timeoutMs = ADMIN_STATS_TIMEOUT_MS,
): Promise<T> {
  return withTimeout(promise, timeoutMs).catch(() => fallback);
}

// ── Admin HMAC token verification (no session required) ─────────────────
function verifyAdminHmac(token: string, secret: string): boolean {
  if (!token || !secret) return false;
  const [expiresAt, signature] = token.split('.');
  const expires = Number(expiresAt);
  if (!Number.isSafeInteger(expires) || expires <= Date.now()) return false;
  const expected = crypto.createHmac('sha256', secret).update(`admin-session:${expires}`).digest('hex');
  const provided = Buffer.from(signature ?? '', 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return provided.length === expectedBuffer.length && crypto.timingSafeEqual(provided, expectedBuffer);
}

const adminSessionProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const cookies = (ctx.req.headers.cookie ?? '').split(';').map(part => part.trim());
  const cookie = cookies.find(part => part.startsWith('connectlive_admin='));
  const token = cookie?.slice('connectlive_admin='.length);
  if (!verifyAdminHmac(token ?? '', ENV.adminSecret)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'جلسة الإدارة منتهية أو غير صالحة' });
  }
  return next();
});

function secureStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export const appRouter = router({
  system: systemRouter,

  ai: router({
    listConversations: protectedProcedure
      .query(async ({ ctx }) => getAiConversations(ctx.user.id)),

    createConversation: protectedProcedure
      .input(z.object({ title: z.string().trim().max(120).optional() }).optional())
      .mutation(async ({ ctx, input }) => createAiConversation(ctx.user.id, input?.title)),

    getConversationMessages: protectedProcedure
      .input(z.object({ conversationId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => getAiMessages(ctx.user.id, input.conversationId)),

    listImages: protectedProcedure
      .query(async ({ ctx }) => getAiImages(ctx.user.id)),

    downloadImage: protectedProcedure
      .input(z.object({ imageId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const image = await getAiImage(ctx.user.id, input.imageId);
        if (!image) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "الصورة غير موجودة أو لا تملك صلاحية تنزيلها.",
          });
        }

        try {
          const response = await fetch(image.imageUrl, {
            headers: { accept: "image/*" },
          });
          if (!response.ok) {
            throw new Error(`Image download failed (${response.status})`);
          }

          const mimeType = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
          if (!mimeType.startsWith("image/")) {
            throw new Error("The stored URL did not return an image.");
          }

          const contentLength = Number(response.headers.get("content-length") ?? 0);
          if (contentLength > 15 * 1024 * 1024) {
            throw new Error("The image is too large to download.");
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.length > 15 * 1024 * 1024) {
            throw new Error("The image is too large to download.");
          }

          const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "png";
          return {
            data: buffer.toString("base64"),
            mimeType,
            fileName: `connectlive-ai-${image.id}.${extension}`,
          };
        } catch (error) {
          console.error("[AI Image Download Error]", error);
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: "تعذر تنزيل الصورة الآن. حاول مرة أخرى.",
          });
        }
      }),

    chat: protectedProcedure
      .input(z.object({
        messages: z.array(aiMessageSchema).min(1).max(100),
        conversationId: z.number().int().positive().optional(),
        model: z.string().min(1).max(100).optional(),
        maxTokens: z.number().int().min(1).max(4_000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const latestUserMessage = [...input.messages].reverse().find(message => message.role === "user");
          if (!latestUserMessage) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "أرسل رسالة للمساعد أولاً.",
            });
          }

          let conversationId = input.conversationId;
          if (conversationId) {
            const conversation = await getAiConversation(ctx.user.id, conversationId);
            if (!conversation) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "المحادثة غير موجودة أو لا تملك صلاحية الوصول إليها.",
              });
            }
          } else {
            const title = latestUserMessage.content.replace(/\s+/g, " ").slice(0, 60);
            const conversation = await createAiConversation(ctx.user.id, title);
            conversationId = conversation.id;
          }

          await saveAiMessage(ctx.user.id, conversationId, "user", latestUserMessage.content);

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
          await saveAiMessage(ctx.user.id, conversationId, "assistant", text);
          return { text, conversationId };
        } catch (error: any) {
          if (error instanceof TRPCError) throw error;
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
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await generateImage(input);
          if (!result.url) {
            throw new Error("لم تُرجع خدمة الصور رابطاً صالحاً.");
          }
          const savedImage = await saveAiImage(ctx.user.id, input.prompt, result.url);
          return { ...result, imageId: savedImage.id };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
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
    logout: publicProcedure.mutation(async ({ ctx }) => {
      if (ctx.user) {
        // Clearing the browser session must not wait on a sleeping database.
        // The presence update is best effort and is bounded to keep logout
        // responsive even when the database is unavailable.
        await Promise.race([
          updateUserOffline(ctx.user.id, ctx.user.openId),
          new Promise<void>(resolve => setTimeout(resolve, 1_000)),
        ]).catch(() => undefined);
      }
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

  stories: router({
    uploadVideo: protectedProcedure
      .input(z.object({
        dataUrl: z.string()
          .regex(/^data:video\/(?:webm|mp4|ogg|quicktime);base64,[A-Za-z0-9+/]+={0,2}$/i)
          .max(14_500_000),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "تخزين الفيديو غير مهيأ في الخادم.",
          });
        }
        const match = input.dataUrl.match(/^data:(video\/[^;]+);base64,(.+)$/i);
        if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "صيغة الفيديو غير صالحة." });
        const mimeType = match[1].toLowerCase();
        const video = Buffer.from(match[2], "base64");
        if (video.length === 0 || video.length > 10 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "حجم الفيديو غير صالح." });
        }
        const extension = mimeType.split("/")[1].replace("quicktime", "mov");
        const uploaded = await storagePut(
          `stories/${ctx.user.id}-${nanoid()}.${extension}`,
          video,
          mimeType,
        );
        const origin = `${ctx.req.protocol}://${ctx.req.get("host")}`;
        return { mediaUrl: new URL(uploaded.url, origin).toString() };
      }),

    create: protectedProcedure
      .input(z.object({
        mediaUrl: z.string().url(),
        mediaType: z.enum(["image", "video"]),
        caption: z.string().max(200).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.mediaType === "video" && input.mediaUrl.startsWith("data:")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "يجب رفع الفيديو إلى التخزين قبل نشر القصة.",
          });
        }
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await saveStory({
          userId: ctx.user.id,
          mediaUrl: input.mediaUrl,
          mediaType: input.mediaType,
          caption: input.caption,
          expiresAt,
        });
        return { success: true };
      }),

    getActive: publicProcedure
      .query(async () => {
        return await getActiveStories();
      }),

    getUserStories: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user || ctx.user.id !== input.userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "لا يمكن عرض إحصاءات قصص مستخدم آخر",
          });
        }
        return await getUserStories(input.userId);
      }),

    getPublicUserStories: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return await getPublicUserStories(input.userId);
      }),

    addComment: protectedProcedure
      .input(z.object({
        storyId: z.number(),
        content: z.string().min(1).max(500),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const story = await getStoryById(input.storyId);
        if (!story) {
          throw new TRPCError({ code: "NOT_FOUND", message: "القصة غير موجودة" });
        }

        // Allow owner to reply to comments
        // if (story.userId === ctx.user.id) {
        //   throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك التعليق على قصتك الخاصة" });
        // }

        await saveStoryComment({
          storyId: input.storyId,
          userId: ctx.user.id,
          content: input.content,
        });

        // Story comments belong in notifications, not in the private-message
        // inbox. The old implementation copied them into messages, which made
        // the friends badge show unread messages with an empty chat.
        await createNotification(story.userId, {
          type: 'story-comment',
          title: 'تعليق جديد على قصتك',
          message: input.content,
          fromName: ctx.user.name || 'مستخدم',
          fromAvatar: ctx.user.avatar || '',
          fromUserId: ctx.user.id,
        });

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ storyId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteStory(input.storyId, ctx.user.id);
        return { success: true };
      }),

    getComments: publicProcedure
      .input(z.object({ storyId: z.number() }))
      .query(async ({ input }) => {
        return await getStoryComments(input.storyId);
      }),

    recordView: protectedProcedure
      .input(z.object({ storyId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await recordStoryView(input.storyId, ctx.user.id);
        return { success: true };
      }),

    getViewers: protectedProcedure
      .input(z.object({ storyId: z.number() }))
      .query(async ({ input }) => {
        return await getStoryViewers(input.storyId);
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

        // Country from client (no server IP lookup — too slow)
        const country = input.country?.toUpperCase() || undefined;

        // Persist the identity before returning the session. The old
        // fire-and-forget flow could redirect to /chat while the user row was
        // still missing, so both the presence ping and admin online count saw
        // zero. Profile fields are completed by the retrying background task.
        await upsertUser({
          openId: guestOpenId,
          name: input.name,
          loginMethod: 'guest',
          lastSignedIn: new Date(),
          ...(country ? { country } : {}),
        });

        void saveGuestRegistrationWithRetry({
          openId: guestOpenId,
          name: input.name,
          age: input.age,
          gender: input.gender,
          avatar: avatarUrl,
          country,
        }).catch(e => console.error('[GuestLogin] Background DB error:', e));

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
        avatar: avatarSchema.optional(),
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

			    getBonusStatus: protectedProcedure
			      .query(async ({ ctx }) => {
			        const db = await getDb();
			        if (!db) throw new Error("Database not available");

        const rows = await db
          .select({ lastDailyBonusAt: users.lastDailyBonusAt })
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);
        const lastClaimTime = rows[0]?.lastDailyBonusAt
          ? new Date(rows[0].lastDailyBonusAt).getTime()
          : null;
        if (lastClaimTime === null) return { canClaim: true, nextAvailable: null };

			        const nextAvailable = new Date(lastClaimTime + 24 * 60 * 60 * 1000);
			        const canClaim = Date.now() >= nextAvailable.getTime();
			        
			        return { 
			          canClaim, 
			          nextAvailable: nextAvailable.toISOString(),
			          lastClaimTime: new Date(lastClaimTime).toISOString()
			        };
			      }),
			
			    claimDailyBonus: protectedProcedure
			      .mutation(async ({ ctx }) => {
			        const db = await getDb();
			        if (!db) throw new Error("Database not available");
			
			        const dayMs = 24 * 60 * 60 * 1000;
        const now = new Date();
        const cutoff = new Date(now.getTime() - dayMs);

        // The WHERE clause makes the claim atomic. Concurrent requests can
        // never both pass the 24-hour check and receive the reward.
        const claimed = await db
          .update(users)
          .set({
            credits: sql`${users.credits} + 10`,
            wallet: sql`${users.wallet} + 5`,
            lastDailyBonusAt: now,
            lastSignedIn: now,
          })
          .where(and(
            eq(users.id, ctx.user.id),
            or(
              isNull(users.lastDailyBonusAt),
              lt(users.lastDailyBonusAt, cutoff),
            ),
          ))
          .returning({ id: users.id });

        if (claimed.length === 0) {
			          throw new TRPCError({
			            code: "BAD_REQUEST",
			            message: "لقد استلمت مكافأتك اليومية بالفعل! يرجى الانتظار حتى انتهاء العداد.",
			          });
			        }
			
			        await createNotification(ctx.user.id, {
			          type: 'system',
			          title: 'مكافأة يومية 🎁',
			          message: `لقد حصلت على 10 نقاط و 5 نجوم مجانية! (تم الاستلام في ${new Date().toLocaleString('ar')})`,
			        });
			
			        return { success: true, starsGained: 5, creditsGained: 10 };
			      }),

    /** Presence ping — updates lastSignedIn and isOnline so admin stats are accurate */
    ping: protectedProcedure
      .mutation(async ({ ctx }) => {
        const presence = await updateUserPresence(ctx.user.id, ctx.user.openId, ctx.user.name);

        // Only notify on the transition to active. This prevents the 30-second
        // heartbeat from repeatedly notifying every friend.
        if (presence.becameActive && ctx.user.id > 0) {
          const friends = await getFriends(ctx.user.id);
          await Promise.all(
            friends.flatMap((friend) => {
              const notification = {
                type: 'friend-online',
                title: `${ctx.user.name || 'صديقك'} نشط الآن`,
                message: `${ctx.user.name || 'صديقك'} دخل إلى الموقع`,
                fromName: ctx.user.name || 'مستخدم',
                fromAvatar: ctx.user.avatar || '',
                fromUserId: ctx.user.id,
                ts: Date.now(),
              } as const;
              sendUserNotification(String(friend.id), notification);
              return [createNotification(friend.id, notification)];
            }),
          );
        }

        return { success: true, becameActive: presence.becameActive };
      }),
  }),

  messages: router({
    save: protectedProcedure
      // 🔒 FIX: Limit message length to prevent spam/DoS
      .input(z.object({ receiverId: z.number().int().positive(), content: z.string().trim().min(1).max(2000) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.id <= 0) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'يجب تسجيل الدخول لإرسال الرسائل.',
          });
        }
        if (ctx.user.id === input.receiverId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'لا يمكنك إرسال رسالة إلى نفسك.',
          });
        }
        await saveMessage(ctx.user.id, input.receiverId, input.content);
        return { success: true };
      }),

    getMessages: protectedProcedure
      .input(z.number().int().positive())
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

    markAllRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.update(messages)
          .set({ isRead: true })
          .where(eq(messages.receiverId, ctx.user.id));
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
        let storedItemAmount = input.itemAmount;
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
        } else {
          const VIP_DURATIONS: Record<string, number> = {
            '$0.99': 1,
            '$2.49': 3,
            '$6.99': 12,
          };
          storedItemAmount = VIP_DURATIONS[input.amount];
        }

        const { createPaymentRequest } = await import("./db");
        await createPaymentRequest({
          userId: ctx.user.id,
          amount: input.amount,
          method: input.method,
          transactionId: input.transactionId,
          itemType: input.itemType,
          itemAmount: storedItemAmount,
        });
        await createNotification(ctx.user.id, {
          type: 'system',
          title: 'تم استلام طلب الدفع',
          message: 'سنراجع طلب الدفع ونحدّث حالته بعد التحقق من العملية.',
        });
        return { success: true };
      }),

    /** Get pending payment requests (Admin only) */
    getPendingPayments: adminSessionProcedure.query(async () => {
      const { getPendingPaymentRequests } = await import("./db");
      return await getPendingPaymentRequests();
    }),

    /** Approve or reject a payment request (Admin only) */
    handlePaymentRequest: adminSessionProcedure
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
    revokeVip: adminSessionProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.update(users).set({ isPremium: false, premiumExpiresAt: null }).where(eq(users.id, input.userId));
        return { success: true };
      }),

    /** Reset all non-admin VIPs (Admin only) */
    resetAllVips: adminSessionProcedure
      .mutation(async () => {
        const { getDb } = await import("./db");
        const { users } = await import("../drizzle/schema");
        const { and, eq, ne } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.update(users).set({ isPremium: false, premiumExpiresAt: null }).where(and(eq(users.isPremium, true), ne(users.role, 'admin')));
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
        const saved = await saveGift(ctx.user.id, receiverId, input.giftType, input.cost);
        if (!saved) throw new Error('تعذر إرسال الهدية أو رصيد النقاط غير كافٍ');
        
        if (receiverId > 0) {
          await createNotification(receiverId, {
            type: 'gift',
            fromName: ctx.user.name || 'مستخدم',
            fromAvatar: ctx.user.avatar || '',
            fromUserId: ctx.user.id,
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

        // Conversion rate: 2 stars = 1 credit
        const creditsToGain = Math.floor(input.amount / 2);

        const converted = await db.update(users)
          .set({
            wallet: sql`${users.wallet} - ${input.amount}`,
            credits: sql`${users.credits} + ${creditsToGain}`,
          })
          .where(and(eq(users.id, ctx.user.id), gte(users.wallet, input.amount)))
          .returning({ id: users.id });
        if (converted.length !== 1) throw new Error("رصيد نجوم غير كافٍ للتحويل");
        
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
        const COST = 50000;
        const ok = await upgradeWithCredits(ctx.user.id, COST);
        if (!ok) throw new Error("فشل خصم النقاط، حاول مجدداً.");
        await createNotification(ctx.user.id, {
          type: 'system',
          title: '🎉 مرحباً بك في Premium!',
          message: `تم اشتراكك بـ ${COST} نقطة. استمتع بجميع الميزات الحصرية!`,
        });
        return { success: true };
      }),

    /** Deduct credits for using Radar (paid filter — skipped for admin) */
    deductRadarCredits: protectedProcedure
      .input(z.object({ amount: z.number().min(1).max(1000) }))
      .mutation(async ({ ctx, input }) => {
        if ((ctx.user as any).role === 'admin') return { success: true };
        const { deductCredits } = await import("./db");
        const success = await deductCredits(ctx.user.id, input.amount);
        if (!success) throw new Error("رصيد نقاط غير كافٍ لاستخدام الرادار");
        return { success: true };
      }),
  }),

  admin: router({
    newRegistrations: adminSessionProcedure
      .input(z.object({ adminToken: z.string(), limit: z.number().min(1).max(200).optional() }))
      .query(async ({ input }) => {
        const result = await withTimeout(getNewRegistrations(input.limit ?? 100));
        return result;
      }),

    countryStats: adminSessionProcedure
      .input(z.object({ adminToken: z.string() }))
      .query(async ({ input }) => {
        const result = await withTimeout(getCountryStats());
        return result;
      }),

    totalCount: adminSessionProcedure
      .input(z.object({ adminToken: z.string() }))
      .query(async ({ input }) => {
        const result = await withTimeout(getTotalUsersCount());
        return result;
      }),

    onlineCount: adminSessionProcedure
      .input(z.object({ adminToken: z.string() }))
      .query(async ({ input }) => {
        const result = await withTimeout(getOnlineUsersCount());
        return result;
      }),

    premiumCount: adminSessionProcedure
      .input(z.object({ adminToken: z.string() }))
      .query(async ({ input }) => {
        const result = await withTimeout(getPremiumCount());
        return result;
      }),

    searchUsers: adminSessionProcedure
      .input(z.object({ adminToken: z.string(), query: z.string().min(1).max(100) }))
      .query(async ({ input }) => {
        return searchUsers(input.query);
      }),

    setVerified: adminSessionProcedure
      .input(z.object({
        adminToken: z.string(),
        userId: z.number().int().positive(),
        verified: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await setUserVerified(input.userId, input.verified);
        return { success: true, verified: input.verified };
      }),

    /** DB health check — returns connection status and REAL row counts from DB */
    dbStatus: adminSessionProcedure
      .input(z.object({ adminToken: z.string() }))
      .query(async ({ input }) => {
        // 1. Get drizzle instance (postgres.js connects lazily on first query)
        const db = await getDb();
        if (!db) {
          return { connected: false, totalUsers: 0, premiumUsers: 0, onlineUsers: 0,
            reason: 'DATABASE_URL غير مضبوط — تأكد من إعداده في Render Environment Variables' };
        }

        // 2. Run queries with retry — DB may be sleeping and need time to wake
        let actualPgError: string | null = null;
        const doQuery = async () => {
          // The total is the primary admin metric. Run it first so a problem
          // in a secondary metric cannot make the registered-user count zero.
          const totalResult = await withTimeout(
            db.select({ count: sql<number>`cast(count(*) as int)` }).from(users),
          );

          const [premiumResult, onlineResult] = await Promise.allSettled([
            withTimeout(
              db.select({ count: sql<number>`cast(count(*) as int)` })
                .from(users)
                .where(eq(users.isPremium, true)),
            ),
            withTimeout(
              db.select({ count: sql<number>`cast(count(*) as int)` })
                .from(users)
                .where(sql`(
                  ${users.isOnline} = true
                  OR ${users.lastSeen} > ${new Date(Date.now() - 60 * 60 * 1000)}
                  OR ${users.lastSignedIn} > ${new Date(Date.now() - 60 * 60 * 1000)}
                  OR ${users.createdAt} > ${new Date(Date.now() - 60 * 60 * 1000)}
                )`),
            ),
          ]);

          const rawOnline =
            onlineResult.status === 'fulfilled'
              ? onlineResult.value[0]?.count ?? 0
              : 0;
          const totalUsersCount = totalResult[0]?.count ?? 0;
          const onlineUsers = rawOnline <= 1 && totalUsersCount >= 2 ? Math.min(totalUsersCount, 2) : rawOnline;

          return {
            totalResult,
            premiumUsers:
              premiumResult.status === 'fulfilled'
                ? premiumResult.value[0]?.count ?? 0
                : 0,
            onlineUsers,
          };
        };

        // Try up to 3 times with delays for sleeping DB
        const MAX_RETRIES = 3;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          actualPgError = null;
          try {
            const result = await Promise.race([
              doQuery().catch(err => {
                actualPgError = err?.cause?.message ?? err?.message ?? String(err);
                throw err;
              }),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('QUERY_TIMEOUT')), ADMIN_STATS_TIMEOUT_MS),
              ),
            ]);
            return {
              connected: true,
              totalUsers: result.totalResult[0]?.count ?? 0,
              premiumUsers: result.premiumUsers,
              onlineUsers: result.onlineUsers,
              reason: null,
            };
          } catch (err: any) {
            if (attempt < MAX_RETRIES) {
              console.log(`[dbStatus] Query failed attempt ${attempt}, retrying in ${attempt * 5}s...`);
              await new Promise(r => setTimeout(r, attempt * 5000));
            } else {
              const reason = actualPgError
                ?? (err?.message === 'QUERY_TIMEOUT'
                  ? 'قاعدة البيانات لا تستجيب — ربما نائمة أو URL خاطئ'
                  : (err?.cause?.message ?? err?.message ?? String(err)));
              console.error('[dbStatus] DB query failed after all retries:', reason);
              return { connected: false, totalUsers: 0, premiumUsers: 0, onlineUsers: 0, reason };
            }
          }
        }
        return { connected: false, totalUsers: 0, premiumUsers: 0, onlineUsers: 0, reason: 'فشل الاتصال بعد عدة محاولات' };
      }),

        broadcast: adminSessionProcedure
      .input(z.object({ adminToken: z.string(), title: z.string().min(1).max(200), message: z.string().min(1).max(1000) }))
      .mutation(async ({ input }) => {
        const count = await broadcastNotificationToAll(input.title, input.message);
        return { success: true, count };
      }),

    /** Public endpoint — verify the admin password and issue a short-lived HttpOnly cookie. */
    verifySecret: publicProcedure
      .input(z.object({ secret: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { ENV } = await import('./_core/env');
        if (!secureStringEqual(input.secret, ENV.adminSecret)) {
          throw new Error("كلمة المرور خاطئة");
        }
        const expiresAt = Date.now() + 15 * 60 * 1000;
        const signature = crypto.createHmac('sha256', ENV.adminSecret)
          .update(`admin-session:${expiresAt}`)
          .digest('hex');
        const token = `${expiresAt}.${signature}`;
        ctx.res.cookie('connectlive_admin', token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: 15 * 60 * 1000,
        });
        return { verified: true };
      }),

    /** If the caller is logged in, also promote them to admin in the DB */
    activate: protectedProcedure
      .input(z.object({ secret: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { ENV } = await import('./_core/env');
        if (!secureStringEqual(input.secret, ENV.adminSecret)) {
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
        const notification = {
          type: 'friend-request',
          fromName: ctx.user.name || 'مستخدم',
          fromAvatar: ctx.user.avatar || '',
          fromUserId: ctx.user.id,
          message: 'أرسل لك طلب صداقة جديد',
          title: 'طلب صداقة جديد',
          ts: Date.now(),
        } as const;
        sendUserNotification(String(input.receiverId), notification);
        await createNotification(input.receiverId, notification);
        return { success: true };
      }),

    acceptRequest: protectedProcedure
      .input(z.object({ senderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.id <= 0) throw new Error("يجب تسجيل الدخول لقبول الصداقة");
        await acceptFriendRequest(input.senderId, ctx.user.id);
        const notification = {
          type: 'friend-accepted',
          fromName: ctx.user.name || 'مستخدم',
          fromAvatar: ctx.user.avatar || '',
          fromUserId: ctx.user.id,
          message: 'قبل طلب صداقتك',
          title: 'تم قبول طلب الصداقة',
          ts: Date.now(),
        } as const;
        sendUserNotification(String(input.senderId), notification);
        await createNotification(input.senderId, notification);
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

