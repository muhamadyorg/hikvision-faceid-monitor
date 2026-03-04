import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, date, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["sudo", "admin", "worker"]);
export const eventTypeEnum = pgEnum("event_type", ["enter", "exit"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  plainPassword: text("plain_password"),
  faceUserId: text("face_user_id").unique(),
  fullName: text("full_name").notNull(),
  role: roleEnum("role").notNull().default("worker"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const groups = pgTable("groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const groupAdmins = pgTable("group_admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  adminId: varchar("admin_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [unique().on(t.groupId, t.adminId)]);

export const groupWorkers = pgTable("group_workers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  workerId: varchar("worker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [unique().on(t.groupId, t.workerId)]);

export const shifts = pgTable("shifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startTime: text("start_time").notNull().default("09:00"),
  endTime: text("end_time").notNull().default("18:00"),
  isNightShift: boolean("is_night_shift").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const holidays = pgTable("holidays", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: date("date").notNull().unique(),
  description: text("description").notNull(),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const devices = pgTable("devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  deviceIdentifier: text("device_identifier").notNull().unique(),
  location: text("location"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  faceUserId: text("face_user_id"),
  resolvedName: text("resolved_name"),
  deviceId: text("device_id").notNull(),
  eventType: eventTypeEnum("event_type").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  isFirstEnter: boolean("is_first_enter").notNull().default(false),
  isFirstExit: boolean("is_first_exit").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notificationConfigs = pgTable("notification_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }).unique(),
  enterMessage: text("enter_message").notNull().default("Ishxonaga xush kelibsiz!"),
  exitMessage: text("exit_message").notNull().default("Xayr ko'rishguncha!"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  sessionId: text("session_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertGroupSchema = createInsertSchema(groups).omit({ id: true, createdAt: true });
export const insertShiftSchema = createInsertSchema(shifts).omit({ id: true, createdAt: true });
export const insertHolidaySchema = createInsertSchema(holidays).omit({ id: true, createdAt: true });
export const insertDeviceSchema = createInsertSchema(devices).omit({ id: true, createdAt: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true, isFirstEnter: true, isFirstExit: true });
export const insertNotificationConfigSchema = createInsertSchema(notificationConfigs).omit({ id: true, createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groups.$inferSelect;
export type GroupAdmin = typeof groupAdmins.$inferSelect;
export type GroupWorker = typeof groupWorkers.$inferSelect;
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shifts.$inferSelect;
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;
export type Holiday = typeof holidays.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;
export type NotificationConfig = typeof notificationConfigs.$inferSelect;
export type InsertNotificationConfig = z.infer<typeof insertNotificationConfigSchema>;
export type UserSession = typeof userSessions.$inferSelect;

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const incomingEventSchema = z.object({
  device_id: z.string().min(1),
  user_id: z.string().min(1),
  event_type: z.enum(["enter", "exit"]),
  timestamp: z.string().optional(),
});
