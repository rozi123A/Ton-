import { and, desc, eq, isNotNull, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { InsertUser, users, InsertMessage, messages, gifts, friendRequests, friends, notifications } from '../drizzle/schema';
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

let _db: ReturnType<typeof drizzle> | null = null;
let _rawClient: ReturnType<typeof postgres> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const url = cleanDbUrl(process.env.DATABASE_URL);
      _rawClient = postgres(url, { ssl: 'require', max: 10 });
      _db = drizzle(_rawClient);
    } catch (error) {
      console.warn('[Database] Failed to connect:', error);
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
      await _rawClient.unsafe(`CREATE TYPE ${typeName} AS ENUM (${values})`);
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
       role          role NOT NULL DEFAULT 'user',
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
  ];

  for (const stmt of tables) {
    try {
      await _rawClient.unsafe(stmt);
    } catch (err) {
      console.error('[Database] Failed to create table:', err);
    }
  }

  // Add credits and isPremium columns to existing tables that predate this migration
  try {
    await _rawClient.unsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 100`);
    await _rawClient.unsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet INTEGER NOT NULL DEFAULT 0`);
    await _rawClient.unsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "isPremium" BOOLEAN NOT NULL DEFAULT false`);
    await _rawClient.unsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "profileViews" INTEGER NOT NULL DEFAULT 0`);
    await _rawClient.unsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(10)`);
  } catch { /* ignore */ }

  console.log('[Database] Schema ready');
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
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ['name', 'email', 'loginMethod'] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    // Handle country — only set/update when we have a real value, never overwrite with null
    if (user.country) {
      values.country = user.country;
      updateSet.country = user.country;
    }

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // Check for daily bonus before updating
    const existingUser = await getUserByOpenId(user.openId);
    if (existingUser) {
      const lastVisit = new Date(existingUser.lastSignedIn);
      const today = new Date();
      const isNewDay = lastVisit.toDateString() !== today.toDateString();
      
      if (isNewDay) {
        // Grant 10 credits and 5 stars daily bonus
        updateSet.credits = sql`${users.credits} + 10`;
        updateSet.wallet = sql`${users.wallet} + 5`;
        // Create a notification for the bonus
        await createNotification(existingUser.id, {
          type: 'system',
          title: 'مكافأة يومية 🎁',
          message: 'لقد حصلت على 10 نقاط و 5 نجوم مجانية لزيارتك اليوم! استخدم النجوم في الرادار الآن.',
        });
      }
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
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
    return;
  }

  try {
    await db.insert(messages).values({ senderId, receiverId, content, isRead: false });
  } catch (error) {
    console.error('[Database] Failed to save message:', error);
    throw error;
  }
}

export async function getMessages(userId1: number, userId2: number) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot get messages: database not available');
    return [];
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
  gender: string | null; createdAt: Date; loginMethod: string | null; isPremium: boolean;
}>> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select({
        id: users.id, name: users.name, country: users.country, avatar: users.avatar,
        gender: users.gender, createdAt: users.createdAt, loginMethod: users.loginMethod,
        isPremium: users.isPremium,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit);
  } catch (err) {
    console.error('[Database] getNewRegistrations failed:', err);
    return [];
  }
}

export async function getCountryStats(): Promise<Array<{ country: string; count: number }>> {
  const db = await getDb();
  if (!db) return [];
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
    return await db.select().from(users).where(sql`id IN (${sql.join(friendIds, sql`, `)})`);
  } catch (err) {
    console.error('[Database] getFriends failed:', err);
    return [];
  }
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
