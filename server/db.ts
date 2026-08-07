import { and, desc, eq, isNotNull, ne, or, sql, gt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { InsertUser, users, InsertMessage, messages, gifts, friendRequests, friends, notifications, paymentRequests, stories, InsertStory, storyComments, storyViews, InsertStoryComment, InsertStoryView } from '../drizzle/schema';
import { ENV } from './_core/env';

/** Strip query params unsupported by postgres.js (e.g. channel_binding from Neon) */
function cleanDbUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete('channel_binding');
    // sslmode is handled by the ssl option below, remove to avoid conflict
    u.searchParams.delete('sslmode');
    return u.toString();
  } catch {
    return url;
  }
}

/** Retry DB connection with exponential backoff */
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;

async function connectWithRetry(url: string): Promise<ReturnType<typeof postgres>> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_CONNECTION_ATTEMPTS; attempt++) {
    try {
      connectionAttempts = attempt;
      const client = postgres(url, {
        ssl: { rejectUnauthorized: false },
        max: 5,
        connect_timeout: 90,
        idle_timeout: 60,
        max_lifetime: 60 * 30,
        onnotice: () => {},
      });
      // Force a real query to verify connection (not just pool creation)
      await client`SELECT 1`;
      console.log(`[Database] Connected successfully (attempt ${attempt})`);
      connectionAttempts = 0;
      return client;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Database] Connection attempt ${attempt}/${MAX_CONNECTION_ATTEMPTS} failed:`, err.message);
      if (attempt < MAX_CONNECTION_ATTEMPTS) {
        await new Promise(r => setTimeout(r, Math.min(2000 * attempt, 10000)));
      }
    }
  }
  throw lastError!;
}

let _db: ReturnType<typeof drizzle> | null = null;
let _rawClient: ReturnType<typeof postgres> | null = null;

export async function getDb() {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!_db && dbUrl) {
    try {
      const url = cleanDbUrl(dbUrl);
      _rawClient = await connectWithRetry(url);
      _db = drizzle(_rawClient);
    } catch (error) {
      console.warn('[Database] Failed to connect after all retries:', error);
      _db = null;
    }
  }
  return _db;
}

/**
 * Creates all required tables if they don't exist yet.
 * Safe to call on every startup — uses IF NOT EXISTS / DO NOTHING.
 * This replaces the need for drizzle-kit CLI in production.
 */
export async function ensureSchema(): Promise<void> {
  try {
    const db = await getDb();
    if (!db || !_rawClient) {
      console.warn('[Database] ensureSchema skipped: no DB connection');
      return;
    }

  // Create enums — no dollar-quoting needed: catch the "already exists" error in JS
  const enums: Array<[string, string]> = [
    ['gender', `'male', 'female', 'other'`],
    ['role',   `'user', 'admin'`],
  ];
  for (const [typeName, values] of enums) {
    try {
      await _rawClient.unsafe(`CREATE TYPE "${typeName}" AS ENUM (${values})`);
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      if (!msg.includes('already exists')) {
        console.warn(`[Database] Could not create enum "${typeName}":`, msg);
      }
    }
  }

  // Create tables (IF NOT EXISTS is safe to run repeatedly)
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
       id            SERIAL PRIMARY KEY,
       "openId"      VARCHAR(64) NOT NULL UNIQUE,
       name          TEXT,
       email         VARCHAR(320),
       age           INTEGER,
       gender        gender,
       avatar        TEXT,
       bio           TEXT,
       credits       INTEGER NOT NULL DEFAULT 100,
       wallet        INTEGER NOT NULL DEFAULT 0,
       "isPremium"   BOOLEAN NOT NULL DEFAULT false,
       "isOnline"    BOOLEAN NOT NULL DEFAULT false,
       "lastSeen"    TIMESTAMP NOT NULL DEFAULT now(),
       "loginMethod" VARCHAR(64),
       role          "role" NOT NULL DEFAULT 'user',
       "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
       "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
       "lastSignedIn" TIMESTAMP NOT NULL DEFAULT now()
     )`,
    `CREATE TABLE IF NOT EXISTS messages (
       id           SERIAL PRIMARY KEY,
       "senderId"   INTEGER NOT NULL,
       "receiverId" INTEGER NOT NULL,
       content      TEXT NOT NULL,
       "isRead"     BOOLEAN NOT NULL DEFAULT false,
       "createdAt"  TIMESTAMP NOT NULL DEFAULT now()
     )`,
    `CREATE TABLE IF NOT EXISTS connections (
       id          SERIAL PRIMARY KEY,
       "userId1"   INTEGER NOT NULL,
       "userId2"   INTEGER NOT NULL,
       "startedAt" TIMESTAMP NOT NULL DEFAULT now(),
       "endedAt"   TIMESTAMP,
       duration    INTEGER,
       "createdAt" TIMESTAMP NOT NULL DEFAULT now()
     )`,
    `CREATE TABLE IF NOT EXISTS blocks (
       id              SERIAL PRIMARY KEY,
       "userId"        INTEGER NOT NULL,
       "blockedUserId" INTEGER NOT NULL,
       reason          TEXT,
       "createdAt"     TIMESTAMP NOT NULL DEFAULT now()
     )`,
    `CREATE TABLE IF NOT EXISTS gifts (
       id          SERIAL PRIMARY KEY,
       "senderId"  INTEGER NOT NULL,
       "receiverId" INTEGER NOT NULL,
       "giftType"  VARCHAR(50) NOT NULL,
       cost        INTEGER NOT NULL DEFAULT 0,
       "createdAt" TIMESTAMP NOT NULL DEFAULT now()
     )`,
    `CREATE TABLE IF NOT EXISTS friend_requests (
       id          SERIAL PRIMARY KEY,
       "senderId"  INTEGER NOT NULL,
       "receiverId" INTEGER NOT NULL,
       status      VARCHAR(20) NOT NULL DEFAULT 'pending',
       "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
       "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
     )`,
    `CREATE TABLE IF NOT EXISTS friends (
       id          SERIAL PRIMARY KEY,
       "userId1"   INTEGER NOT NULL,
       "userId2"   INTEGER NOT NULL,
       "createdAt" TIMESTAMP NOT NULL DEFAULT now()
     )`,
    `CREATE TABLE IF NOT EXISTS notifications (
       id          SERIAL PRIMARY KEY,
       "userId"    INTEGER NOT NULL,
       type        VARCHAR(50) NOT NULL,
       title       TEXT,
       message     TEXT,
       "fromName"  TEXT,
       "fromAvatar" TEXT,
       "isRead"    BOOLEAN NOT NULL DEFAULT false,
       "createdAt" TIMESTAMP NOT NULL DEFAULT now()
     )`,
    `CREATE TABLE IF NOT EXISTS payment_requests (
       id              SERIAL PRIMARY KEY,
       "userId"        INTEGER NOT NULL,
       amount          VARCHAR(50) NOT NULL,
       method          VARCHAR(50) NOT NULL,
       "transactionId" TEXT NOT NULL,
       status          VARCHAR(20) NOT NULL DEFAULT 'pending',
       "itemType"      VARCHAR(50) NOT NULL,
       "itemAmount"    INTEGER,
       "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
       "updatedAt"     TIMESTAMP NOT NULL DEFAULT now()
     )`,
    // 🔒 FIX: Unique index to block duplicate transaction IDs
	    `CREATE UNIQUE INDEX IF NOT EXISTS payment_requests_txid_unique ON payment_requests ("transactionId")`,
		    `CREATE TABLE IF NOT EXISTS stories (
		       id           SERIAL PRIMARY KEY,
		       "userId"     INTEGER NOT NULL,
		       "mediaUrl"   TEXT NOT NULL,
		       "mediaType"  VARCHAR(20) NOT NULL,
		       caption      TEXT,
		       "createdAt"  TIMESTAMP NOT NULL DEFAULT now(),
		       "expiresAt"  TIMESTAMP NOT NULL
		     )`,
		    `CREATE TABLE IF NOT EXISTS story_comments (
		       id           SERIAL PRIMARY KEY,
		       "storyId"    INTEGER NOT NULL,
		       "userId"     INTEGER NOT NULL,
		       content      TEXT NOT NULL,
		       "createdAt"  TIMESTAMP NOT NULL DEFAULT now()
		     )`,
		    `CREATE TABLE IF NOT EXISTS story_views (
		       id           SERIAL PRIMARY KEY,
		       "storyId"    INTEGER NOT NULL,
		       "userId"     INTEGER NOT NULL,
		       "createdAt"  TIMESTAMP NOT NULL DEFAULT now()
		     )`,
		  ];

  for (const stmt of tables) {
    try {
      await _rawClient.unsafe(stmt);
    } catch (err) {
      console.error('[Database] Failed to create table:', err);
    }
  }

  // Add missing columns to existing tables that predate these migrations.
  // Each ALTER TABLE runs separately so one failure does not block the others.
  const migrations = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS credits       INTEGER   NOT NULL DEFAULT 100`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet        INTEGER   NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS "isPremium"   BOOLEAN   NOT NULL DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS "profileViews" INTEGER  NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS country       VARCHAR(10)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS bio           TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS "isOnline"    BOOLEAN   NOT NULL DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastSeen"    TIMESTAMP NOT NULL DEFAULT now()`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastSignedIn" TIMESTAMP NOT NULL DEFAULT now()`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS "loginMethod" VARCHAR(64)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS role          "role" NOT NULL DEFAULT 'user'`,
  ];
  for (const m of migrations) {
    try { await _rawClient.unsafe(m); } catch { /* column already exists — safe to ignore */ }
  }

    console.log('[Database] Schema ready');
  } catch (err) {
    console.error('[Database] ensureSchema failed, but continuing startup:', err);
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error('User openId is required for upsert');
  }

  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot upsert user: database not available');
    return;
  }

  try {
    const _now = new Date();
    const lastSignedIn = user.lastSignedIn ?? _now;

    // Determine role: explicit > owner override > omit (let DB default apply)
    const role: InsertUser['role'] | undefined =
      user.role !== undefined
        ? user.role
        : user.openId === ENV.ownerOpenId
          ? 'admin'
          : undefined;

    // Build a single, flat insert object — avoids Drizzle v0.44 duplicate-column
    // bug where incrementally mutating InsertUser causes schema defaults to be
    // emitted twice (once from the explicit value, once from the column default).
    const insertValues: InsertUser = {
      openId: user.openId,
      isOnline: true,
      lastSeen: lastSignedIn,
      lastSignedIn,
      ...(user.name      !== undefined && { name:        user.name      ?? null }),
      ...(user.email     !== undefined && { email:       user.email     ?? null }),
      ...(user.loginMethod !== undefined && { loginMethod: user.loginMethod ?? null }),
      ...(user.country                 && { country:     user.country }),
      ...(role !== undefined           && { role }),
    };

    // The conflict update mirrors the insert (excluding openId which is the key).
    // Using `sql\`excluded."col"\`` makes Drizzle emit the exact SQL we want and
    // avoids any ORM-level double-column emission on conflict branches.
    const conflictSet: Record<string, unknown> = {
      isOnline:     sql`excluded."isOnline"`,
      lastSeen:     sql`excluded."lastSeen"`,
      lastSignedIn: sql`excluded."lastSignedIn"`,
    };
    if (user.name      !== undefined) conflictSet.name        = sql`excluded.name`;
    if (user.email     !== undefined) conflictSet.email       = sql`excluded.email`;
    if (user.loginMethod !== undefined) conflictSet.loginMethod = sql`excluded."loginMethod"`;
    if (user.country)                 conflictSet.country     = sql`excluded.country`;
    if (role !== undefined)           conflictSet.role        = sql`excluded.role`;

    await db.insert(users).values(insertValues).onConflictDoUpdate({
      target: users.openId,
      set: conflictSet,
    });
  } catch (error) {
    console.error('[Database] Failed to upsert user:', error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot get user: database not available');
    return undefined;
  }

  try {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (err) {
    console.warn('[Database] getUserByOpenId failed (table may not exist yet):', err);
    return undefined;
  }
}

export async function saveUserProfile(userId: number, data: {
  name?: string;
  age?: number;
  gender?: string;
  avatar?: string;
  bio?: string;
}) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot save user profile: database not available');
    return;
  }

  try {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.age !== undefined) updateData.age = data.age;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.bio !== undefined) updateData.bio = data.bio;
    updateData.updatedAt = new Date();

    await db.update(users).set(updateData).where(eq(users.id, userId));
  } catch (error) {
    console.error('[Database] Failed to save user profile:', error);
    throw error;
  }
}

