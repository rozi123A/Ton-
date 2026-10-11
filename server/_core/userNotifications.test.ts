import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { registerUserNotificationClient, sendUserNotification } from "./userNotifications";

function mockResponse(write: (chunk: string) => boolean = () => true) {
  return {
    writableEnded: false,
    destroyed: false,
    write: vi.fn(write),
  } as unknown as Response;
}

describe("user notification SSE delivery", () => {
  it("queues a notification when a live stream disconnects and delivers it on reconnect", () => {
    const userId = `sse-test-${Date.now()}-${Math.random()}`;
    let writes = 0;
    const disconnectedClient = mockResponse(() => {
      writes += 1;
      if (writes === 1) return true; // connected event
      throw new Error("socket closed");
    });
    const unregisterDisconnected = registerUserNotificationClient(userId, disconnectedClient);
    const notification = { type: "friend-request", fromName: "Test", ts: Date.now() };

    expect(() => sendUserNotification(userId, notification)).not.toThrow();
    unregisterDisconnected();

    const reconnectedClient = mockResponse();
    const unregisterReconnected = registerUserNotificationClient(userId, reconnectedClient);
    const receivedEvents = reconnectedClient.write.mock.calls.map(([event]) => String(event));

    expect(receivedEvents.some((event) => event.includes(JSON.stringify(notification)))).toBe(true);
    unregisterReconnected();
  });
});
