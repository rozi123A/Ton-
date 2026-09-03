import "dotenv/config";
import crypto from "crypto";
import express, { type Request, type Response } from "express";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ensureSchema } from "../db";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { validateEnv } from "./env";
import { sql } from "drizzle-orm";

// ── Signaling via Server-Sent Events (SSE) ────────────────────────────────────

interface PeerInfo {
  res: Response;
  name: string;
  avatar: string;
  gender: string;
  filterGender: string;
  filterCountry: string;
  partnerId: string | null;
  userId?: number;
}

const peers = new Map<string, PeerInfo>();
const waitingQueue: string[] = [];

interface LastPartner { partnerName: string; partnerAvatar: string; ts: number; }
const lastPeers = new Map<string, LastPartner>();
const NOTIF_TTL = 5 * 60 * 1000;

// ── Admin watchers (live call monitoring) ───────────────────────────────────
interface AdminWatcher { res: Response; targetPeerId: string; }
const adminWatchers = new Map<string, AdminWatcher>(); // watcherId → watcher

// ── Recording storage (Backblaze B2) ─────────────────────────────────────────
const REC_DIR = path.join('/tmp', 'ton-recs');
const MAX_RECORDING_BYTES = 250 * 1024 * 1024;
try { fs.mkdirSync(REC_DIR, { recursive: true }); } catch {}

const B2_BUCKET   = process.env.B2_BUCKET   || '';
const B2_ENDPOINT = process.env.B2_ENDPOINT  || ''; // e.g. s3.us-east-005.backblazeb2.com

let b2: S3Client | null = null;
if (B2_BUCKET && B2_ENDPOINT && process.env.B2_KEY_ID && process.env.B2_APP_KEY) {
  const region = B2_ENDPOINT.split('.').slice(1, 3).join('-') || 'us-east-005';
  b2 = new S3Client({
    endpoint: `https://${B2_ENDPOINT}`,
    region,
    credentials: { accessKeyId: process.env.B2_KEY_ID!, secretAccessKey: process.env.B2_APP_KEY! },
    forcePathStyle: true,
  });
  console.log('[B2] Backblaze storage enabled — bucket:', B2_BUCKET);
} else {
  console.warn('[B2] Backblaze env vars missing — recordings saved to /tmp only (ephemeral)');
}

async function b2Upload(key: string, body: Buffer, type = 'application/octet-stream') {
  if (!b2 || !B2_BUCKET) return;
  await b2.send(new PutObjectCommand({ Bucket: B2_BUCKET, Key: key, Body: body, ContentType: type }));
}

async function b2Download(key: string): Promise<Buffer | null> {
  if (!b2 || !B2_BUCKET) return null;
  try {
    const r = await b2.send(new GetObjectCommand({ Bucket: B2_BUCKET, Key: key }));
    const chunks: Uint8Array[] = [];
    for await (const c of r.Body as AsyncIterable<Uint8Array>) chunks.push(c);
    return Buffer.concat(chunks);
  } catch { return null; }
}

async function b2Delete(key: string) {
  if (!b2 || !B2_BUCKET) return;
  try { await b2.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: key })); } catch {}
}

async function b2ListRecordings(): Promise<any[]> {
  if (!b2 || !B2_BUCKET) return [];
  try {
    const r = await b2.send(new ListObjectsV2Command({ Bucket: B2_BUCKET, Prefix: 'recordings/' }));
    const jsonFiles = (r.Contents || []).filter(o => o.Key?.endsWith('.meta.json'));
    const metas: any[] = [];
    for (const obj of jsonFiles) {
      const data = await b2Download(obj.Key!);
      if (data) {
        try { metas.push(JSON.parse(data.toString('utf8'))); } catch {}
      }
    }
    return metas.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
  } catch (e) { console.error('[B2 list]', e); return []; }
}

// Track recently-rejected pairs to avoid immediate re-match after rejection
const rejectedPairs = new Map<string, number>(); // "id1:id2" -> timestamp
const REJECT_COOLDOWN = 30 * 1000; // 30 seconds cooldown after rejection