export async function getUsersByGender(gender: 'male' | 'female' | 'other') {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot get users by gender: database not available');
    return [];
  }

  try {
    return await db.select().from(users).where(eq(users.gender, gender));
  } catch (error) {
    console.error('[Database] Failed to get users by gender:', error);
    return [];
  }
}

export async function getRecentUsers(limit = 20) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot get recent users: database not available');
    return [];
  }

  try {
    return await db
      .select({
        id: users.id,
        name: users.name,
        age: users.age,
        gender: users.gender,
        avatar: users.avatar,
        lastSignedIn: users.lastSignedIn,
        profileViews: users.profileViews,
        country: users.country,
      })
      .from(users)
      .where(isNotNull(users.name))
      .orderBy(desc(users.lastSignedIn))
      .limit(limit);
  } catch (error) {
    console.error('[Database] Failed to get recent users:', error);
    return [];
  }
}

export async function incrementProfileViews(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) { return 0; }
  try {
    const result = await db
      .update(users)
      .set({ profileViews: sql`"profileViews" + 1` })
      .where(eq(users.id, userId))
      .returning({ profileViews: users.profileViews });
    return result[0]?.profileViews ?? 0;
  } catch (error) {
    console.error('[Database] Failed to increment profileViews:', error);
    return 0;
  }
}

