import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { updateUserPresence } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const authenticatedUser = await sdk.authenticateRequest(opts.req);
    user = authenticatedUser;
    // Presence must be recorded server-side as soon as any authenticated
    // request arrives. Relying only on the browser heartbeat misses users
    // when a browser blocks storage, cookies, or background timers.
    if (!authenticatedUser.isCron) {
      void updateUserPresence(
        authenticatedUser.id,
        authenticatedUser.openId,
        authenticatedUser.name,
      );
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