function markRejected(id1: string, id2: string) {
  const key = [id1, id2].sort().join(':');
  rejectedPairs.set(key, Date.now());
}

function wereRecentlyRejected(id1: string, id2: string): boolean {
  const key = [id1, id2].sort().join(':');
  const ts = rejectedPairs.get(key);
  if (!ts) return false;
  if (Date.now() - ts > REJECT_COOLDOWN) {
    rejectedPairs.delete(key);
    return false;
  }
  return true;
}

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
  console.log(`[Matching] Checking queue. Length: ${waiting.length}. Peers: ${waiting.join(', ')}`);
  
  for (let i = 0; i < waiting.length; i++) {
    for (let j = i + 1; j < waiting.length; j++) {
      const id1 = waiting[i];
      const id2 = waiting[j];
      const p1 = peers.get(id1);
      const p2 = peers.get(id2);
      
      if (!p1 || !p2) {
        console.log(`[Matching] Peer missing: p1=${!!p1}, p2=${!!p2}`);
        continue;
      }
      
      const compatible = isCompatible(p1, p2);
      const rejected = wereRecentlyRejected(id1, id2);
      
      console.log(`[Matching] Comparing ${id1} (${p1.name}) & ${id2} (${p2.name}): Compatible=${compatible}, Rejected=${rejected}`);
      
      if (!compatible) continue;
      if (rejected) continue;

      console.log(`[Matching] FOUND MATCH: ${id1} <-> ${id2}`);

      const qi1 = waitingQueue.indexOf(id1);
      if (qi1 !== -1) waitingQueue.splice(qi1, 1);
      const qi2 = waitingQueue.indexOf(id2);
      if (qi2 !== -1) waitingQueue.splice(qi2, 1);

      p1.partnerId = id2;
      p2.partnerId = id1;
      
      console.log(`[Matching] Sending "matched" events to both peers`);
      sseEvent(p1.res, { type: "matched", role: "caller", peer: { name: p2.name, avatar: p2.avatar, userId: p2.userId } });
      sseEvent(p2.res, { type: "matched", role: "callee", peer: { name: p1.name, avatar: p1.avatar, userId: p1.userId } });
      
      matchPeers();
      return;
    }
  }
}

function removePeer(peerId: string) {
  const peer = peers.get(peerId);
  if (!peer) return;
  
  const partnerId = peer.partnerId;
  if (partnerId) {
    const partner = peers.get(partnerId);
    if (partner) {
      console.log(`[RemovePeer] Peer ${peerId} leaving. Partner ${partnerId} being reset to waiting.`);
      lastPeers.set(peer.name,    { partnerName: partner.name, partnerAvatar: partner.avatar, ts: Date.now() });
      lastPeers.set(partner.name, { partnerName: peer.name,    partnerAvatar: peer.avatar,    ts: Date.now() });
      
      partner.partnerId = null;
      sseEvent(partner.res, { type: "peer-left" });
      
      // Ensure partner is put back in waiting queue
      if (!waitingQueue.includes(partnerId)) {
        waitingQueue.push(partnerId);
      }
      sseEvent(partner.res, { type: "waiting" });
    }
  }
  
  const qi = waitingQueue.indexOf(peerId);
  if (qi !== -1) waitingQueue.splice(qi, 1);
  peers.delete(peerId);
  
  // Try to match remaining peers
  matchPeers();
}