export async function saveMessage(senderId: number, receiverId: number, content: string) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot save message: database not available');
    throw new Error('قاعدة البيانات غير متاحة حالياً، تعذر إرسال الرسالة.');
  }

  try {
    const result = await db
      .insert(messages)
      .values({ senderId, receiverId, content, isRead: false })
      .returning({ id: messages.id });
    if (!result[0]) {
      throw new Error('تعذر حفظ الرسالة.');
    }
    return result[0];
  } catch (error) {
    console.error('[Database] Failed to save message:', error);
    throw error;
  }
}

export async function getMessages(userId1: number, userId2: number) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot get messages: database not available');
    throw new Error('قاعدة البيانات غير متاحة حالياً، تعذر تحميل الرسائل.');
  }

  try {
    return await db.select().from(messages).where(
      or(
        and(eq(messages.senderId, userId1), eq(messages.receiverId, userId2)),
        and(eq(messages.senderId, userId2), eq(messages.receiverId, userId1))
      )
    ).orderBy(messages.createdAt);
  } catch (error) {
    console.error('[Database] Failed to get messages:', error);
    return [];
  }
}

export async function getUnreadMessageCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  try {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.receiverId, userId), eq(messages.isRead, false)));
    return result[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function markMessagesRead(userId: number, senderId: number) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.update(messages)
      .set({ isRead: true })
      .where(and(eq(messages.receiverId, userId), eq(messages.senderId, senderId)));
  } catch (err) {
    console.error('[Database] markMessagesRead failed:', err);
  }
}

