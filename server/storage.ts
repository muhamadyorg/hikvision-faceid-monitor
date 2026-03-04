import {
  type User, type InsertUser, type Group, type InsertGroup,
  type Device, type InsertDevice, type Event, type InsertEvent,
  type GroupMember, type WorkSchedule,
  users, groups, groupMembers, devices, events, workSchedules
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, like, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;

  getGroup(id: string): Promise<Group | undefined>;
  getGroupByLogin(login: string): Promise<Group | undefined>;
  getAllGroups(): Promise<Group[]>;
  createGroup(group: InsertGroup): Promise<Group>;
  updateGroup(id: string, data: Partial<InsertGroup>): Promise<Group | undefined>;
  deleteGroup(id: string): Promise<void>;

  getGroupMembers(groupId: string): Promise<GroupMember[]>;
  getUserGroups(userId: string): Promise<Group[]>;
  addUserToGroup(groupId: string, userId: string): Promise<void>;
  removeUserFromGroup(groupId: string, userId: string): Promise<void>;
  isUserInGroup(groupId: string, userId: string): Promise<boolean>;

  getDevice(id: string): Promise<Device | undefined>;
  getDeviceByIdentifier(identifier: string): Promise<Device | undefined>;
  getAllDevices(): Promise<Device[]>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: string, data: Partial<InsertDevice>): Promise<Device | undefined>;
  deleteDevice(id: string): Promise<void>;

  createEvent(event: InsertEvent): Promise<Event>;
  getEvents(filters?: {
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    deviceId?: string;
    groupId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ events: Event[]; total: number }>;
  deleteEvent(id: string): Promise<void>;
  getEventsByDateRange(dateFrom: string, dateTo: string, personName?: string): Promise<Event[]>;

  getWorkSchedule(personName: string): Promise<WorkSchedule | undefined>;
  getAllWorkSchedules(): Promise<WorkSchedule[]>;
  upsertWorkSchedule(data: { personName: string; workStart: string; workEnd: string }): Promise<WorkSchedule>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.createdAt);
  }

  async getGroup(id: string): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(eq(groups.id, id));
    return group;
  }

  async getGroupByLogin(login: string): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(eq(groups.login, login));
    return group;
  }

  async getAllGroups(): Promise<Group[]> {
    return db.select().from(groups).orderBy(groups.createdAt);
  }

  async createGroup(group: InsertGroup): Promise<Group> {
    const [created] = await db.insert(groups).values(group).returning();
    return created;
  }

  async updateGroup(id: string, data: Partial<InsertGroup>): Promise<Group | undefined> {
    const [updated] = await db.update(groups).set(data).where(eq(groups.id, id)).returning();
    return updated;
  }

  async deleteGroup(id: string): Promise<void> {
    await db.delete(groups).where(eq(groups.id, id));
  }

  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    return db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId));
  }

  async getUserGroups(userId: string): Promise<Group[]> {
    const members = await db.select().from(groupMembers).where(eq(groupMembers.userId, userId));
    if (members.length === 0) return [];
    const result: Group[] = [];
    for (const member of members) {
      const [group] = await db.select().from(groups).where(eq(groups.id, member.groupId));
      if (group) result.push(group);
    }
    return result;
  }

  async addUserToGroup(groupId: string, userId: string): Promise<void> {
    await db.insert(groupMembers).values({ groupId, userId }).onConflictDoNothing();
  }

  async removeUserFromGroup(groupId: string, userId: string): Promise<void> {
    await db.delete(groupMembers).where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
    );
  }

  async isUserInGroup(groupId: string, userId: string): Promise<boolean> {
    const [member] = await db.select().from(groupMembers).where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
    );
    return !!member;
  }

  async getDevice(id: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device;
  }

  async getDeviceByIdentifier(identifier: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.deviceIdentifier, identifier));
    return device;
  }

  async getAllDevices(): Promise<Device[]> {
    return db.select().from(devices).orderBy(devices.createdAt);
  }

  async createDevice(device: InsertDevice): Promise<Device> {
    const [created] = await db.insert(devices).values(device).returning();
    return created;
  }

  async updateDevice(id: string, data: Partial<InsertDevice>): Promise<Device | undefined> {
    const [updated] = await db.update(devices).set(data).where(eq(devices.id, id)).returning();
    return updated;
  }

  async deleteDevice(id: string): Promise<void> {
    await db.delete(devices).where(eq(devices.id, id));
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [created] = await db.insert(events).values(event).returning();
    return created;
  }

  async getEvents(filters?: {
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    deviceId?: string;
    groupId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ events: Event[]; total: number }> {
    const conditions: any[] = [];

    if (filters?.search) {
      conditions.push(like(events.personName, `%${filters.search}%`));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(events.timestamp, new Date(filters.dateFrom)));
    }
    if (filters?.dateTo) {
      const dateTo = new Date(filters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      conditions.push(lte(events.timestamp, dateTo));
    }
    if (filters?.deviceId) {
      conditions.push(eq(events.deviceId, filters.deviceId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(events).where(whereClause);
    const total = Number(countResult.count);

    const eventsData = await db.select().from(events)
      .where(whereClause)
      .orderBy(desc(events.timestamp))
      .limit(filters?.limit ?? 50)
      .offset(filters?.offset ?? 0);

    return { events: eventsData, total };
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  async getEventsByDateRange(dateFrom: string, dateTo: string, personName?: string): Promise<Event[]> {
    const conditions: any[] = [
      gte(events.timestamp, new Date(dateFrom)),
      lte(events.timestamp, new Date(dateTo + "T23:59:59.999Z")),
    ];
    if (personName) {
      conditions.push(eq(events.personName, personName));
    }
    return db.select().from(events).where(and(...conditions)).orderBy(events.personName, events.timestamp);
  }

  async getWorkSchedule(personName: string): Promise<WorkSchedule | undefined> {
    const [schedule] = await db.select().from(workSchedules).where(eq(workSchedules.personName, personName));
    return schedule;
  }

  async getAllWorkSchedules(): Promise<WorkSchedule[]> {
    return db.select().from(workSchedules);
  }

  async upsertWorkSchedule(data: { personName: string; workStart: string; workEnd: string }): Promise<WorkSchedule> {
    const existing = await this.getWorkSchedule(data.personName);
    if (existing) {
      const [updated] = await db.update(workSchedules)
        .set({ workStart: data.workStart, workEnd: data.workEnd })
        .where(eq(workSchedules.personName, data.personName))
        .returning();
      return updated;
    }
    const [created] = await db.insert(workSchedules).values(data).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
