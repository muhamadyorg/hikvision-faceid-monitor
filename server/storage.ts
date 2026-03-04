import {
  type User, type InsertUser,
  type Group, type InsertGroup,
  type GroupAdmin, type GroupWorker,
  type Shift, type InsertShift,
  type Holiday, type InsertHoliday,
  type Device, type InsertDevice,
  type Event, type InsertEvent,
  type NotificationConfig, type InsertNotificationConfig,
  type UserSession,
  users, groups, groupAdmins, groupWorkers, shifts, holidays,
  devices, events, notificationConfigs, userSessions,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, ne } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByFaceId(faceUserId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  getAllAdmins(): Promise<User[]>;
  getAllWorkers(): Promise<User[]>;

  // Groups
  getGroup(id: string): Promise<Group | undefined>;
  getAllGroups(): Promise<Group[]>;
  createGroup(group: InsertGroup): Promise<Group>;
  updateGroup(id: string, data: Partial<InsertGroup>): Promise<Group | undefined>;
  deleteGroup(id: string): Promise<void>;

  // Group Admins
  getGroupAdmins(groupId: string): Promise<User[]>;
  getAdminGroups(adminId: string): Promise<Group[]>;
  assignAdminToGroup(groupId: string, adminId: string): Promise<void>;
  removeAdminFromGroup(groupId: string, adminId: string): Promise<void>;

  // Group Workers
  getGroupWorkers(groupId: string): Promise<User[]>;
  getWorkerGroups(workerId: string): Promise<Group[]>;
  addWorkerToGroup(groupId: string, workerId: string): Promise<void>;
  removeWorkerFromGroup(groupId: string, workerId: string): Promise<void>;
  removeWorkerFromAllGroups(workerId: string): Promise<void>;

  // Shifts
  getShifts(groupId: string): Promise<Shift[]>;
  getAllShifts(): Promise<Shift[]>;
  createShift(shift: InsertShift): Promise<Shift>;
  updateShift(id: string, data: Partial<InsertShift>): Promise<Shift | undefined>;
  deleteShift(id: string): Promise<void>;

  // Holidays
  getHolidays(): Promise<Holiday[]>;
  getHolidayByDate(date: string): Promise<Holiday | undefined>;
  createHoliday(holiday: InsertHoliday): Promise<Holiday>;
  deleteHoliday(id: string): Promise<void>;

  // Devices
  getDevice(id: string): Promise<Device | undefined>;
  getAllDevices(): Promise<Device[]>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: string, data: Partial<InsertDevice>): Promise<Device | undefined>;
  deleteDevice(id: string): Promise<void>;

  // Events
  createEvent(event: InsertEvent & { faceUserId: string; resolvedName: string }): Promise<Event>;
  getEvents(filters?: { faceUserId?: string; deviceId?: string; from?: Date; to?: Date; limit?: number; offset?: number }): Promise<{ events: Event[]; total: number }>;
  getFirstEventOfDay(faceUserId: string, date: string, type: "enter" | "exit"): Promise<Event | undefined>;
  markFirstEvent(id: string, type: "enter" | "exit"): Promise<void>;
  getRecentEvents(limit?: number): Promise<Event[]>;
  getWorkerEvents(faceUserId: string, from: Date, to: Date): Promise<Event[]>;

  // Notification Configs
  getNotificationConfig(groupId: string): Promise<NotificationConfig | undefined>;
  upsertNotificationConfig(config: InsertNotificationConfig): Promise<NotificationConfig>;

  // Sessions (single session enforcement)
  getUserSession(userId: string): Promise<UserSession | undefined>;
  upsertUserSession(userId: string, sessionId: string): Promise<void>;
  deleteUserSession(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string) {
    return db.select().from(users).where(eq(users.id, id)).then(r => r[0]);
  }

  async getUserByUsername(username: string) {
    return db.select().from(users).where(eq(users.username, username)).then(r => r[0]);
  }

  async getUserByFaceId(faceUserId: string) {
    return db.select().from(users).where(eq(users.faceUserId, faceUserId)).then(r => r[0]);
  }

  async createUser(user: InsertUser) {
    return db.insert(users).values(user).returning().then(r => r[0]);
  }

  async updateUser(id: string, data: Partial<InsertUser>) {
    return db.update(users).set(data).where(eq(users.id, id)).returning().then(r => r[0]);
  }

  async deleteUser(id: string) {
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllUsers() {
    return db.select().from(users).orderBy(users.createdAt);
  }

  async getAllAdmins() {
    return db.select().from(users).where(eq(users.role, "admin")).orderBy(users.createdAt);
  }

  async getAllWorkers() {
    return db.select().from(users).where(eq(users.role, "worker")).orderBy(users.fullName);
  }

  // Groups
  async getGroup(id: string) {
    return db.select().from(groups).where(eq(groups.id, id)).then(r => r[0]);
  }

  async getAllGroups() {
    return db.select().from(groups).orderBy(groups.createdAt);
  }

  async createGroup(group: InsertGroup) {
    return db.insert(groups).values(group).returning().then(r => r[0]);
  }

  async updateGroup(id: string, data: Partial<InsertGroup>) {
    return db.update(groups).set(data).where(eq(groups.id, id)).returning().then(r => r[0]);
  }

  async deleteGroup(id: string) {
    await db.delete(groups).where(eq(groups.id, id));
  }

  // Group Admins
  async getGroupAdmins(groupId: string) {
    const rows = await db.select({ user: users }).from(groupAdmins)
      .innerJoin(users, eq(groupAdmins.adminId, users.id))
      .where(eq(groupAdmins.groupId, groupId));
    return rows.map(r => r.user);
  }

  async getAdminGroups(adminId: string) {
    const rows = await db.select({ group: groups }).from(groupAdmins)
      .innerJoin(groups, eq(groupAdmins.groupId, groups.id))
      .where(eq(groupAdmins.adminId, adminId));
    return rows.map(r => r.group);
  }

  async assignAdminToGroup(groupId: string, adminId: string) {
    await db.insert(groupAdmins).values({ groupId, adminId }).onConflictDoNothing();
  }

  async removeAdminFromGroup(groupId: string, adminId: string) {
    await db.delete(groupAdmins).where(and(eq(groupAdmins.groupId, groupId), eq(groupAdmins.adminId, adminId)));
  }

  // Group Workers
  async getGroupWorkers(groupId: string) {
    const rows = await db.select({ user: users }).from(groupWorkers)
      .innerJoin(users, eq(groupWorkers.workerId, users.id))
      .where(eq(groupWorkers.groupId, groupId))
      .orderBy(users.fullName);
    return rows.map(r => r.user);
  }

  async getWorkerGroups(workerId: string) {
    const rows = await db.select({ group: groups }).from(groupWorkers)
      .innerJoin(groups, eq(groupWorkers.groupId, groups.id))
      .where(eq(groupWorkers.workerId, workerId));
    return rows.map(r => r.group);
  }

  async addWorkerToGroup(groupId: string, workerId: string) {
    await db.insert(groupWorkers).values({ groupId, workerId }).onConflictDoNothing();
  }

  async removeWorkerFromGroup(groupId: string, workerId: string) {
    await db.delete(groupWorkers).where(and(eq(groupWorkers.groupId, groupId), eq(groupWorkers.workerId, workerId)));
  }

  async removeWorkerFromAllGroups(workerId: string) {
    await db.delete(groupWorkers).where(eq(groupWorkers.workerId, workerId));
  }

  // Shifts
  async getShifts(groupId: string) {
    return db.select().from(shifts).where(eq(shifts.groupId, groupId)).orderBy(shifts.startTime);
  }

  async getAllShifts() {
    return db.select().from(shifts).orderBy(shifts.groupId, shifts.startTime);
  }

  async createShift(shift: InsertShift) {
    return db.insert(shifts).values(shift).returning().then(r => r[0]);
  }

  async updateShift(id: string, data: Partial<InsertShift>) {
    return db.update(shifts).set(data).where(eq(shifts.id, id)).returning().then(r => r[0]);
  }

  async deleteShift(id: string) {
    await db.delete(shifts).where(eq(shifts.id, id));
  }

  // Holidays
  async getHolidays() {
    return db.select().from(holidays).orderBy(holidays.date);
  }

  async getHolidayByDate(date: string) {
    return db.select().from(holidays).where(eq(holidays.date, date)).then(r => r[0]);
  }

  async createHoliday(holiday: InsertHoliday) {
    return db.insert(holidays).values(holiday).returning().then(r => r[0]);
  }

  async deleteHoliday(id: string) {
    await db.delete(holidays).where(eq(holidays.id, id));
  }

  // Devices
  async getDevice(id: string) {
    return db.select().from(devices).where(eq(devices.id, id)).then(r => r[0]);
  }

  async getAllDevices() {
    return db.select().from(devices).orderBy(devices.createdAt);
  }

  async createDevice(device: InsertDevice) {
    return db.insert(devices).values(device).returning().then(r => r[0]);
  }

  async updateDevice(id: string, data: Partial<InsertDevice>) {
    return db.update(devices).set(data).where(eq(devices.id, id)).returning().then(r => r[0]);
  }

  async deleteDevice(id: string) {
    await db.delete(devices).where(eq(devices.id, id));
  }

  // Events
  async createEvent(event: InsertEvent & { faceUserId: string; resolvedName: string }) {
    return db.insert(events).values(event).returning().then(r => r[0]);
  }

  async getEvents(filters?: { faceUserId?: string; deviceId?: string; from?: Date; to?: Date; limit?: number; offset?: number }) {
    const conditions = [];
    if (filters?.faceUserId) conditions.push(eq(events.faceUserId, filters.faceUserId));
    if (filters?.deviceId) conditions.push(eq(events.deviceId, filters.deviceId));
    if (filters?.from) conditions.push(gte(events.timestamp, filters.from));
    if (filters?.to) conditions.push(lte(events.timestamp, filters.to));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const [evList, countRes] = await Promise.all([
      db.select().from(events).where(where).orderBy(desc(events.timestamp)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(events).where(where),
    ]);

    return { events: evList, total: Number(countRes[0].count) };
  }

  async getFirstEventOfDay(faceUserId: string, date: string, type: "enter" | "exit") {
    const dayStart = new Date(date + "T00:00:00");
    const dayEnd = new Date(date + "T23:59:59");
    const field = type === "enter" ? events.isFirstEnter : events.isFirstExit;
    const r = await db.select().from(events).where(
      and(
        eq(events.faceUserId, faceUserId),
        eq(events.eventType, type),
        eq(field, true),
        gte(events.timestamp, dayStart),
        lte(events.timestamp, dayEnd),
      )
    ).limit(1);
    return r[0];
  }

  async markFirstEvent(id: string, type: "enter" | "exit") {
    if (type === "enter") {
      await db.update(events).set({ isFirstEnter: true }).where(eq(events.id, id));
    } else {
      await db.update(events).set({ isFirstExit: true }).where(eq(events.id, id));
    }
  }

  async getRecentEvents(limit = 30) {
    return db.select().from(events).orderBy(desc(events.timestamp)).limit(limit);
  }

  async getWorkerEvents(faceUserId: string, from: Date, to: Date) {
    return db.select().from(events).where(
      and(eq(events.faceUserId, faceUserId), gte(events.timestamp, from), lte(events.timestamp, to))
    ).orderBy(desc(events.timestamp));
  }

  // Notification Configs
  async getNotificationConfig(groupId: string) {
    return db.select().from(notificationConfigs).where(eq(notificationConfigs.groupId, groupId)).then(r => r[0]);
  }

  async upsertNotificationConfig(config: InsertNotificationConfig) {
    return db.insert(notificationConfigs).values(config)
      .onConflictDoUpdate({ target: notificationConfigs.groupId, set: { enterMessage: config.enterMessage, exitMessage: config.exitMessage } })
      .returning().then(r => r[0]);
  }

  // Sessions
  async getUserSession(userId: string) {
    return db.select().from(userSessions).where(eq(userSessions.userId, userId)).then(r => r[0]);
  }

  async upsertUserSession(userId: string, sessionId: string) {
    await db.insert(userSessions).values({ userId, sessionId })
      .onConflictDoUpdate({ target: userSessions.userId, set: { sessionId } });
  }

  async deleteUserSession(userId: string) {
    await db.delete(userSessions).where(eq(userSessions.userId, userId));
  }
}

export const storage = new DatabaseStorage();
