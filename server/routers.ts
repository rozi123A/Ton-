import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure } from "./_core/trpc";
import {
  saveUserProfile, getUsersByGender, getMessages, saveMessage,
  upsertUser, getUserByOpenId, getRecentUsers, incrementProfileViews,
  getUserCredits, deductCredits, addCredits, saveGift, upgradeToPremium,
  getCountryStats, getNewRegistrations,
} from "./db";
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
        cost: z.number().min(1).max(500),
        receiverName: z.string().optional(), // informational only
      }))
      .mutation(async ({ ctx, input }) => {
        const ok = await deductCredits(ctx.user.id, input.cost);
        if (!ok) throw new Error('رصيدك غير كافٍ لإرسال هذه الهدية');
        const newBalance = await getUserCredits(ctx.user.id);
        // Best-effort gift log (receiverId unknown without pairing info — use 0)
        await saveGift(ctx.user.id, 0, input.giftType, input.cost).catch(() => {});
        return { success: true, newBalance };
      }),

    /** Simulate purchasing credits (Stripe coming soon) */
    buyCredits: protectedProcedure
      .input(z.number().min(1).max(10000))
      .mutation(async ({ ctx, input }) => {
        await addCredits(ctx.user.id, input);
        const newBalance = await getUserCredits(ctx.user.id);
        return { success: true, newBalance };
      }),

    /** Upgrade user to premium */
    upgrade: protectedProcedure
      .mutation(async ({ ctx }) => {
        await upgradeToPremium(ctx.user.id);
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
});

export type AppRouter = typeof appRouter;
