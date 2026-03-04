import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { loginSchema, incomingEventSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

const PgSession = connectPgSimple(session);
const { Pool } = pg;

const wsClients = new Set<WebSocket>();

function broadcast(data: unknown) {
  const msg = JSON.stringify(data);
  wsClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    const user = await storage.getUser(String(req.session.userId));
    if (!user || !roles.includes(user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    role: string;
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  app.use(session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "hikvision-secret-2026",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
  }));

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wss.on("connection", (ws) => {
    wsClients.add(ws);
    ws.on("close", () => wsClients.delete(ws));
    ws.on("error", () => wsClients.delete(ws));
  });

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ error: "Noto'g'ri foydalanuvchi nomi yoki parol" });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: "Noto'g'ri foydalanuvchi nomi yoki parol" });
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.save((err) => {
        if (err) return res.status(500).json({ error: "Session error" });
        res.json({ id: user.id, username: user.username, role: user.role });
      });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {});
    res.json({ ok: true });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Not authenticated" });
    const user = await storage.getUser(String(req.session.userId));
    if (!user) return res.status(401).json({ error: "Not found" });
    res.json({ id: user.id, username: user.username, role: user.role });
  });

  // Event ingestion - public endpoint for Hikvision devices
  app.post("/api/events", async (req, res) => {
    try {
      const data = incomingEventSchema.parse(req.body);
      const event = await storage.createEvent({
        deviceId: data.device_id,
        personName: data.person_name,
        eventType: data.event_type,
        timestamp: new Date(data.timestamp),
      });
      broadcast({ type: "new_event", event });
      res.status(201).json(event);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/events", requireAuth, async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const deviceId = req.query.deviceId as string | undefined;
      const groupId = req.query.groupId as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      const result = await storage.getEvents({ search, dateFrom, dateTo, deviceId, groupId, limit, offset });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/events/report", requireAuth, async (req, res) => {
    try {
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      if (!dateFrom || !dateTo) return res.status(400).json({ error: "dateFrom and dateTo required" });

      const eventsData = await storage.getEventsByDateRange(dateFrom, dateTo);
      const schedules = await storage.getAllWorkSchedules();
      const scheduleMap = new Map(schedules.map(s => [s.personName, s]));

      const dayMap: Record<string, Record<string, { enters: Date[]; exits: Date[] }>> = {};

      for (const ev of eventsData) {
        const day = new Date(ev.timestamp).toISOString().split("T")[0];
        if (!dayMap[day]) dayMap[day] = {};
        if (!dayMap[day][ev.personName]) dayMap[day][ev.personName] = { enters: [], exits: [] };
        if (ev.eventType === "enter") dayMap[day][ev.personName].enters.push(new Date(ev.timestamp));
        else dayMap[day][ev.personName].exits.push(new Date(ev.timestamp));
      }

      const report: any[] = [];

      for (const day of Object.keys(dayMap)) {
        for (const personName of Object.keys(dayMap[day])) {
          const data = dayMap[day][personName];
          const firstEnter = data.enters.length > 0
            ? data.enters.sort((a: Date, b: Date) => a.getTime() - b.getTime())[0]
            : null;
          const lastExit = data.exits.length > 0
            ? data.exits.sort((a: Date, b: Date) => b.getTime() - a.getTime())[0]
            : null;

          const schedule = scheduleMap.get(personName);
          let lateMinutes = 0;
          let earlyLeaveMinutes = 0;

          if (firstEnter && schedule) {
            const [sh, sm] = schedule.workStart.split(":").map(Number);
            const expectedStart = new Date(firstEnter);
            expectedStart.setHours(sh, sm, 0, 0);
            if (firstEnter > expectedStart) {
              lateMinutes = Math.round((firstEnter.getTime() - expectedStart.getTime()) / 60000);
            }
          }

          if (lastExit && schedule) {
            const [eh, em] = schedule.workEnd.split(":").map(Number);
            const expectedEnd = new Date(lastExit);
            expectedEnd.setHours(eh, em, 0, 0);
            if (lastExit < expectedEnd) {
              earlyLeaveMinutes = Math.round((expectedEnd.getTime() - lastExit.getTime()) / 60000);
            }
          }

          report.push({
            day,
            personName,
            firstEnter: firstEnter?.toISOString() || null,
            lastExit: lastExit?.toISOString() || null,
            lateMinutes,
            earlyLeaveMinutes,
            schedule: schedule ? { workStart: schedule.workStart, workEnd: schedule.workEnd } : null,
          });
        }
      }

      report.sort((a, b) => a.day.localeCompare(b.day) || a.personName.localeCompare(b.personName));
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/events/:id", requireRole("sudo"), async (req, res) => {
    await storage.deleteEvent(String(req.params.id));
    res.json({ ok: true });
  });

  // Device routes
  app.get("/api/devices", requireAuth, async (_req, res) => {
    const devs = await storage.getAllDevices();
    res.json(devs);
  });

  app.post("/api/devices", requireRole("sudo"), async (req, res) => {
    try {
      const { name, deviceIdentifier, location } = req.body;
      if (!name || !deviceIdentifier) return res.status(400).json({ error: "name and deviceIdentifier required" });
      const device = await storage.createDevice({ name, deviceIdentifier, location: location || null });
      res.status(201).json(device);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/devices/:id", requireRole("sudo"), async (req, res) => {
    try {
      const device = await storage.updateDevice(String(req.params.id), req.body);
      res.json(device);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/devices/:id", requireRole("sudo"), async (req, res) => {
    await storage.deleteDevice(String(req.params.id));
    res.json({ ok: true });
  });

  // User routes
  app.get("/api/users", requireRole("sudo", "admin"), async (_req, res) => {
    const allUsers = await storage.getAllUsers();
    res.json(allUsers.map(u => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt })));
  });

  app.post("/api/users", requireRole("sudo", "admin"), async (req, res) => {
    try {
      const { username, password, role } = req.body;
      if (!username || !password) return res.status(400).json({ error: "Username and password required" });
      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(400).json({ error: "Username already exists" });
      const currentUser = await storage.getUser(String(req.session.userId));
      if (currentUser?.role === "admin" && role === "sudo") {
        return res.status(403).json({ error: "Admin cannot create sudo users" });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await storage.createUser({ username, passwordHash, role: role || "user" });
      res.status(201).json({ id: user.id, username: user.username, role: user.role });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/users/:id", requireRole("sudo", "admin"), async (req, res) => {
    try {
      const { username, password, role } = req.body;
      const updateData: any = {};
      if (username) updateData.username = username;
      if (password) updateData.passwordHash = await bcrypt.hash(password, 12);
      if (role) updateData.role = role;
      const user = await storage.updateUser(String(req.params.id), updateData);
      res.json({ id: user?.id, username: user?.username, role: user?.role });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/users/:id", requireRole("sudo"), async (req, res) => {
    await storage.deleteUser(String(req.params.id));
    res.json({ ok: true });
  });

  // Group routes
  app.get("/api/groups", requireAuth, async (req, res) => {
    const user = await storage.getUser(String(req.session.userId));
    if (user?.role === "sudo" || user?.role === "admin") {
      const allGroups = await storage.getAllGroups();
      return res.json(allGroups.map(g => ({ id: g.id, name: g.name, login: g.login, createdAt: g.createdAt })));
    }
    const userGroups = await storage.getUserGroups(String(req.session.userId));
    res.json(userGroups.map(g => ({ id: g.id, name: g.name, login: g.login, createdAt: g.createdAt })));
  });

  app.post("/api/groups", requireRole("sudo"), async (req, res) => {
    try {
      const { name, login, password } = req.body;
      if (!name || !login || !password) return res.status(400).json({ error: "name, login, password required" });
      const passwordHash = await bcrypt.hash(password, 12);
      const group = await storage.createGroup({ name, login, passwordHash });
      res.status(201).json({ id: group.id, name: group.name, login: group.login });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/groups/:id", requireRole("sudo"), async (req, res) => {
    try {
      const { name, login, password } = req.body;
      const updateData: any = {};
      if (name) updateData.name = name;
      if (login) updateData.login = login;
      if (password) updateData.passwordHash = await bcrypt.hash(password, 12);
      const group = await storage.updateGroup(String(req.params.id), updateData);
      res.json({ id: group?.id, name: group?.name, login: group?.login });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/groups/:id", requireRole("sudo"), async (req, res) => {
    await storage.deleteGroup(String(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/groups/join", requireAuth, async (req, res) => {
    try {
      const { login, password } = req.body;
      const group = await storage.getGroupByLogin(login);
      if (!group) return res.status(404).json({ error: "Guruh topilmadi" });
      const valid = await bcrypt.compare(password, group.passwordHash);
      if (!valid) return res.status(401).json({ error: "Noto'g'ri login yoki parol" });
      await storage.addUserToGroup(group.id, String(req.session.userId));
      res.json({ ok: true, group: { id: group.id, name: group.name } });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/groups/:id/members", requireRole("sudo", "admin"), async (req, res) => {
    const members = await storage.getGroupMembers(String(req.params.id));
    const memberUsers = await Promise.all(members.map(m => storage.getUser(m.userId)));
    res.json(memberUsers.filter(Boolean).map(u => ({ id: u!.id, username: u!.username, role: u!.role })));
  });

  app.post("/api/groups/:id/members", requireRole("sudo", "admin"), async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    await storage.addUserToGroup(String(req.params.id), userId);
    res.json({ ok: true });
  });

  app.delete("/api/groups/:id/members/:userId", requireRole("sudo", "admin"), async (req, res) => {
    await storage.removeUserFromGroup(String(req.params.id), String(req.params.userId));
    res.json({ ok: true });
  });

  // Work schedules
  app.get("/api/work-schedules", requireAuth, async (_req, res) => {
    const schedules = await storage.getAllWorkSchedules();
    res.json(schedules);
  });

  app.post("/api/work-schedules", requireRole("sudo", "admin"), async (req, res) => {
    try {
      const { personName, workStart, workEnd } = req.body;
      if (!personName || !workStart || !workEnd) return res.status(400).json({ error: "personName, workStart, workEnd required" });
      const schedule = await storage.upsertWorkSchedule({ personName, workStart, workEnd });
      res.json(schedule);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  return httpServer;
}
