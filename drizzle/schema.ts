import { integer, pgEnum, pgTable, text, timestamp, varchar, boolean, serial } from "drizzle-orm/pg-core";

export const genderEnum = pgEnum("gender", ["male", "female", "other"]);
export const roleEnum = pgEnum("role", ["user", "admin"]);

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  age: integer("age"),
  gender: genderEnum("gender"),
  avatar: text("avatar"),
  bio: text("bio"),
  credits: integer("credits").default(100).notNull(),
  isOnline: boolean("isOnline").default(false).notNull(),
  lastSeen: timestamp("lastSeen").defaultNow().notNull(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("senderId").notNull(),
  receiverId: integer("receiverId").notNull(),
  content: text("content").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

export const connections = pgTable("connections", {
  id: serial("id").primaryKey(),
  userId1: integer("userId1").notNull(),
  userId2: integer("userId2").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  duration: integer("duration"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Connection = typeof connections.$inferSelect;
export type InsertConnection = typeof connections.$inferInsert;

export const blocks = pgTable("blocks", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  blockedUserId: integer("blockedUserId").notNull(),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Block = typeof blocks.$inferSelect;
export type InsertBlock = typeof blocks.$inferInsert;

export const gifts = pgTable("gifts", {
  id: serial("id").primaryKey(),
  senderId: integer("senderId").notNull(),
  receiverId: integer("receiverId").notNull(),
  giftType: varchar("giftType", { length: 50 }).notNull(),
  cost: integer("cost").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Gift = typeof gifts.$inferSelect;
export type InsertGift = typeof gifts.$inferInsert;
