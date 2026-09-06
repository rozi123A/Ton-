import type { Response } from "express";

export interface NotifPayload {
  type: string;
  title?: string;
  message?: string;
  fromName?: string;
  fromAvatar?: string;
  fromUserId?: number;
  ts: number;
  [key: string]: unknown;
}

const notifyClients = new Map<string, Response>();
const pendingNotifs = new Map<string, NotifPayload[]>();
const MAX_PENDING = 30;

function sseEvent(res: Response, data: object) {
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

export function sendUserNotification(userId: string, notif: NotifPayload) {
  const client = notifyClients.get(userId);
  if (client && !client.writableEnded) {
    sseEvent(client, notif);
    return;
  }

  const queue = pendingNotifs.get(userId) || [];
  queue.push(notif);
  if (queue.length > MAX_PENDING) queue.shift();
  pendingNotifs.set(userId, queue);
}

export function registerUserNotificationClient(userId: string, res: Response) {
  notifyClients.set(userId, res);

  const pending = pendingNotifs.get(userId) || [];
  pending.forEach((notification) => sseEvent(res, notification));
  pendingNotifs.delete(userId);
  sseEvent(res, { type: "connected", ts: Date.now() });

  return () => {
    if (notifyClients.get(userId) === res) notifyClients.delete(userId);
  };
}