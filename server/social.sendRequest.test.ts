import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const socialMocks = vi.hoisted(() => ({
  createFriendRequest: vi.fn(),
  getFriendStatus: vi.fn(),
  createNotification: vi.fn(),
  sendUserNotification: vi.fn(),
  sendWebPushNotification: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createFriendRequest: socialMocks.createFriendRequest,
    getFriendStatus: socialMocks.getFriendStatus,
    createNotification: socialMocks.createNotification,
  };
});

vi.mock("./_core/userNotifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/userNotifications")>();
  return { ...actual, sendUserNotification: socialMocks.sendUserNotification };
});

vi.mock("./_core/webPush", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/webPush")>();
  return { ...actual, sendWebPushNotification: socialMocks.sendWebPushNotification };
});

import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCaller() {
  const user: AuthenticatedUser = {
    id: 101,
    openId: "sender-test",
    email: "sender@example.test",
    name: "Sender QA",
    loginMethod: "guest",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

beforeEach(() => {
  vi.clearAllMocks();
  socialMocks.getFriendStatus.mockResolvedValue("none");
  socialMocks.createFriendRequest.mockResolvedValue(undefined);
  socialMocks.createNotification.mockResolvedValue(undefined);
  socialMocks.sendUserNotification.mockImplementation(() => undefined);
  socialMocks.sendWebPushNotification.mockResolvedValue({ sent: 0, failed: 0 });
});

describe("social.sendRequest", () => {
  it("persists the request and notification without waiting for Web Push", async () => {
    let resolvePush!: (value: { sent: number; failed: number }) => void;
    socialMocks.sendWebPushNotification.mockReturnValue(
      new Promise((resolve) => {
        resolvePush = resolve;
      }),
    );

    const result = await Promise.race([
      createCaller().social.sendRequest({ receiverId: 202 }).then(() => "resolved"),
      new Promise<string>((resolve) => setTimeout(() => resolve("timed-out"), 150)),
    ]);

    expect(result).toBe("resolved");
    expect(socialMocks.createFriendRequest).toHaveBeenCalledWith(101, 202);
    expect(socialMocks.createNotification).toHaveBeenCalledWith(202, expect.objectContaining({
      type: "friend-request",
      fromUserId: 101,
    }));
    expect(socialMocks.sendUserNotification).toHaveBeenCalledWith("202", expect.objectContaining({
      type: "friend-request",
    }));
    expect(socialMocks.createNotification.mock.invocationCallOrder[0]).toBeLessThan(
      socialMocks.sendUserNotification.mock.invocationCallOrder[0],
    );
    resolvePush({ sent: 0, failed: 0 });
  });

  it("keeps the request successful when notification storage fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    socialMocks.createNotification.mockRejectedValue(new Error("notification table unavailable"));

    try {
      await expect(createCaller().social.sendRequest({ receiverId: 202 })).resolves.toMatchObject({
        success: true,
        status: "pending",
      });
      expect(socialMocks.createFriendRequest).toHaveBeenCalledWith(101, 202);
      expect(socialMocks.sendUserNotification).toHaveBeenCalledWith("202", expect.objectContaining({
        type: "friend-request",
      }));
    } finally {
      warn.mockRestore();
    }
  });

  it("rejects self-directed friend requests", async () => {
    await expect(createCaller().social.sendRequest({ receiverId: 101 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(socialMocks.createFriendRequest).not.toHaveBeenCalled();
  });

  it("treats an existing pending request as idempotent", async () => {
    socialMocks.getFriendStatus.mockResolvedValue("pending");

    await expect(createCaller().social.sendRequest({ receiverId: 202 })).resolves.toMatchObject({
      success: true,
      status: "pending",
    });
    expect(socialMocks.createFriendRequest).not.toHaveBeenCalled();
    expect(socialMocks.createNotification).not.toHaveBeenCalled();
  });

  it("returns a useful error when the database cannot persist the request", async () => {
    socialMocks.createFriendRequest.mockRejectedValue(new Error("database unavailable"));

    await expect(createCaller().social.sendRequest({ receiverId: 202 })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "تعذر حفظ طلب الصداقة. يرجى المحاولة مرة أخرى.",
    });
    expect(socialMocks.createNotification).not.toHaveBeenCalled();
    expect(socialMocks.sendUserNotification).not.toHaveBeenCalled();
    expect(socialMocks.sendWebPushNotification).not.toHaveBeenCalled();
  });
});
