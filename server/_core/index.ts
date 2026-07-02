import "dotenv/config";
import express, { type Request, type Response } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ensureSchema } from "../db";

// ── Signaling via Server-Sent Events (SSE) ────────────────────────────────────

interface PeerInfo {
  res: Response;
  name: string;
  avatar: string;
  gender: string;
  filterGender: string;
  filterCountry: string;
  partnerId: string | null;
}

const peers = new Map<string, PeerInfo>();
const waitingQueue: string[] = [];

interface LastPartner { partnerName: string; partnerAvatar: string; ts: number; }
const lastPeers = new Map<string, LastPartner>();
const NOTIF_TTL = 5 * 60 * 1000;

function sseEvent(res: Response, data: object) {
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

function isCompatible(a: PeerInfo, b: PeerInfo): boolean {
  const aWantsB = a.filterGender === 'any' || a.filterGender === b.gender;
  const bWantsA = b.filterGender === 'any' || b.filterGender === a.gender;
  const countryOk =
    a.filterCountry === 'any' ||
    b.filterCountry === 'any' ||
    a.filterCountry === b.filterCountry;
  return aWantsB && bWantsA && countryOk;
}

function matchPeers() {
  const waiting = waitingQueue.filter(id => peers.has(id));
  for (let i = 0; i < waiting.length; i++) {
    for (let j = i + 1; j < waiting.length; j++) {
      const id1 = waiting[i];
      const id2 = waiting[j];
      const p1 = peers.get(id1);
      const p2 = peers.get(id2);
      if (!p1 || !p2) continue;
      if (!isCompatible(p1, p2)) continue;

      const qi1 = waitingQueue.indexOf(id1);
      if (qi1 !== -1) waitingQueue.splice(qi1, 1);
      const qi2 = waitingQueue.indexOf(id2);
      if (qi2 !== -1) waitingQueue.splice(qi2, 1);

      p1.partnerId = id2;
      p2.partnerId = id1;
      sseEvent(p1.res, { type: "matched", role: "caller", peer: { name: p2.name, avatar: p2.avatar } });
      sseEvent(p2.res, { type: "matched", role: "callee", peer: { name: p1.name, avatar: p1.avatar } });
      matchPeers();
      return;
    }
  }
}

function removePeer(peerId: string) {
  const peer = peers.get(peerId);
  if (!peer) return;
  if (peer.partnerId) {
    const partner = peers.get(peer.partnerId);
    if (partner) {
      lastPeers.set(peer.name,    { partnerName: partner.name, partnerAvatar: partner.avatar, ts: Date.now() });
      lastPeers.set(partner.name, { partnerName: peer.name,    partnerAvatar: peer.avatar,    ts: Date.now() });
      partner.partnerId = null;
      sseEvent(partner.res, { type: "peer-left" });
      if (!waitingQueue.includes(peer.partnerId)) {
        waitingQueue.push(peer.partnerId);
        sseEvent(partner.res, { type: "waiting" });
        matchPeers();
      }
    }
  }
  const qi = waitingQueue.indexOf(peerId);
  if (qi !== -1) waitingQueue.splice(qi, 1);
  peers.delete(peerId);
}

function registerSignalingRoutes(app: express.Express) {
  app.get("/api/signal/connect", (req: Request, res: Response) => {
    const peerId        = req.query.peerId        as string;
    const name          = (req.query.name          as string) || "مستخدم";
    const avatar        = (req.query.avatar        as string) || "";
    const gender        = (req.query.gender        as string) || "other";
    const filterGender  = (req.query.filterGender  as string) || "any";
    const filterCountry = (req.query.filterCountry as string) || "any";

    if (!peerId) { res.status(400).json({ error: "peerId required" }); return; }

    removePeer(peerId);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    peers.set(peerId, { res, name, avatar, gender, filterGender, filterCountry, partnerId: null });
    waitingQueue.push(peerId);
    sseEvent(res, { type: "waiting" });
    matchPeers();

    const last = lastPeers.get(name);
    if (last && Date.now() - last.ts < NOTIF_TTL) {
      const partnerWaiting = [...peers.values()].find(
        p => p.name === last.partnerName && p.partnerId === null && p.res !== res
      );
      if (partnerWaiting) {
        setTimeout(() => sseEvent(res, {
          type: "notification",
          partnerName:   last.partnerName,
          partnerAvatar: last.partnerAvatar,
        }), 600);
      }
    }

    req.on("close", () => removePeer(peerId));
  });

  app.post("/api/signal/send", express.json(), (req: Request, res: Response) => {
    const { peerId, type, data, text } = req.body as {
      peerId: string; type: string; data?: unknown; text?: string;
    };

    const peer = peers.get(peerId);
    if (!peer) { res.json({ ok: false, reason: "peer not found" }); return; }

    if (type === "next") {
      if (peer.partnerId) {
        const partner = peers.get(peer.partnerId);
        if (partner) {
          partner.partnerId = null;
          sseEvent(partner.res, { type: "peer-left" });
          if (!waitingQueue.includes(peer.partnerId)) {
            waitingQueue.push(peer.partnerId);
            sseEvent(partner.res, { type: "waiting" });
          }
        }
        peer.partnerId = null;
      }
      if (!waitingQueue.includes(peerId)) waitingQueue.push(peerId);
      sseEvent(peer.res, { type: "waiting" });
      matchPeers();
      res.json({ ok: true });
      return;
    }

    if (!peer.partnerId) { res.json({ ok: false, reason: "no partner" }); return; }
    const partner = peers.get(peer.partnerId);
    if (!partner) { res.json({ ok: false, reason: "partner not connected" }); return; }

    if (type === "text-message") {
      sseEvent(partner.res, { type: "text-message", text, senderName: peer.name });
    } else if (type === "gift") {
      sseEvent(partner.res, { type: "gift", data: { ...(data as object), senderName: peer.name } });
    } else if (type === "friend-request") {
      sseEvent(partner.res, {
        type: "friend-request",
        fromName: peer.name,
        fromAvatar: peer.avatar,
        fromPeerId: peerId,
      });
    } else if (type === "friend-accepted") {
      sseEvent(partner.res, {
        type: "friend-accepted",
        fromName: peer.name,
        fromAvatar: peer.avatar,
      });
    } else {
      sseEvent(partner.res, { type, data });
    }
    res.json({ ok: true });
  });
}

// ── User Notification System (SSE per userId) ─────────────────────────────────

interface NotifPayload {
  type: string;
  title?: string;
  message?: string;
  fromName?: string;
  fromAvatar?: string;
  ts: number;
  [key: string]: unknown;
}

const notifyClients = new Map<string, Response>();
const pendingNotifs = new Map<string, NotifPayload[]>();
const MAX_PENDING = 30;

function sendUserNotification(userId: string, notif: NotifPayload) {
  const client = notifyClients.get(userId);
  if (client && !client.writableEnded) {
    sseEvent(client, notif);
  } else {
    const queue = pendingNotifs.get(userId) || [];
    queue.push(notif);
    if (queue.length > MAX_PENDING) queue.shift();
    pendingNotifs.set(userId, queue);
  }
}

function registerNotifyRoutes(app: express.Express) {
  app.get("/api/notify/stream", (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    if (!userId) { res.status(400).json({ error: "userId required" }); return; }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    notifyClients.set(userId, res);

    const pending = pendingNotifs.get(userId) || [];
    pending.forEach(n => sseEvent(res, n));
    pendingNotifs.delete(userId);

    sseEvent(res, { type: "connected", ts: Date.now() });

    const keepAlive = setInterval(() => {
      if (!res.writableEnded) res.write(": ping\n\n");
      else clearInterval(keepAlive);
    }, 25000);

    req.on("close", () => {
      notifyClients.delete(userId);
      clearInterval(keepAlive);
    });
  });

  app.post("/api/notify/send", express.json(), (req: Request, res: Response) => {
    const { userId, type, title, message, fromName, fromAvatar } = req.body as {
      userId: string;
      type?: string;
      title?: string;
      message?: string;
      fromName?: string;
      fromAvatar?: string;
    };

    if (!userId) { res.json({ ok: false, reason: "userId required" }); return; }

    const notif: NotifPayload = {
      type: type || "notification",
      title,
      message,
      fromName,
      fromAvatar,
      ts: Date.now(),
    };

    sendUserNotification(String(userId), notif);
    res.json({ ok: true });
  });
}

// ── Port helpers ──────────────────────────────────────────────────────────────
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => { server.close(() => resolve(true)); });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function startServer() {
  await ensureSchema();
  const app = express();
  const server = createServer(app);

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerSignalingRoutes(app);
  registerNotifyRoutes(app);

  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  app.get("/ping", (_req, res) => res.json({ ok: true, ts: Date.now() }));

  if (process.env.NODE_ENV !== "development") {
    const selfUrl = process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, "");
    if (selfUrl) {
      const INTERVAL_MS = 14 * 60 * 1000;
      setInterval(async () => {
        try { await fetch(`${selfUrl}/ping`); console.log("[keep-alive] pinged", selfUrl); }
        catch (err) { console.warn("[keep-alive] ping failed:", err); }
      }, INTERVAL_MS);
      console.log(`[keep-alive] scheduled every 14 min → ${selfUrl}/ping`);
    } else {
      console.warn("[keep-alive] RENDER_EXTERNAL_URL not set — self-ping disabled");
    }
  }

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) console.log(`Port ${preferredPort} busy, using ${port}`);
  server.listen(port, () => console.log(`Server running on http://localhost:${port}/`));
}

startServer().catch(console.error);