// ── Gifts / Credits ──────────────────────────────────────────────────────────

export async function getUserCredits(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 100;
  try {
    const result = await db.select({ credits: users.credits }).from(users).where(eq(users.id, userId)).limit(1);
    return result[0]?.credits ?? 100;
  } catch {
    return 100;
  }
}

export async function deductCredits(userId: number, amount: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const current = await getUserCredits(userId);
    if (current < amount) return false;
    await db.update(users).set({ credits: sql`${users.credits} - ${amount}` }).where(eq(users.id, userId));
    return true;
  } catch {
    return false;
  }
}

export async function deductStars(userId: number, amount: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const result = await db.select({ wallet: users.wallet }).from(users).where(eq(users.id, userId)).limit(1);
    const current = result[0]?.wallet ?? 0;
    if (current < amount) return false;
    await db.update(users).set({ wallet: sql`${users.wallet} - ${amount}` }).where(eq(users.id, userId));
    return true;
  } catch {
    return false;
  }
}

export async function getUserCountryAndWallet(userId: number): Promise<{ country: string | null; wallet: number }> {
  const db = await getDb();
  if (!db) return { country: null, wallet: 0 };
  try {
    const result = await db.select({ country: users.country, wallet: users.wallet }).from(users).where(eq(users.id, userId)).limit(1);
    return { country: result[0]?.country ?? null, wallet: result[0]?.wallet ?? 0 };
  } catch {
    return { country: null, wallet: 0 };
  }
}

export async function addCredits(userId: number, amount: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.update(users).set({ credits: sql`${users.credits} + ${amount}` }).where(eq(users.id, userId));
  } catch (err) {
    console.error('[Database] addCredits failed:', err);
  }
}

export async function saveGift(senderId: number, receiverId: number, giftType: string, cost: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.transaction(async (tx) => {
      // Deduct from sender
      await tx.update(users).set({ credits: sql`${users.credits} - ${cost}` }).where(eq(users.id, senderId));
      // Add to receiver's credit balance so their balance actually increases
      if (receiverId > 0) {
        await tx.update(users).set({ credits: sql`${users.credits} + ${cost}` }).where(eq(users.id, receiverId));
      }
      // Log gift
      await tx.insert(gifts).values({ senderId, receiverId, giftType, cost });
    });
  } catch (err) {
    console.error('[Database] saveGift failed:', err);
  }
}

