import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { saveUserProfile, getUsersByGender, getMessages, saveMessage, upsertUser, getUserByOpenId, getRecentUsers } from "./db";
import { sdk } from "./_core/sdk";
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
  }),

  users: router({
    guestLogin: publicProcedure
      .input(z.object({
        name: z.string().min(1, "الاسم مطلوب"),
        age: z.number().min(13).max(100),
        gender: z.enum(['male', 'female', 'other']),
        avatar: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const guestOpenId = `guest_${nanoid()}`;

        await upsertUser({
          openId: guestOpenId,
          name: input.name,
          loginMethod: 'guest',
          lastSignedIn: new Date(),
        });

        const user = await getUserByOpenId(guestOpenId);
        if (!user) throw new Error("فشل انشاء المستخدم");

        await saveUserProfile(user.id, {
          name: input.name,
          age: input.age,
          gender: input.gender,
          avatar: input.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(input.name)}`,
        });

        const sessionToken = await sdk.createSessionToken(guestOpenId, {
          name: input.name,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return { success: true };
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
      .query(async ({ input }) => {
        return await getUsersByGender(input);
      }),

    getRecent: publicProcedure
      .input(z.number().min(1).max(50).optional())
      .query(async ({ input }) => {
        return await getRecentUsers(input ?? 20);
      }),
  }),

  messages: router({
    save: protectedProcedure
      .input(z.object({
        receiverId: z.number(),
        content: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await saveMessage(ctx.user.id, input.receiverId, input.content);
        return { success: true };
      }),

    getMessages: protectedProcedure
      .input(z.number())
      .query(async ({ ctx, input }) => {
        return await getMessages(ctx.user.id, input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
