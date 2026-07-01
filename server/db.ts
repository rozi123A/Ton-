import { desc, eq, isNotNull, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { InsertUser, users, InsertMessage, messages, gifts } from '../drizzle/schema';
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

    // Handle country explicitly
    if (user.country !== undefined) {
      values.country = user.country ?? null;
      updateSet.country = user.country ?? null;
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
      or(eq(messages.senderId, userId1), eq(messages.receiverId, userId1))
    );
  } catch (error) {
    console.error('[Database] Failed to get messages:', error);
    return [];
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
    await db.update(users).set({ credits: current - amount }).where(eq(users.id, userId));
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
    await db.insert(gifts).values({ senderId, receiverId, giftType, cost });
  } catch (err) {
    console.error('[Database] saveGift failed:', err);
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
