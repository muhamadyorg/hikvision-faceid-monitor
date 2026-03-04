import { storage } from "./storage";
import bcrypt from "bcrypt";

export async function seedDatabase() {
  try {
    const existing = await storage.getUserByUsername("sudo");
    if (existing) return;

    const sudoHash = await bcrypt.hash("sudo1234", 12);
    await storage.createUser({ username: "sudo", passwordHash: sudoHash, role: "sudo" });

    const adminHash = await bcrypt.hash("admin1234", 12);
    const admin = await storage.createUser({ username: "admin", passwordHash: adminHash, role: "admin" });

    const userHash = await bcrypt.hash("user1234", 12);
    const user1 = await storage.createUser({ username: "operator1", passwordHash: userHash, role: "user" });

    await storage.createDevice({ name: "Asosiy Kirish", deviceIdentifier: "hikvision_1", location: "1-qavat kirish" });
    await storage.createDevice({ name: "Chiqish Eshigi", deviceIdentifier: "hikvision_2", location: "1-qavat chiqish" });
    await storage.createDevice({ name: "2-qavat Kirish", deviceIdentifier: "hikvision_3", location: "2-qavat kirish" });
    await storage.createDevice({ name: "Ombor Kirish", deviceIdentifier: "hikvision_4", location: "Ombor" });

    const ofisHash = await bcrypt.hash("ofis123", 12);
    const ofis = await storage.createGroup({ name: "Ofis", login: "ofis_group", passwordHash: ofisHash });

    const omborHash = await bcrypt.hash("ombor123", 12);
    const ombor = await storage.createGroup({ name: "Ombor", login: "ombor_group", passwordHash: omborHash });

    await storage.addUserToGroup(ofis.id, admin.id);
    await storage.addUserToGroup(ofis.id, user1.id);

    const people = ["Ali Valiyev", "Sardor Toshmatov", "Nilufar Xasanova", "Bobur Karimov", "Zulfiya Rahimova"];
    const devices = ["hikvision_1", "hikvision_2", "hikvision_3", "hikvision_4"];
    const now = new Date();

    for (let day = 9; day >= 0; day--) {
      for (const person of people) {
        const baseDate = new Date(now);
        baseDate.setDate(now.getDate() - day);
        baseDate.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30), 0, 0);
        await storage.createEvent({
          deviceId: devices[Math.floor(Math.random() * 2)],
          personName: person,
          eventType: "enter",
          timestamp: baseDate,
        });

        const exitDate = new Date(baseDate);
        exitDate.setHours(17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);
        await storage.createEvent({
          deviceId: devices[Math.floor(Math.random() * 2)],
          personName: person,
          eventType: "exit",
          timestamp: exitDate,
        });
      }
    }

    for (const person of people) {
      await storage.upsertWorkSchedule({ personName: person, workStart: "09:00", workEnd: "18:00" });
    }

    console.log("[seed] Database seeded successfully");
  } catch (err) {
    console.error("[seed] Error seeding database:", err);
  }
}