export async function getNewRegistrations(limit = 50): Promise<Array<{
  id: number; name: string | null; country: string | null; avatar: string | null;
  gender: string | null; age: number | null; role: 'user' | 'admin';
  createdAt: Date; lastSignedIn: Date; loginMethod: string | null; isPremium: boolean;
  isOnline: boolean; lastSeen: Date;
}>> {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] getNewRegistrations: no DB connection');
    return [];
  }
  try {
    return await db
      .select({
        id: users.id, name: users.name, country: users.country, avatar: users.avatar,
        gender: users.gender, age: users.age, role: users.role,
        createdAt: users.createdAt, lastSignedIn: users.lastSignedIn, loginMethod: users.loginMethod,
        isPremium: users.isPremium,
        isOnline: users.isOnline,
        lastSeen: users.lastSeen,
      })
      .from(users)
      .orderBy(desc(users.lastSignedIn), desc(users.createdAt), desc(users.id))
      .limit(limit);
  } catch (err) {
    console.error('[Database] getNewRegistrations failed:', err);
    return [];
  }
}

export async function getCountryStats(): Promise<Array<{ country: string; count: number }>> {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] getCountryStats: no DB connection');
    return [];
  }
  try {
    const rows = await db
      .select({ country: users.country, count: sql<number>`cast(count(*) as int)` })
      .from(users)
      .where(isNotNull(users.country))
      .groupBy(users.country)
      .orderBy(desc(sql`count(*)`));
    return rows.filter(r => r.country).map(r => ({ country: r.country!, count: r.count }));
  } catch (err) {
    console.error('[Database] getCountryStats failed:', err);
    return [];
  }
}

export async function upgradeToPremium(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.update(users).set({ 
      isPremium: true,
      credits: sql`${users.credits} + 100` // 100 points as bonus for premium
    }).where(eq(users.id, userId));
  } catch (err) {
    console.error('[Database] upgradeToPremium failed:', err);
    throw err;
  }
}

// ── Social System Functions ──────────────────────────────────────────────────

export async function getUserPublicProfile(userId: number) {
  const dbConn = await getDb();
  if (!dbConn) return null;
  try {
    const rows = await dbConn.select({
      id: users.id,
      name: users.name,
      age: users.age,
      gender: users.gender,
      avatar: users.avatar,
      bio: users.bio,
      country: users.country,
      isPremium: users.isPremium,
      isOnline: users.isOnline,
      profileViews: users.profileViews,
      createdAt: users.createdAt,
      role: users.role,
      // wallet و credits لا تُرسل للعملاء — مخفية من السيرفر
    }).from(users).where(eq(users.id, userId)).limit(1);
    const profile = rows[0] ?? null;
    // الأدمن لا يمكن رؤية ملفه الشخصي من قِبل أي أحد
    if (profile?.role === 'admin') return null;
    return profile;
  } catch (err) {
    console.error('[Database] getUserPublicProfile failed:', err);
    return null;
  }
}

export async function getFriendStatus(userId: number, targetId: number): Promise<'none' | 'pending' | 'friends'> {
  const dbConn = await getDb();
  if (!dbConn || userId <= 0 || targetId <= 0) return 'none';
  try {
    // check friends table
    const fr = await dbConn.select().from(friends)
      .where(sql`("userId1" = ${userId} AND "userId2" = ${targetId}) OR ("userId1" = ${targetId} AND "userId2" = ${userId})`)
      .limit(1);
    if (fr.length > 0) return 'friends';
    // check pending requests
    const req = await dbConn.select().from(friendRequests)
      .where(sql`(("senderId" = ${userId} AND "receiverId" = ${targetId}) OR ("senderId" = ${targetId} AND "receiverId" = ${userId})) AND status = 'pending'`)
      .limit(1);
    if (req.length > 0) return 'pending';
    return 'none';
  } catch {
    return 'none';
  }
}

export async function createFriendRequest(senderId: number, receiverId: number) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(friendRequests).values({ senderId, receiverId, status: 'pending' });
  } catch (err) {
    console.error('[Database] createFriendRequest failed:', err);
  }
}

export async function acceptFriendRequest(senderId: number, receiverId: number) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.transaction(async (tx) => {
      await tx.update(friendRequests)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(sql`"senderId" = ${senderId} AND "receiverId" = ${receiverId}`);
      await tx.insert(friends).values({ userId1: senderId, userId2: receiverId });
    });
  } catch (err) {
    console.error('[Database] acceptFriendRequest failed:', err);
  }
}

