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

const notifyClients = new Map<string, Set<Response>>();
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
  const clients = notifyClients.get(userId);
  let delivered = false;
  if (clients) {
    for (const client of Array.from(clients)) {
      if (sseEvent(client, notif)) delivered = true;
      else clients.delete(client);
    }
    if (clients.size === 0) notifyClients.delete(userId);
    if (delivered) return;
  }

  const queue = pendingNotifs.get(userId) || [];
  queue.push(notif);
  if (queue.length > MAX_PENDING) queue.shift();
  pendingNotifs.set(userId, queue);
}

export function broadcastPresence(userId: number, online: boolean) {
  const event = { type: "presence", userId, online, ts: Date.now() };
  for (const [clientId, clients] of Array.from(notifyClients.entries())) {
    for (const client of Array.from(clients)) {
      if (!sseEvent(client, event)) clients.delete(client);
    }
    if (clients.size === 0) notifyClients.delete(clientId);
  }
}

export function registerUserNotificationClient(userId: string, res: Response) {
  let clients = notifyClients.get(userId);
  if (!clients) {
    clients = new Set<Response>();
    notifyClients.set(userId, clients);
  }
  clients.add(res);

  const pending = pendingNotifs.get(userId) || [];
  const undelivered = pending.filter((notification) => !sseEvent(res, notification));
  if (undelivered.length > 0) pendingNotifs.set(userId, undelivered);
  else pendingNotifs.delete(userId);

  if (!sseEvent(res, { type: "connected", ts: Date.now() })) {
    clients.delete(res);
    if (clients.size === 0) notifyClients.delete(userId);
  }

  return () => {
    const activeClients = notifyClients.get(userId);
    activeClients?.delete(res);
    if (activeClients?.size === 0) notifyClients.delete(userId);
  };
}
