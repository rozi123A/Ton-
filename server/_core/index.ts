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

// ── Signaling via Server-Sent Events (SSE) ────────────────────────────────────
// No external WebSocket library needed — uses built-in Node.js HTTP streams.

interface PeerInfo {
  res: Response;
  name: string;
  avatar: string;
  partnerId: string | null;
}

const peers = new Map<string, PeerInfo>();
const waitingQueue: string[] = [];

function sseEvent(res: Response, data: object) {
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

function matchPeers() {
  while (waitingQueue.length >= 2) {
    const id1 = waitingQueue.shift()!;
    const id2 = waitingQueue.shift()!;
    const p1 = peers.get(id1);
    const p2 = peers.get(id2);
    if (!p1 || !p2) continue;
    p1.partnerId = id2;
    p2.partnerId = id1;
    sseEvent(p1.res, { type: "matched", role: "caller", peer: { name: p2.name, avatar: p2.avatar } });
    sseEvent(p2.res, { type: "matched", role: "callee", peer: { name: p1.name, avatar: p2.avatar } });
  }
}

function removePeer(peerId: string) {
  const peer = peers.get(peerId);
  if (!peer) return;
  if (peer.partnerId) {
    const partner = peers.get(peer.partnerId);
    if (partner) {
      partner.partnerId = null;
      sseEvent(partner.res, { type: "peer-left" });
      // put partner back in queue
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
  // SSE connection — client opens this to receive events
  app.get("/api/signal/connect", (req: Request, res: Response) => {
    const peerId = req.query.peerId as string;
    const name = (req.query.name as string) || "مستخدم";
    const avatar = (req.query.avatar as string) || "";

    if (!peerId) { res.status(400).json({ error: "peerId required" }); return; }

    // Clean up any previous connection for this peer
    removePeer(peerId);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    peers.set(peerId, { res, name, avatar, partnerId: null });
    waitingQueue.push(peerId);
    sseEvent(res, { type: "waiting" });
    matchPeers();

    req.on("close", () => removePeer(peerId));
  });

  // Signal relay — client POSTs offer/answer/ICE/text/next
  app.post("/api/signal/send", express.json(), (req: Request, res: Response) => {
    const { peerId, type, data, text } = req.body as {
      peerId: string;
      type: string;
      data?: unknown;
      text?: string;
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

    // Relay to partner
    if (!peer.partnerId) { res.json({ ok: false, reason: "no partner" }); return; }
    const partner = peers.get(peer.partnerId);
    if (!partner) { res.json({ ok: false, reason: "partner not connected" }); return; }

    if (type === "text-message") {
      sseEvent(partner.res, { type: "text-message", text, senderName: peer.name });
    } else {
      sseEvent(partner.res, { type, data });
    }
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
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerSignalingRoutes(app);

  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

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