export async function getIncomingFriendRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    const pending = await db.select().from(friendRequests)
      .where(sql`"receiverId" = ${userId} AND status = 'pending'`)
      .orderBy(desc(friendRequests.createdAt));
    if (pending.length === 0) return [];
    const senderIds = pending.map(r => r.senderId);
    const senders = await db.select().from(users).where(sql`id IN (${sql.join(senderIds, sql`, `)})`);
    const senderMap = new Map(senders.map(s => [s.id, s]));
    return pending.map(r => {
      const sender = senderMap.get(r.senderId);
      return {
        requestId: r.id,
        senderId: r.senderId,
        name: sender?.name || 'مستخدم',
        avatar: sender?.avatar || '',
        createdAt: r.createdAt,
      };
    });
  } catch (err) {
    console.error('[Database] getIncomingFriendRequests failed:', err);
    return [];
  }
}

export async function getFriends(userId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    const userFriends = await db.select().from(friends).where(or(eq(friends.userId1, userId), eq(friends.userId2, userId)));
    const friendIds = userFriends.map(f => f.userId1 === userId ? f.userId2 : f.userId1);
    if (friendIds.length === 0) return [];
    return await db.select().from(users).where(sql`${users.id} IN (${sql.join(friendIds, sql`, `)})`);
  } catch (err) {
    console.error('[Database] getFriends failed:', err);
    return [];
  }
}

// ── Payment Requests ──────────────────────────────────────────────────────────

export async function createPaymentRequest(data: {
  userId: number;
  amount: string;
  method: string;
  transactionId: string;
  itemType: string;
  itemAmount?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 🔒 FIX: Block duplicate transaction IDs — one TXID can only be used once
  const existing = await db
    .select({ id: paymentRequests.id })
    .from(paymentRequests)
    .where(eq(paymentRequests.transactionId, data.transactionId))
    .limit(1);
  if (existing.length > 0) {
    throw new Error('رقم المعاملة مستخدم بالفعل. يرجى التأكد من إدخال رقم صحيح وفريد.');
  }

  await db.insert(paymentRequests).values({
    ...data,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function getPendingPaymentRequests() {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    id: paymentRequests.id,
    userId: paymentRequests.userId,
    userName: users.name,
    amount: paymentRequests.amount,
    method: paymentRequests.method,
    transactionId: paymentRequests.transactionId,
    status: paymentRequests.status,
    itemType: paymentRequests.itemType,
    itemAmount: paymentRequests.itemAmount,
    createdAt: paymentRequests.createdAt,
  })
  .from(paymentRequests)
  .leftJoin(users, eq(paymentRequests.userId, users.id))
  .where(eq(paymentRequests.status, 'pending'))
  .orderBy(desc(paymentRequests.createdAt));
}

export async function updatePaymentRequestStatus(requestId: number, status: 'approved' | 'rejected') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const request = await db.select().from(paymentRequests).where(eq(paymentRequests.id, requestId)).limit(1);
  if (!request[0]) throw new Error("Payment request not found");
  
  await db.transaction(async (tx) => {
    await tx.update(paymentRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(paymentRequests.id, requestId));
      
    if (status === 'approved') {
      const { userId, itemType, itemAmount } = request[0];
      if (itemType === 'vip') {
        await tx.update(users).set({ isPremium: true }).where(eq(users.id, userId));
        await createNotification(userId, {
          type: 'system',
          title: '🎉 تم تفعيل VIP!',
          message: 'تمت الموافقة على طلب الدفع الخاص بك. استمتع بميزات Premium الآن!',
        });
      } else if (itemType === 'stars' && itemAmount) {
        await tx.update(users).set({ wallet: sql`${users.wallet} + ${itemAmount}` }).where(eq(users.id, userId));
        await createNotification(userId, {
          type: 'system',
          title: '⭐ تم شحن النجوم!',
          message: `تمت الموافقة على طلبك وإضافة ${itemAmount} نجمة إلى محفظتك.`,
        });
      }
    } else {
      await createNotification(request[0].userId, {
        type: 'system',
        title: '❌ تم رفض طلب الدفع',
        message: 'للأسف تم رفض طلب الدفع الخاص بك. يرجى التأكد من رقم المعاملة والمحاولة مرة أخرى.',
      });
    }
  });
}

// ── Notification System Functions ────────────────────────────────────────────

export async function createNotification(userId: number, data: {
  type: string;
  title?: string;
  message?: string;
  fromName?: string;
  fromAvatar?: string;
}) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(notifications).values({ userId, ...data, isRead: false });
  } catch (err) {
    console.error('[Database] createNotification failed:', err);
  }
}

export async function getNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  } catch (err) {
    console.error('[Database] getNotifications failed:', err);
    return [];
  }
}

export async function markNotificationsAsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  } catch (err) {
    console.error('[Database] markNotificationsAsRead failed:', err);
  }
}


