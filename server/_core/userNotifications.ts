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

function sseEvent(res: Response, data: object): boolean {
  if (res.writableEnded || res.destroyed) return false;
  try {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    // A disconnected SSE client must never break the operation that created
    // the notification. The caller can retain the payload for reconnection.
    return false;
  }
}

export function sendUserNotification(userId: string, notif: NotifPayload) {
  const client = notifyClients.get(userId);
  if (client) {
    if (sseEvent(client, notif)) return;
    if (notifyClients.get(userId) === client) notifyClients.delete(userId);
  }

  const queue = pendingNotifs.get(userId) || [];
  queue.push(notif);
  if (queue.length > MAX_PENDING) queue.shift();
  pendingNotifs.set(userId, queue);
}

export function registerUserNotificationClient(userId: string, res: Response) {
  notifyClients.set(userId, res);

  const pending = pendingNotifs.get(userId) || [];
  const undelivered = pending.filter((notification) => !sseEvent(res, notification));
  if (undelivered.length > 0) pendingNotifs.set(userId, undelivered);
  else pendingNotifs.delete(userId);

  if (!sseEvent(res, { type: "connected", ts: Date.now() }) && notifyClients.get(userId) === res) {
    notifyClients.delete(userId);
  }

  return () => {
    if (notifyClients.get(userId) === res) notifyClients.delete(userId);
  };
}
