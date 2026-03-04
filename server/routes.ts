import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcrypt";
import { Pool } from "pg";
import { storage } from "./storage";
import { loginSchema, incomingEventSchema, insertGroupSchema, insertShiftSchema, insertHolidaySchema, insertDeviceSchema, insertNotificationConfigSchema } from "@shared/schema";
import { z } from "zod";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    role?: string;
  }
}

let wss: WebSocketServer;

function broadcastEvent(data: unknown) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ error: "Kirish talab qilinadi" });
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ error: "Kirish talab qilinadi" });
  if (req.session.role !== "admin" && req.session.role !== "sudo") return res.status(403).json({ error: "Ruxsat yo'q" });
  next();
}

function requireSudo(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ error: "Kirish talab qilinadi" });
  if (req.session.role !== "sudo") return res.status(403).json({ error: "Faqat sudo uchun" });
  next();
}

export async function registerRoutes(httpServer: Server, app: Express) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const PgSession = connectPgSimple(session);

  app.use(session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "hikvision-secret-2024",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
  }));

  // Single session enforcement middleware
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (req.session.userId) {
      const stored = await storage.getUserSession(req.session.userId);
      if (stored && stored.sessionId !== req.sessionID) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: "Boshqa qurilmada yangi kirish amalga oshirildi" });
      }
    }
    next();
  });

  // ============ AUTH ============
  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ error: "Foydalanuvchi topilmadi" });
    const { passwordHash, ...safe } = user;
    res.json(safe);
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Noto'g'ri ma'lumotlar" });

    const user = await storage.getUserByUsername(parsed.data.username);
    if (!user || !user.passwordHash) return res.status(401).json({ error: "Login yoki parol noto'g'ri" });

    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Login yoki parol noto'g'ri" });

    req.session.userId = user.id;
    req.session.role = user.role;

    await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    await storage.upsertUserSession(user.id, req.sessionID);

    const { passwordHash, ...safe } = user;
    res.json(safe);
  });

  app.post("/api/auth/logout", async (req, res) => {
    if (req.session.userId) {
      await storage.deleteUserSession(req.session.userId);
    }
    req.session.destroy(() => res.json({ ok: true }));
  });

  // ============ USERS/ADMINS (sudo only) ============
  app.get("/api/users", requireAuth, async (req, res) => {
    if (req.session.role === "sudo") {
      const all = await storage.getAllUsers();
      res.json(all.map(u => { const { passwordHash, ...safe } = u; return safe; }));
    } else {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ error: "Topilmadi" });
      const { passwordHash, plainPassword, ...safe } = user;
      res.json([safe]);
    }
  });

  app.get("/api/admins", requireSudo, async (req, res) => {
    const admins = await storage.getAllAdmins();
    res.json(admins.map(u => { const { passwordHash, ...safe } = u; return safe; }));
  });

  app.post("/api/users", requireSudo, async (req, res) => {
    const schema = z.object({
      username: z.string().min(2),
      password: z.string().min(4),
      fullName: z.string().min(1),
      faceUserId: z.string().optional(),
      role: z.enum(["sudo", "admin", "worker"]),
      groupId: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { username, password, fullName, faceUserId, role, groupId } = parsed.data;
    const existing = await storage.getUserByUsername(username);
    if (existing) return res.status(400).json({ error: "Bu login allaqachon mavjud" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await storage.createUser({ username, passwordHash, plainPassword: password, fullName, faceUserId: faceUserId || null, role });

    if (groupId && role === "worker") {
      await storage.addWorkerToGroup(groupId, user.id);
    }

    const { passwordHash: _, ...safe } = user;
    res.status(201).json(safe);
  });

  app.put("/api/users/:id", requireSudo, async (req, res) => {
    const schema = z.object({
      username: z.string().min(2).optional(),
      password: z.string().min(4).optional(),
      fullName: z.string().min(1).optional(),
      faceUserId: z.string().optional().nullable(),
      role: z.enum(["sudo", "admin", "worker"]).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const update: Record<string, unknown> = {};
    if (parsed.data.username) update.username = parsed.data.username;
    if (parsed.data.fullName) update.fullName = parsed.data.fullName;
    if (parsed.data.faceUserId !== undefined) update.faceUserId = parsed.data.faceUserId;
    if (parsed.data.role) update.role = parsed.data.role;
    if (parsed.data.password) {
      update.passwordHash = await bcrypt.hash(parsed.data.password, 12);
      update.plainPassword = parsed.data.password;
    }

    const user = await storage.updateUser(req.params.id, update as any);
    if (!user) return res.status(404).json({ error: "Topilmadi" });
    const { passwordHash, ...safe } = user;
    res.json(safe);
  });

  app.delete("/api/users/:id", requireSudo, async (req, res) => {
    await storage.deleteUser(req.params.id);
    res.json({ ok: true });
  });

  // Admin adds worker to their group
  app.post("/api/workers", requireAdmin, async (req, res) => {
    const schema = z.object({
      faceUserId: z.string().min(1),
      fullName: z.string().min(1),
      username: z.string().optional(),
      password: z.string().optional(),
      groupId: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { faceUserId, fullName, username, password, groupId } = parsed.data;

    if (req.session.role === "admin" && groupId) {
      const myGroups = await storage.getAdminGroups(req.session.userId!);
      const allowed = myGroups.some(g => g.id === groupId);
      if (!allowed) return res.status(403).json({ error: "Bu guruhga ruxsatingiz yo'q" });
    }

    let existing = await storage.getUserByFaceId(faceUserId);
    if (!existing) {
      const passwordHash = password ? await bcrypt.hash(password, 12) : null;
      existing = await storage.createUser({ faceUserId, fullName, username: username || null, passwordHash, role: "worker" });
    }

    if (groupId) {
      await storage.addWorkerToGroup(groupId, existing.id);
    }

    const { passwordHash, ...safe } = existing;
    res.status(201).json(safe);
  });

  // Worker update (admin can update workers in their groups)
  app.put("/api/workers/:id", requireAdmin, async (req, res) => {
    const schema = z.object({
      fullName: z.string().min(1).optional(),
      faceUserId: z.string().optional().nullable(),
      username: z.string().optional().nullable(),
      password: z.string().min(4).optional(),
      groupId: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    if (req.session.role === "admin") {
      const myGroups = await storage.getAdminGroups(req.session.userId!);
      const myGroupIds = myGroups.map(g => g.id);
      const workerGroups = await storage.getWorkerGroups(req.params.id);
      const inMyGroup = workerGroups.some(g => myGroupIds.includes(g.id));
      if (!inMyGroup) return res.status(403).json({ error: "Ruxsat yo'q" });
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.fullName) update.fullName = parsed.data.fullName;
    if (parsed.data.faceUserId !== undefined) update.faceUserId = parsed.data.faceUserId;
    if (parsed.data.username !== undefined) update.username = parsed.data.username;
    if (parsed.data.password) update.passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const user = await storage.updateUser(req.params.id, update as any);
    if (!user) return res.status(404).json({ error: "Topilmadi" });

    if (parsed.data.groupId !== undefined) {
      await storage.removeWorkerFromAllGroups(req.params.id);
      if (parsed.data.groupId) await storage.addWorkerToGroup(parsed.data.groupId, req.params.id);
    }

    const { passwordHash, ...safe } = user;
    res.json(safe);
  });

  // Get all workers (filtered by admin's groups)
  app.get("/api/workers", requireAdmin, async (req, res) => {
    if (req.session.role === "sudo") {
      const workers = await storage.getAllWorkers();
      const withGroups = await Promise.all(workers.map(async w => {
        const workerGroups = await storage.getWorkerGroups(w.id);
        const { passwordHash, ...safe } = w;
        return { ...safe, groups: workerGroups };
      }));
      return res.json(withGroups);
    }

    const myGroups = await storage.getAdminGroups(req.session.userId!);
    const workersMap = new Map<string, any>();
    for (const group of myGroups) {
      const groupWorkers = await storage.getGroupWorkers(group.id);
      for (const w of groupWorkers) {
        if (!workersMap.has(w.id)) {
          const workerGroups = await storage.getWorkerGroups(w.id);
          const { passwordHash, ...safe } = w;
          workersMap.set(w.id, { ...safe, groups: workerGroups });
        }
      }
    }
    res.json([...workersMap.values()]);
  });

  // ============ GROUPS ============
  app.get("/api/groups", requireAuth, async (req, res) => {
    if (req.session.role === "sudo") {
      const all = await storage.getAllGroups();
      const withDetails = await Promise.all(all.map(async g => {
        const admins = await storage.getGroupAdmins(g.id);
        const workers = await storage.getGroupWorkers(g.id);
        const shift = await storage.getShifts(g.id);
        return { ...g, admins: admins.map(a => { const { passwordHash, ...s } = a; return s; }), workerCount: workers.length, shifts: shift };
      }));
      return res.json(withDetails);
    }
    if (req.session.role === "admin") {
      const myGroups = await storage.getAdminGroups(req.session.userId!);
      const withDetails = await Promise.all(myGroups.map(async g => {
        const workers = await storage.getGroupWorkers(g.id);
        const shifts = await storage.getShifts(g.id);
        return { ...g, workerCount: workers.length, shifts };
      }));
      return res.json(withDetails);
    }
    // Worker sees their groups
    const myGroups = await storage.getWorkerGroups(req.session.userId!);
    res.json(myGroups);
  });

  app.post("/api/groups", requireSudo, async (req, res) => {
    const parsed = insertGroupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const group = await storage.createGroup(parsed.data);
    res.status(201).json(group);
  });

  app.put("/api/groups/:id", requireSudo, async (req, res) => {
    const schema = z.object({ name: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const group = await storage.updateGroup(req.params.id, parsed.data);
    res.json(group);
  });

  app.delete("/api/groups/:id", requireSudo, async (req, res) => {
    await storage.deleteGroup(req.params.id);
    res.json({ ok: true });
  });

  // Assign admin to group
  app.post("/api/groups/:id/admins", requireSudo, async (req, res) => {
    const { adminId } = req.body;
    if (!adminId) return res.status(400).json({ error: "adminId kerak" });
    await storage.assignAdminToGroup(req.params.id, adminId);
    res.json({ ok: true });
  });

  app.delete("/api/groups/:id/admins/:adminId", requireSudo, async (req, res) => {
    await storage.removeAdminFromGroup(req.params.id, req.params.adminId);
    res.json({ ok: true });
  });

  // Add/remove worker to/from group
  app.post("/api/groups/:id/workers", requireAdmin, async (req, res) => {
    const { workerId } = req.body;
    if (!workerId) return res.status(400).json({ error: "workerId kerak" });
    if (req.session.role === "admin") {
      const myGroups = await storage.getAdminGroups(req.session.userId!);
      if (!myGroups.some(g => g.id === req.params.id)) return res.status(403).json({ error: "Ruxsat yo'q" });
    }
    await storage.addWorkerToGroup(req.params.id, workerId);
    res.json({ ok: true });
  });

  app.delete("/api/groups/:id/workers/:workerId", requireAdmin, async (req, res) => {
    if (req.session.role === "admin") {
      const myGroups = await storage.getAdminGroups(req.session.userId!);
      if (!myGroups.some(g => g.id === req.params.id)) return res.status(403).json({ error: "Ruxsat yo'q" });
    }
    await storage.removeWorkerFromGroup(req.params.id, req.params.workerId);
    res.json({ ok: true });
  });

  // ============ SHIFTS ============
  app.get("/api/shifts", requireAdmin, async (req, res) => {
    const { groupId } = req.query;
    if (groupId) {
      if (req.session.role === "admin") {
        const myGroups = await storage.getAdminGroups(req.session.userId!);
        if (!myGroups.some(g => g.id === groupId)) return res.status(403).json({ error: "Ruxsat yo'q" });
      }
      return res.json(await storage.getShifts(groupId as string));
    }
    if (req.session.role === "sudo") return res.json(await storage.getAllShifts());
    const myGroups = await storage.getAdminGroups(req.session.userId!);
    const allShifts = await Promise.all(myGroups.map(g => storage.getShifts(g.id)));
    res.json(allShifts.flat());
  });

  app.post("/api/shifts", requireAdmin, async (req, res) => {
    const parsed = insertShiftSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    if (req.session.role === "admin") {
      const myGroups = await storage.getAdminGroups(req.session.userId!);
      if (!myGroups.some(g => g.id === parsed.data.groupId)) return res.status(403).json({ error: "Ruxsat yo'q" });
    }
    const shift = await storage.createShift(parsed.data);
    res.status(201).json(shift);
  });

  app.put("/api/shifts/:id", requireAdmin, async (req, res) => {
    const shift = await storage.updateShift(req.params.id, req.body);
    res.json(shift);
  });

  app.delete("/api/shifts/:id", requireAdmin, async (req, res) => {
    await storage.deleteShift(req.params.id);
    res.json({ ok: true });
  });

  // ============ HOLIDAYS ============
  app.get("/api/holidays", requireAuth, async (req, res) => {
    res.json(await storage.getHolidays());
  });

  app.post("/api/holidays", requireAdmin, async (req, res) => {
    const parsed = insertHolidaySchema.safeParse({ ...req.body, createdById: req.session.userId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const holiday = await storage.createHoliday(parsed.data);
    res.status(201).json(holiday);
  });

  app.delete("/api/holidays/:id", requireAdmin, async (req, res) => {
    await storage.deleteHoliday(req.params.id);
    res.json({ ok: true });
  });

  // ============ DEVICES ============
  app.get("/api/devices", requireAdmin, async (req, res) => {
    res.json(await storage.getAllDevices());
  });

  app.post("/api/devices", requireSudo, async (req, res) => {
    const parsed = insertDeviceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const device = await storage.createDevice(parsed.data);
    res.status(201).json(device);
  });

  app.put("/api/devices/:id", requireSudo, async (req, res) => {
    const device = await storage.updateDevice(req.params.id, req.body);
    res.json(device);
  });

  app.delete("/api/devices/:id", requireSudo, async (req, res) => {
    await storage.deleteDevice(req.params.id);
    res.json({ ok: true });
  });

  // ============ EVENTS (public endpoint for Hikvision devices) ============
  app.post("/api/events", async (req, res) => {
    const parsed = incomingEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { device_id, user_id, event_type, timestamp } = parsed.data;
    const ts = timestamp ? new Date(timestamp) : new Date();

    const user = await storage.getUserByFaceId(user_id);
    const resolvedName = user?.fullName || `Noma'lum (${user_id})`;

    const event = await storage.createEvent({
      faceUserId: user_id,
      resolvedName,
      deviceId: device_id,
      eventType: event_type,
      timestamp: ts,
    });

    // Deduplication: mark as first enter/exit of the day
    const dateStr = ts.toISOString().split("T")[0];
    const existing = await storage.getFirstEventOfDay(user_id, dateStr, event_type);
    if (!existing) {
      await storage.markFirstEvent(event.id, event_type);
      event.isFirstEnter = event_type === "enter";
      event.isFirstExit = event_type === "exit";
    }

    // Notification
    if (user && event_type === "enter" && (event.isFirstEnter || !existing)) {
      const workerGroups = await storage.getWorkerGroups(user.id);
      for (const group of workerGroups) {
        const config = await storage.getNotificationConfig(group.id);
        const message = config?.enterMessage || "Ishxonaga xush kelibsiz!";
        broadcastEvent({
          type: "notification",
          userId: user.id,
          faceUserId: user_id,
          name: resolvedName,
          groupId: group.id,
          message,
          timestamp: ts.toISOString(),
        });
      }
    }

    broadcastEvent({ type: "event", data: event });
    res.status(201).json(event);
  });

  // Get events (auth required)
  app.get("/api/events", requireAuth, async (req, res) => {
    const { deviceId, from, to, page = "1", limit = "50", faceUserId } = req.query;

    let filterFaceUserId: string | undefined = faceUserId as string;

    // Workers can only see their own events
    if (req.session.role === "worker") {
      const me = await storage.getUser(req.session.userId!);
      if (!me?.faceUserId) return res.json({ events: [], total: 0 });
      filterFaceUserId = me.faceUserId;
    }

    // Admins can only see events of workers in their groups
    if (req.session.role === "admin") {
      const myGroups = await storage.getAdminGroups(req.session.userId!);
      if (myGroups.length === 0) return res.json({ events: [], total: 0 });
      const myGroupWorkers = await Promise.all(myGroups.map(g => storage.getGroupWorkers(g.id)));
      const myFaceIds = myGroupWorkers.flat().filter(w => w.faceUserId).map(w => w.faceUserId!);
      if (filterFaceUserId && !myFaceIds.includes(filterFaceUserId)) {
        return res.json({ events: [], total: 0 });
      }
    }

    const result = await storage.getEvents({
      faceUserId: filterFaceUserId,
      deviceId: deviceId as string,
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined,
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
    });

    res.json(result);
  });

  app.get("/api/events/recent", requireAuth, async (req, res) => {
    let events = await storage.getRecentEvents(50);

    if (req.session.role === "worker") {
      const me = await storage.getUser(req.session.userId!);
      events = events.filter(e => e.faceUserId === me?.faceUserId);
    } else if (req.session.role === "admin") {
      const myGroups = await storage.getAdminGroups(req.session.userId!);
      const myGroupWorkers = await Promise.all(myGroups.map(g => storage.getGroupWorkers(g.id)));
      const myFaceIds = new Set(myGroupWorkers.flat().filter(w => w.faceUserId).map(w => w.faceUserId!));
      events = events.filter(e => e.faceUserId && myFaceIds.has(e.faceUserId));
    }

    res.json(events);
  });

  // ============ REPORT ============
  app.get("/api/events/report", requireAuth, async (req, res) => {
    const { dateFrom, dateTo, groupId } = req.query;
    if (!dateFrom || !dateTo) return res.status(400).json({ error: "dateFrom va dateTo kerak" });

    const from = new Date(dateFrom as string + "T00:00:00");
    const to = new Date(dateTo as string + "T23:59:59");

    // Get workers to include in report
    let workers: Awaited<ReturnType<typeof storage.getAllWorkers>> = [];
    if (req.session.role === "sudo") {
      if (groupId) {
        workers = await storage.getGroupWorkers(groupId as string);
      } else {
        workers = await storage.getAllWorkers();
      }
    } else if (req.session.role === "admin") {
      const myGroups = await storage.getAdminGroups(req.session.userId!);
      const targetGroup = groupId ? myGroups.find(g => g.id === groupId) : null;
      if (groupId && !targetGroup) return res.status(403).json({ error: "Ruxsat yo'q" });
      const groupsList = targetGroup ? [targetGroup] : myGroups;
      const workersLists = await Promise.all(groupsList.map(g => storage.getGroupWorkers(g.id)));
      const workerMap = new Map<string, typeof workers[0]>();
      workersLists.flat().forEach(w => workerMap.set(w.id, w));
      workers = [...workerMap.values()];
    } else {
      // Worker: only themselves
      const me = await storage.getUser(req.session.userId!);
      if (me) workers = [me];
    }

    // Get holidays in range
    const allHolidays = await storage.getHolidays();
    const holidayDates = new Set(allHolidays.map(h => h.date));

    // Get shifts for group
    let groupShifts: Awaited<ReturnType<typeof storage.getShifts>> = [];
    if (groupId) {
      groupShifts = await storage.getShifts(groupId as string);
    }

    // Build date list
    const dates: string[] = [];
    const cur = new Date(from);
    while (cur <= to) {
      dates.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate() + 1);
    }

    const report = await Promise.all(workers.filter(w => w.faceUserId).map(async worker => {
      const events = await storage.getWorkerEvents(worker.faceUserId!, from, to);
      const days = dates.map(date => {
        const isHoliday = holidayDates.has(date);
        const holiday = allHolidays.find(h => h.date === date);

        const dayEvents = events.filter(e => e.timestamp.toISOString().startsWith(date));
        const firstEnter = dayEvents.filter(e => e.eventType === "enter" && e.isFirstEnter)[0];
        const firstExit = dayEvents.filter(e => e.eventType === "exit" && e.isFirstExit)[0];

        let lateMinutes = 0;
        let earlyLeaveMinutes = 0;
        let workedMinutes = 0;

        if (firstEnter && groupShifts.length > 0) {
          const shift = groupShifts[0];
          const [sh, sm] = shift.startTime.split(":").map(Number);
          const [eh, em] = shift.endTime.split(":").map(Number);
          const enterTime = firstEnter.timestamp;
          const enterMinutes = enterTime.getHours() * 60 + enterTime.getMinutes();
          const shiftStartMinutes = sh * 60 + sm;
          const shiftEndMinutes = eh * 60 + em;

          if (enterMinutes > shiftStartMinutes) {
            lateMinutes = enterMinutes - shiftStartMinutes;
          }

          if (firstExit) {
            const exitTime = firstExit.timestamp;
            const exitMinutes = exitTime.getHours() * 60 + exitTime.getMinutes();
            if (exitMinutes < shiftEndMinutes) {
              earlyLeaveMinutes = shiftEndMinutes - exitMinutes;
            }
            workedMinutes = exitMinutes - enterMinutes;
          }
        } else if (firstEnter && firstExit) {
          const enterTime = firstEnter.timestamp;
          const exitTime = firstExit.timestamp;
          workedMinutes = (exitTime.getTime() - enterTime.getTime()) / 60000;
        }

        return {
          date,
          isHoliday,
          holidayName: holiday?.description,
          arrived: firstEnter ? firstEnter.timestamp.toISOString() : null,
          departed: firstExit ? firstExit.timestamp.toISOString() : null,
          lateMinutes,
          earlyLeaveMinutes,
          workedMinutes: Math.max(0, workedMinutes),
          present: !!firstEnter,
        };
      });

      const totalWorkDays = days.filter(d => d.present && !d.isHoliday).length;
      const totalWorkedMinutes = days.reduce((sum, d) => sum + d.workedMinutes, 0);

      return {
        worker: { id: worker.id, fullName: worker.fullName, faceUserId: worker.faceUserId },
        days,
        totalWorkDays,
        totalWorkedMinutes,
      };
    }));

    res.json({ report, dates, holidays: allHolidays });
  });

  // ============ NOTIFICATION CONFIGS ============
  app.get("/api/notifications/:groupId", requireAdmin, async (req, res) => {
    const config = await storage.getNotificationConfig(req.params.groupId);
    res.json(config || { groupId: req.params.groupId, enterMessage: "Ishxonaga xush kelibsiz!", exitMessage: "Xayr ko'rishguncha!" });
  });

  app.put("/api/notifications/:groupId", requireAdmin, async (req, res) => {
    const parsed = insertNotificationConfigSchema.safeParse({ groupId: req.params.groupId, ...req.body });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const config = await storage.upsertNotificationConfig(parsed.data);
    res.json(config);
  });

  // ============ CAMERA GUIDE ============
  app.get("/api/camera-guide", requireAdmin, async (req, res) => {
    res.json({
      steps: [
        { step: 1, title: "Kamera sozlamalari", description: "Hikvision qurilmangiz veb-interfeysiga kiring (odatda 192.168.x.x). Configuration > Network > Advanced > HTTP API-ni yoqing." },
        { step: 2, title: "Event konfiguratsiyasi", description: "Event > FaceID Event > Remote Notification. HTTP URL maydoniga server manzilingizni kiriting: https://sizning-domen.uz/api/events" },
        { step: 3, title: "Ma'lumotlar formati", description: "Qurilma quyidagi JSON formatda yuborishi kerak:\n{\n  \"device_id\": \"hikvision_1\",\n  \"user_id\": \"12345\",\n  \"event_type\": \"enter\",\n  \"timestamp\": \"2024-01-01T08:00:00\"\n}" },
        { step: 4, title: "User ID sinxronizatsiyasi", description: "Har bir xodim uchun FaceID dasturida user_id ni belgilang. Xuddi shu user_id ni tizimimizda ham ishlatiladi. Xodimni qo'shishda 'FaceID raqami' maydoniga shu raqamni kiriting." },
        { step: 5, title: "Test qilish", description: "curl -X POST https://sizning-domen.uz/api/events -H 'Content-Type: application/json' -d '{\"device_id\":\"hikvision_1\",\"user_id\":\"12345\",\"event_type\":\"enter\"}'\nMuvaffaqiyatli bo'lsa 201 status qaytariladi." },
        { step: 6, title: "Kameralar soni", description: "Tizim cheksiz miqdordagi kamerani qo'llab-quvvatlaydi. Har bir kamera uchun noyob device_id ishlating (masalan: hikvision_1, hikvision_kirish, ofis_kamera). Model farqi muhim emas." },
      ]
    });
  });

  // ============ STATS ============
  app.get("/api/stats", requireAuth, async (req, res) => {
    const today = new Date().toISOString().split("T")[0];
    const todayStart = new Date(today + "T00:00:00");
    const todayEnd = new Date(today + "T23:59:59");

    let workers: Awaited<ReturnType<typeof storage.getAllWorkers>> = [];
    if (req.session.role === "sudo") {
      workers = await storage.getAllWorkers();
    } else if (req.session.role === "admin") {
      const myGroups = await storage.getAdminGroups(req.session.userId!);
      const wLists = await Promise.all(myGroups.map(g => storage.getGroupWorkers(g.id)));
      const wMap = new Map<string, typeof workers[0]>();
      wLists.flat().forEach(w => wMap.set(w.id, w));
      workers = [...wMap.values()];
    } else {
      const me = await storage.getUser(req.session.userId!);
      if (me) workers = [me];
    }

    const faceIds = workers.filter(w => w.faceUserId).map(w => w.faceUserId!);
    const todayEvents = await storage.getEvents({ from: todayStart, to: todayEnd, limit: 1000 });
    const presentFaceIds = new Set(todayEvents.events.filter(e => e.eventType === "enter" && e.isFirstEnter && e.faceUserId && faceIds.includes(e.faceUserId)).map(e => e.faceUserId!));

    const groups = req.session.role === "sudo" ? await storage.getAllGroups() : await storage.getAdminGroups(req.session.userId!);
    const devices = await storage.getAllDevices();
    const recentEvents = await storage.getRecentEvents(10);

    res.json({
      totalWorkers: workers.length,
      presentToday: presentFaceIds.size,
      absentToday: workers.filter(w => w.faceUserId && !presentFaceIds.has(w.faceUserId)).length,
      totalGroups: groups.length,
      totalDevices: devices.length,
      recentEvents: req.session.role === "worker"
        ? recentEvents.filter(e => {
            return true;
          }).slice(0, 5)
        : recentEvents,
    });
  });

  // ============ WS ============
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "connected", message: "WebSocket ulandi" }));
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);
    ws.on("close", () => clearInterval(ping));
    ws.on("error", () => clearInterval(ping));
  });
}