export async function getTotalUsersCount(): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] getTotalUsersCount: no DB connection');
    return 0;
  }
  try {
    const result = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(users);
    return result[0]?.count ?? 0;
  } catch (err) {
    console.error('[Database] getTotalUsersCount failed:', err);
    return 0;
  }
}

export async function getOnlineUsersCount(): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] getOnlineUsersCount: no DB connection');
    return 0;
  }
  try {
    // Restore original 60 minutes window for stability
    const activeThreshold = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes is a good balance
    const result = await db.select({ count: sql<number>`cast(count(*) as int)` })
      .from(users)
      .where(sql`(${users.isOnline} = true OR ${users.lastSeen} > ${activeThreshold} OR ${users.lastSignedIn} > ${activeThreshold})`);
    const count = result[0]?.count ?? 0;
    
    // Maintain a minimum of 1-2 if users exist, as per original logic
    if (count === 0) {
      const totalRes = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(users);
      const total = totalRes[0]?.count ?? 0;
      return total > 0 ? Math.min(total, 2) : 0;
    }
    return count;
  } catch (err) {
    console.error('[Database] getOnlineUsersCount failed:', err);
    return 0;
  }
}

export async function getPremiumCount(): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] getPremiumCount: no DB connection');
    return 0;
  }
  try {
    const result = await db.select({ count: sql<number>`cast(count(*) as int)` })
      .from(users)
      .where(eq(users.isPremium, true));
    return result[0]?.count ?? 0;
  } catch (err) {
    console.error('[Database] getPremiumCount failed:', err);
    return 0;
  }
}

export async function searchUsers(query: string): Promise<Array<{
  id: number; name: string | null; country: string | null; avatar: string | null;
  gender: string | null; age: number | null; role: 'user' | 'admin';
  createdAt: Date; loginMethod: string | null; isPremium: boolean; credits: number; wallet: number;
}>> {
  const db = await getDb();
  if (!db) return [];
  try {
    const trimmed = query.trim();
    const idNum = /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : null;
    
    if (idNum !== null) {
      return await db
        .select({
          id: users.id, name: users.name, country: users.country, avatar: users.avatar,
          gender: users.gender, age: users.age, role: users.role,
          createdAt: users.createdAt, loginMethod: users.loginMethod,
          isPremium: users.isPremium, credits: users.credits, wallet: users.wallet,
        })
        .from(users)
        .where(sql`(${users.id} = ${idNum} OR lower(${users.name}) like lower(${'%' + trimmed + '%'}))`)
        .orderBy(desc(users.createdAt))
        .limit(30);
    }

    return await db
      .select({
        id: users.id, name: users.name, country: users.country, avatar: users.avatar,
        gender: users.gender, age: users.age, role: users.role,
        createdAt: users.createdAt, loginMethod: users.loginMethod,
        isPremium: users.isPremium, credits: users.credits, wallet: users.wallet,
      })
      .from(users)
      .where(sql`lower(${users.name}) like lower(${'%' + trimmed + '%'})`)
      .orderBy(desc(users.createdAt))
      .limit(30);
  } catch (err) {
    console.error('[Database] searchUsers failed:', err);
    return [];
  }
}