function registerSignalingRoutes(app: express.Express) {
  app.get("/api/signal/connect", async (req: Request, res: Response) => {
    const peerId        = req.query.peerId        as string;
    const name          = (req.query.name          as string) || "مستخدم";
    const avatar        = (req.query.avatar        as string) || "";
    const gender        = (req.query.gender        as string) || "other";
    const filterGender  = (req.query.filterGender  as string) || "any";
    const filterCountry = (req.query.filterCountry as string) || "any";
    const userId        = req.query.userId ? parseInt(req.query.userId as string) : undefined;

    if (!peerId) { res.status(400).json({ error: "peerId required" }); return; }

    removePeer(peerId);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // ── Server-side Radar star validation ────────────────────────────────────
    if (userId && userId > 0) {
      const isPaidFilter = filterGender !== 'any' || filterCountry !== 'any';
      if (isPaidFilter) {
        const { getUserCountryAndWallet, deductStars } = await import('../db');
        const { country: userCountry, wallet } = await getUserCountryAndWallet(userId);
        const isOwnCountry = userCountry && filterCountry !== 'any' && filterCountry.toUpperCase() === userCountry.toUpperCase();
        const actuallyPaid = filterGender !== 'any' || (filterCountry !== 'any' && !isOwnCountry);
        if (actuallyPaid) {
          if (wallet < 5) {
            sseEvent(res, { type: 'radar-blocked', message: `رصيدك ${wallet} نجمة فقط. تحتاج 5 نجوم لاستخدام الرادار. اشحن الآن!` });
            res.end();
            return;
          }
          const ok = await deductStars(userId, 5);
          if (!ok) {
            sseEvent(res, { type: 'radar-blocked', message: 'رصيد نجوم غير كافٍ لاستخدام الرادار. اشحن الآن!' });
            res.end();
            return;
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    peers.set(peerId, { res, name, avatar, gender, filterGender, filterCountry, userId, partnerId: null });
    waitingQueue.push(peerId);
    sseEvent(res, { type: "waiting" });
    matchPeers();

    const last = lastPeers.get(name);
    if (last && Date.now() - last.ts < NOTIF_TTL) {
      const partnerWaiting = Array.from(peers.values()).find(
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

    const keepAlive = setInterval(() => {
      if (!res.writableEnded) res.write(": ping\n\n");
      else clearInterval(keepAlive);
    }, 20000);

    req.on("close", () => {
      removePeer(peerId);
      clearInterval(keepAlive);
    });
  });

  app.post("/api/signal/send", express.json(), (req: Request, res: Response) => {
    const { peerId, type, data, text } = req.body as {
      peerId: string; type: string; data?: unknown; text?: string;
    };

    const peer = peers.get(peerId);
    if (!peer) { res.json({ ok: false, reason: "peer not found" }); return; }

    // ── Admin monitoring signals ──────────────────────────────────────────
    if (type === "admin-watch-offer" || type === "admin-watch-ice") {
      const watcherId = (data as any)?.watcherId;
      if (watcherId) {
        const watcher = adminWatchers.get(watcherId);
        if (watcher && !watcher.res.writableEnded) {
          if (type === "admin-watch-offer") {
            sseEvent(watcher.res, { type: "watch-offer", data: (data as any).offer });
          } else {
            sseEvent(watcher.res, { type: "watch-ice", data: (data as any).candidate });
          }
        }
      }
      res.json({ ok: true });
      return;
    }

    if (type === "next") {
      if (peer.partnerId) {
        const partnerId = peer.partnerId;
        const partner = peers.get(partnerId);
        if (partner) {
          // Mark this pair as recently rejected to avoid immediate re-match
          markRejected(peerId, partnerId);
          partner.partnerId = null;
          sseEvent(partner.res, { type: "peer-left" });
          if (!waitingQueue.includes(partnerId)) {
            waitingQueue.push(partnerId);
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
    } else     if (type === "friend-request") {
      sseEvent(partner.res, {
        type: "friend-request",
        fromName: peer.name,
        fromAvatar: peer.avatar,
        fromPeerId: peerId,
      });
      // Also send to persistent notification system if users are logged in
      if (peer.userId && partner.userId) {
        sendUserNotification(String(partner.userId), {
          type: "friend-request",
          fromName: peer.name,
          fromAvatar: peer.avatar,
          ts: Date.now(),
        });
      }
    } else if (type === "friend-accepted") {
      sseEvent(partner.res, {
        type: "friend-accepted",
        fromName: peer.name,
        fromAvatar: peer.avatar,
      });
      // Also send to persistent notification system if users are logged in
      if (peer.userId && partner.userId) {
        sendUserNotification(String(partner.userId), {
          type: "friend-accepted",
          fromName: peer.name,
          fromAvatar: peer.avatar,
          ts: Date.now(),
        });
      }
    } else {
      sseEvent(partner.res, { type, data });
    }
    res.json({ ok: true });
  });
}

// ── Recording Routes ──────────────────────────────────────────────────────────

function registerRecordingRoutes(app: express.Express) {
  const recordingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many recording uploads, please try again later.' },
  });

  // Receive a video chunk — chunks assembled in /tmp, then uploaded to B2 on final
  app.post('/api/record/chunk', recordingLimiter, express.raw({ type: '*/*', limit: '20mb' }), async (req: Request, res: Response) => {
    const { sessionId, isFinal, name1, name2, peerId } = req.query as Record<string, string>;
    if (
      !sessionId ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId) ||
      !peerId ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(peerId)
    ) {
      res.status(400).json({ ok: false, reason: 'invalid recording identifiers' });
      return;
    }
    if (!peers.has(peerId)) {
      res.status(403).json({ ok: false, reason: 'peer not active' });
      return;
    }

    const chunk = req.body as Buffer;
    if (!chunk || chunk.length === 0) { res.json({ ok: true }); return; }

    const filePath = path.join(REC_DIR, `${sessionId}.webm`);
    const metaPath = path.join(REC_DIR, `${sessionId}.json`);

    try {
      const currentSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
      if (currentSize + chunk.length > MAX_RECORDING_BYTES) {
        res.status(413).json({ ok: false, reason: 'recording too large' });
        return;
      }
      fs.appendFileSync(filePath, chunk);
      let meta: Record<string, unknown> = {};
      if (fs.existsSync(metaPath)) {
        try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch {}
      }
      if (!meta.startTime) {
        meta = { sessionId, startTime: Date.now(), name1: name1 || '?', name2: name2 || '?' };
      }
      if (isFinal === 'true') {
        meta.endTime = Date.now();
        meta.size = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
        fs.writeFileSync(metaPath, JSON.stringify(meta));

        // Upload to Backblaze B2 permanently
        if (b2) {
          try {
            const videoBuffer = fs.readFileSync(filePath);
            const metaBuffer  = Buffer.from(JSON.stringify(meta));
            await b2Upload(`recordings/${sessionId}.webm`, videoBuffer, 'video/webm');
            await b2Upload(`recordings/${sessionId}.meta.json`, metaBuffer, 'application/json');
            // Clean up /tmp after successful upload
            try { fs.unlinkSync(filePath); } catch {}
            try { fs.unlinkSync(metaPath); } catch {}
            console.log(`[B2] Uploaded recording ${sessionId} (${Math.round((meta.size as number)/1024)}KB)`);
          } catch (e) {
            console.error('[B2] Upload failed — recording stays in /tmp', e);
          }
        }
      } else {
        fs.writeFileSync(metaPath, JSON.stringify(meta));
      }
    } catch (e) { console.error('[record]', e); }
    res.json({ ok: true });
  });

  // List recordings — from B2 if configured, else from /tmp
  app.get('/api/admin/recordings', async (req: Request, res: Response) => {
    const token = req.query.token as string;
    if (!validateAdminToken(token)) { res.status(403).json({ error: 'forbidden' }); return; }
    try {
      if (b2) {
        const recs = await b2ListRecordings();
        res.json({ recordings: recs, source: 'b2' });
      } else {
        const files = fs.readdirSync(REC_DIR).filter((f: string) => f.endsWith('.json'));
        const recs = files.map((f: string) => {
          try {
            const meta = JSON.parse(fs.readFileSync(path.join(REC_DIR, f), 'utf8'));
            const webm = path.join(REC_DIR, f.replace('.json', '.webm'));
            const size = fs.existsSync(webm) ? fs.statSync(webm).size : 0;
            return { ...meta, size };
          } catch { return null; }
        }).filter(Boolean).sort((a: any, b: any) => (b.startTime || 0) - (a.startTime || 0));
        res.json({ recordings: recs, source: 'tmp' });
      }
    } catch { res.json({ recordings: [] }); }
  });

  // Stream / download — from B2 if configured
  app.get('/api/admin/recording/:id', async (req: Request, res: Response) => {
    const token = req.query.token as string;
    if (!validateAdminToken(token)) { res.status(403).send('forbidden'); return; }
    const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
    const isDownload = req.query.dl === '1';

    if (b2) {
      const data = await b2Download(`recordings/${id}.webm`);
      if (!data) { res.status(404).send('not found'); return; }
      res.setHeader('Content-Type', 'video/webm');
      res.setHeader('Content-Length', data.length);
      if (isDownload) res.setHeader('Content-Disposition', `attachment; filename="${id}.webm"`);
      res.send(data);
    } else {
      const filePath = path.join(REC_DIR, `${id}.webm`);
      if (!fs.existsSync(filePath)) { res.status(404).send('not found'); return; }
      const stat = fs.statSync(filePath);
      res.setHeader('Content-Type', 'video/webm');
      res.setHeader('Content-Length', stat.size);
      if (isDownload) res.setHeader('Content-Disposition', `attachment; filename="${id}.webm"`);
      fs.createReadStream(filePath).pipe(res);
    }
  });

  // Delete — from B2 + /tmp
  app.delete('/api/admin/recording/:id', async (req: Request, res: Response) => {
    const token = req.query.token as string;
    if (!validateAdminToken(token)) { res.status(403).json({ error: 'forbidden' }); return; }
    const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
    await b2Delete(`recordings/${id}.webm`);
    await b2Delete(`recordings/${id}.meta.json`);
    try { fs.unlinkSync(path.join(REC_DIR, `${id}.webm`)); } catch {}
    try { fs.unlinkSync(path.join(REC_DIR, `${id}.json`)); } catch {}
    res.json({ ok: true });
  });
}

// ── Admin Live Call Monitor ───────────────────────────────────────────────────

function validateAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) return false;
    const expected = crypto
      .createHmac('sha256', adminSecret)
      .update('admin-session')
      .digest('hex');
    const provided = Buffer.from(token, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    return provided.length === expectedBuffer.length &&
      crypto.timingSafeEqual(provided, expectedBuffer);
  } catch { return false; }
}

function getAdminToken(req: Request): string | undefined {
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    return undefined;
  }
  const token = authorization.slice('Bearer '.length).trim();
  return token || undefined;
}

function registerAdminMonitorRoutes(app: express.Express) {
  // List active paired calls
  app.get("/api/admin/active-calls", (req: Request, res: Response) => {
    const token = getAdminToken(req);
    if (!validateAdminToken(token)) { res.status(403).json({ error: "forbidden" }); return; }

    const calls: Array<{
      peerId1: string; name1: string; avatar1: string; userId1?: number;
      peerId2: string; name2: string; avatar2: string; userId2?: number;
    }> = [];
    const seen = new Set<string>();
    peers.forEach((peer, id) => {
      if (!peer.partnerId || seen.has(id)) return;
      const partner = peers.get(peer.partnerId);
      if (!partner) return;
      seen.add(id);
      seen.add(peer.partnerId);
      calls.push({
        peerId1: id,            name1: peer.name,    avatar1: peer.avatar,    userId1: peer.userId,
        peerId2: peer.partnerId, name2: partner.name, avatar2: partner.avatar, userId2: partner.userId,
      });
    });
    res.json({ calls, online: peers.size, waiting: waitingQueue.length });
  });

  // Admin SSE: receive offer/ICE forwarded from peer
  app.get("/api/admin/watch-stream", (req: Request, res: Response) => {
    const token = getAdminToken(req);
    const targetPeerId = req.query.targetPeerId as string;
    const watcherId = req.query.watcherId as string;
    if (!validateAdminToken(token) || !targetPeerId || !watcherId) {
      res.status(403).json({ error: "forbidden" }); return;
    }
    const targetPeer = peers.get(targetPeerId);
    if (!targetPeer) { res.status(404).json({ error: "peer not found" }); return; }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    adminWatchers.set(watcherId, { res, targetPeerId });

    // Signal the target peer to start streaming to admin
    sseEvent(targetPeer.res, { type: "admin-watch-request", watcherId });

    const keepAlive = setInterval(() => {
      if (!res.writableEnded) res.write(": ping\n\n");
      else clearInterval(keepAlive);
    }, 20000);

    req.on("close", () => {
      adminWatchers.delete(watcherId);
      clearInterval(keepAlive);
      const peer = peers.get(targetPeerId);
      if (peer) sseEvent(peer.res, { type: "admin-watch-stop", watcherId });
    });
  });

  // Admin sends answer or ICE back to peer
  app.post("/api/admin/watch-signal", express.json(), (req: Request, res: Response) => {
    const { watcherId, type, data } = req.body as {
      watcherId: string; type: string; data: unknown;
    };
    const token = getAdminToken(req);
    if (!validateAdminToken(token)) { res.status(403).json({ error: "forbidden" }); return; }

    const watcher = adminWatchers.get(watcherId);
    if (!watcher) { res.json({ ok: false, reason: "watcher not found" }); return; }

    const peer = peers.get(watcher.targetPeerId);
    if (!peer) { res.json({ ok: false, reason: "peer gone" }); return; }

    if (type === "answer") {
      sseEvent(peer.res, { type: "admin-watch-answer", data });
    } else if (type === "ice") {
      sseEvent(peer.res, { type: "admin-watch-ice-to-peer", data });
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function startServer() {
  // 🔒 Validate critical secrets immediately — exits if misconfigured
  validateEnv();

  const app = express();
  const server = createServer(app);

  // 🔒 Optimize server timeouts — prevent slow connections from blocking
  server.keepAliveTimeout = 30 * 1000; // 30s (default is 5min — too long for free tier)
  server.headersTimeout = 35 * 1000;

  app.set("trust proxy", 1);

  // 🔒 Security headers via helmet
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // 🔒 Rate limiting on sensitive endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // Increased from 20 — users need multiple attempts on cold-start servers
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/trpc/users.guestLogin', authLimiter);
  app.use('/api/trpc/admin.verifyAdmin', authLimiter);
  app.use('/api/trpc', generalLimiter);

  // 🔒 CORS — allow all origins (safe for WebSSE signaling + tRPC)
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerSignalingRoutes(app);
  registerRecordingRoutes(app);
  registerAdminMonitorRoutes(app);
  registerNotifyRoutes(app);

  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  // Health check — Render polls this to confirm the server is up.
  // IMPORTANT: registered BEFORE ensureSchema() so /ping responds even while
  // the DB migration is still running in the background.
  app.get("/ping", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ts: Date.now() });
  });

  // ── Wake DB endpoint — admin-only DB health check that forces connection ──
  app.get("/api/wake-db", async (_req, res) => {
    // Extended timeout for this endpoint since it may need to wake the DB
    const timeout = setTimeout(() => {
      res.json({ ok: false, status: 'timeout', message: 'قاعدة البيانات لم تستجب خلال 60 ثانية. قد تكون نائمة أو URL خاطئ.' });
    }, 60_000);
    try {
      const { getDb } = await import('../db');
      const db = await getDb();
      if (!db) {
        clearTimeout(timeout);
        return res.json({ ok: false, status: 'no_connection', message: 'قاعدة البيانات غير متصلة. تأكد من DATABASE_URL في إعدادات Render. DATABASE_URL: ' + (process.env.DATABASE_URL ? '✅ موجود' : '❌ غير مضبوط') });
      }
      // Force a query to wake up the DB with retry
      let count = 0;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const result = await db.execute(sql`SELECT count(*)::int FROM users`);
          count = (result as any)?.[0]?.count ?? 0;
          break;
        } catch {
          if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 5000));
        }
      }
      clearTimeout(timeout);
      res.json({ ok: true, status: 'awake', userCount: count });
    } catch (err: any) {
      clearTimeout(timeout);
      res.json({ ok: false, status: 'error', message: err.message || String(err) });
    }
  });

  // Version endpoint — returns server start time so clients can detect new deploys
  // Registered BEFORE tRPC middleware so it responds instantly
  const SERVER_VERSION = Date.now().toString();
  app.get("/api/version", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({ version: SERVER_VERSION });
  });

  // ── DB Keep-alive: ping database every 3 minutes to keep connection alive ──
  const dbKeepAlive = async () => {
    try {
      const { getDb } = await import('../db');
      const db = await getDb();
      if (!db) { 
        console.warn('[db-keepalive] no DB connection, will retry next interval'); 
        return; 
      }
      await db.execute(sql`SELECT 1`);
      console.log('[db-keepalive] database ping OK');
    } catch (err) {
      console.warn('[db-keepalive] database ping failed (DB may be sleeping):', err instanceof Error ? err.message : String(err));
    }
  };
  // Start after 15 seconds, then every 3 minutes
  const DB_INTERVAL_MS = 3 * 60 * 1000;
  setTimeout(dbKeepAlive, 15 * 1000);
  setInterval(dbKeepAlive, DB_INTERVAL_MS);
  console.log('[db-keepalive] scheduled every 3 min to keep DB connection alive');

  // ── Server Self-ping: prevents Render free tier from spinning down the service ──
  // Render spins down free web services after 15 min of no inbound traffic.
  // By pinging our own public URL every 8 minutes we count as inbound traffic
  // and the server NEVER sleeps. RENDER_EXTERNAL_URL is set automatically by Render.
  const SELF_PING_INTERVAL_MS = 8 * 60 * 1000; // 8 min — well under Render's 15-min limit
  const selfPing = async () => {
    const externalUrl = process.env.RENDER_EXTERNAL_URL;
    if (!externalUrl) return; // only active on Render (env var not set locally)
    try {
      const res = await fetch(`${externalUrl}/ping`, { signal: AbortSignal.timeout(15_000) });
      console.log(`[self-ping] ${res.status} — server staying awake (${new Date().toISOString()})`);
    } catch (err) {
      console.warn('[self-ping] failed (will retry next interval):', (err as Error).message);
    }
  };
  // First self-ping after 15 seconds (minimise the startup window where server could sleep),
  // then every 8 minutes permanently.
  setTimeout(selfPing, 15_000);
  setInterval(selfPing, SELF_PING_INTERVAL_MS);
  console.log('[self-ping] scheduled: first in 15 s, then every 8 min — Render service stays awake');

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number.parseInt(process.env.PORT || "3000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}`);
  }

  // ── Bind port FIRST so Render's health check on /ping passes immediately ──
  await new Promise<void>((resolve, reject) => {
    server.listen(port, "0.0.0.0", () => {
      console.log(`[Startup] Server listening on port ${port}`);
      resolve();
    });
    server.on("error", reject);
  });

  // 🔒 Run ensureSchema with generous timeout and retries — DB may need time to connect
  // Render/Neon databases can take 30-90 seconds to wake from sleep
  const SCHEMA_TIMEOUT = 120000;
  const MAX_SCHEMA_RETRIES = 3;
  console.log('[Startup] Running ensureSchema (with retry)...');
  for (let attempt = 1; attempt <= MAX_SCHEMA_RETRIES; attempt++) {
    try {
      await Promise.race([
        ensureSchema(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SCHEMA_TIMEOUT')), SCHEMA_TIMEOUT))
      ]);
      console.log('[Startup] ensureSchema completed successfully');
      break;
    } catch (err: any) {
      console.error(`[Startup] ensureSchema attempt ${attempt} failed:`, err.message);
      if (attempt < MAX_SCHEMA_RETRIES) {
        const delay = 5000 * attempt;
        console.log(`[Startup] Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
}

startServer().catch((error) => {
  console.error("[Startup] Server failed to start:", error);
  process.exitCode = 1;
});