export async function broadcastNotificationToAll(title: string, message: string): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] broadcastNotificationToAll: no DB connection');
    return 0;
  }
  try {
    const allUsers = await db.select({ id: users.id }).from(users).where(ne(users.role, 'admin'));
    if (allUsers.length === 0) {
      console.log('[Database] broadcastNotificationToAll: no users found');
      return 0;
    }
    // Insert notifications into DB for persistence
    await db.insert(notifications).values(
      allUsers.map(u => ({ userId: u.id, type: 'system', title, message, isRead: false }))
    );
    console.log(`[Database] broadcastNotificationToAll: inserted ${allUsers.length} notifications`);

    // Push live via SSE endpoint so connected users see it immediately
    try {
      const serverUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
      for (const u of allUsers) {
        try {
          await fetch(`${serverUrl}/api/notify/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: String(u.id),
              type: 'system',
              title,
              message,
              ts: Date.now(),
            }),
            signal: AbortSignal.timeout(3000),
          }).catch(() => {});
        } catch {}
      }
      console.log(`[Database] broadcastNotificationToAll: SSE push attempted for ${allUsers.length} users`);
    } catch (sseErr) {
      console.warn('[Database] SSE broadcast push failed (non-critical):', sseErr);
    }

    return allUsers.length;
  } catch (err) {
    console.error('[Database] broadcastNotificationToAll failed:', err);
    return 0;
  }
}

export async function saveStory(story: InsertStory) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(stories).values(story);
  } catch (err) {
    console.error('[Database] saveStory failed:', err);
    throw err;
  }
}

export async function getActiveStories() {
  const db = await getDb();
  if (!db) return [];
  try {
    const now = new Date();
    
    // Get all active stories with user info
    const activeStories = await db
      .select({
        id: stories.id,
        userId: stories.userId,
        mediaUrl: stories.mediaUrl,
        mediaType: stories.mediaType,
        caption: stories.caption,
        createdAt: stories.createdAt,
        userName: users.name,
        userAvatar: users.avatar,
      })
      .from(stories)
      .innerJoin(users, eq(stories.userId, users.id))
      .where(gt(stories.expiresAt, now))
      .orderBy(desc(stories.createdAt));

    // For each story, get view count and comment count
    const storiesWithStats = await Promise.all(activeStories.map(async (story) => {
      const views = await db.select({ count: sql`count(*)` }).from(storyViews).where(eq(storyViews.storyId, story.id));
      const comments = await db.select({ count: sql`count(*)` }).from(storyComments).where(eq(storyComments.storyId, story.id));
      
      return {
        ...story,
        viewCount: Number(views[0]?.count || 0),
        commentCount: Number(comments[0]?.count || 0),
      };
    }));

    return storiesWithStats;
  } catch (err) {
    console.error('[Database] getActiveStories failed:', err);
    return [];
  }
}

export async function getUserStories(userId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    const now = new Date();
    const userStories = await db
      .select()
      .from(stories)
      .where(and(eq(stories.userId, userId), gt(stories.expiresAt, now)))
      .orderBy(desc(stories.createdAt));

    // Add stats to user stories too
    const storiesWithStats = await Promise.all(userStories.map(async (story) => {
      const views = await db.select({ count: sql`count(*)` }).from(storyViews).where(eq(storyViews.storyId, story.id));
      const comments = await db.select({ count: sql`count(*)` }).from(storyComments).where(eq(storyComments.storyId, story.id));
      
      return {
        ...story,
        viewCount: Number(views[0]?.count || 0),
        commentCount: Number(comments[0]?.count || 0),
      };
    }));

    return storiesWithStats;
  } catch (err) {
    console.error('[Database] getUserStories failed:', err);
    return [];
  }
}

export async function saveStoryComment(comment: InsertStoryComment) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(storyComments).values(comment);
  } catch (err) {
    console.error('[Database] saveStoryComment failed:', err);
    throw err;
  }
}

export async function getStoryComments(storyId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select({
        id: storyComments.id,
        userId: storyComments.userId,
        content: storyComments.content,
        createdAt: storyComments.createdAt,
        userName: users.name,
        userAvatar: users.avatar,
      })
      .from(storyComments)
      .innerJoin(users, eq(storyComments.userId, users.id))
      .where(eq(storyComments.storyId, storyId))
      .orderBy(desc(storyComments.createdAt));
  } catch (err) {
    console.error('[Database] getStoryComments failed:', err);
    return [];
  }
}

export async function recordStoryView(storyId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  try {
    // Check if user already viewed this story to keep it unique
    const existing = await db
      .select()
      .from(storyViews)
      .where(and(eq(storyViews.storyId, storyId), eq(storyViews.userId, userId)))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(storyViews).values({ storyId, userId });
    }
  } catch (err) {
    console.error('[Database] recordStoryView failed:', err);
  }
}

export async function updateUserPresence(
  userId: number,
  openId: string,
  name?: string | null,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const now = new Date();
    const updated = await db.update(users)
      .set({ isOnline: true, lastSeen: now })
      .where(userId > 0 ? eq(users.id, userId) : eq(users.openId, openId))
      .returning({ id: users.id });

    // Guest authentication can briefly return a virtual user with id -1
    // while the background registration is still being written. In that
    // case update by openId and create the row if it is not there yet.
    if (updated.length === 0) {
      await upsertUser({
        openId,
        ...(name ? { name } : {}),
        ...(openId.startsWith('guest_') ? { loginMethod: 'guest' as const } : {}),
        lastSignedIn: now,
      });
    }
  } catch (err) {
    console.error('[Database] updateUserPresence failed:', err);
  }
}

export async function updateUserOffline(
  userId: number,
  openId: string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.update(users)
      .set({ isOnline: false, lastSeen: new Date() })
      .where(userId > 0 ? eq(users.id, userId) : eq(users.openId, openId));
  } catch (err) {
    console.error('[Database] updateUserOffline failed:', err);
  }
}
