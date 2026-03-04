import { db } from "./db";
import bcrypt from "bcrypt";
import {
  users, groups, groupAdmins, groupWorkers, shifts, devices, events, holidays
} from "@shared/schema";

export async function seedDatabase() {
  try {
    const existing = await db.select().from(users).limit(1);
    if (existing.length > 0) return;

    const sudoUser = process.env.SUDO_USERNAME || "sudo";
    const sudoPw   = process.env.SUDO_PASSWORD  || "changeme_sudo";
    const adminUser = process.env.ADMIN_USERNAME || "admin";
    const adminPw   = process.env.ADMIN_PASSWORD || "changeme_admin";
    const workerUser = process.env.WORKER_USERNAME || "user";
    const workerPw   = process.env.WORKER_PASSWORD || "changeme_worker";

    const sudoHash   = await bcrypt.hash(sudoPw, 12);
    const adminHash  = await bcrypt.hash(adminPw, 12);
    const workerHash = await bcrypt.hash(workerPw, 12);

    const [sudo1] = await db.insert(users).values({
      username: sudoUser, passwordHash: sudoHash,
      fullName: "Super Admin", plainPassword: sudoPw, role: "sudo"
    }).returning();

    const [admin1] = await db.insert(users).values({
      username: adminUser, passwordHash: adminHash,
      fullName: "Administrator", plainPassword: adminPw, role: "admin"
    }).returning();

    const workerData = [
      { faceUserId: "1001", fullName: "Ali Valiyev",         username: workerUser,   passwordHash: workerHash, plainPassword: workerPw },
      { faceUserId: "1002", fullName: "Zulfiya Rahimova",    username: "zulfiya_r",  passwordHash: workerHash, plainPassword: workerPw },
      { faceUserId: "1003", fullName: "Sardor Toshmatov",    username: "sardor_t",   passwordHash: workerHash, plainPassword: workerPw },
      { faceUserId: "1004", fullName: "Nilufar Xasanova",    username: "nilufar_x",  passwordHash: workerHash, plainPassword: workerPw },
      { faceUserId: "1005", fullName: "Bobur Karimov",       username: "bobur_k",    passwordHash: workerHash, plainPassword: workerPw },
      { faceUserId: "1006", fullName: "Malika Yusupova",     username: "malika_y",   passwordHash: workerHash, plainPassword: workerPw },
      { faceUserId: "1007", fullName: "Jasur Raxmatullayev", username: "jasur_r",    passwordHash: workerHash, plainPassword: workerPw },
    ];

    const createdWorkers = await db.insert(users).values(
      workerData.map(w => ({ ...w, role: "worker" as const }))
    ).returning();

    const [ofisGroup]  = await db.insert(groups).values({ name: "Asosiy guruh" }).returning();
    const [omborGroup] = await db.insert(groups).values({ name: "Ombor guruhi" }).returning();

    await db.insert(groupAdmins).values([
      { groupId: ofisGroup.id,  adminId: admin1.id },
      { groupId: omborGroup.id, adminId: admin1.id },
    ]);

    await db.insert(groupWorkers).values([
      { groupId: ofisGroup.id,  workerId: createdWorkers[0].id },
      { groupId: ofisGroup.id,  workerId: createdWorkers[1].id },
      { groupId: ofisGroup.id,  workerId: createdWorkers[2].id },
      { groupId: ofisGroup.id,  workerId: createdWorkers[3].id },
      { groupId: omborGroup.id, workerId: createdWorkers[4].id },
      { groupId: omborGroup.id, workerId: createdWorkers[5].id },
      { groupId: omborGroup.id, workerId: createdWorkers[6].id },
    ]);

    await db.insert(shifts).values([
      { groupId: ofisGroup.id,  name: "1-smena", startTime: "09:00", endTime: "18:00", isNightShift: false },
      { groupId: omborGroup.id, name: "1-smena", startTime: "08:00", endTime: "17:00", isNightShift: false },
      { groupId: omborGroup.id, name: "2-smena", startTime: "20:00", endTime: "06:00", isNightShift: true  },
    ]);

    await db.insert(devices).values([
      { name: "Bosh kirish FaceID", deviceIdentifier: "hikvision_1", location: "Bosh kirish"    },
      { name: "Ofis FaceID",        deviceIdentifier: "hikvision_2", location: "Ofis kirishi"   },
      { name: "Ombor FaceID",       deviceIdentifier: "hikvision_3", location: "Ombor kirishi"  },
      { name: "Chiqish FaceID",     deviceIdentifier: "hikvision_4", location: "Asosiy chiqish" },
    ]);

    const thisYear = new Date().getFullYear();
    await db.insert(holidays).values([
      { date: `${thisYear}-01-01`, description: "Yangi yil"                  },
      { date: `${thisYear}-03-08`, description: "Xalqaro xotin-qizlar kuni" },
      { date: `${thisYear}-03-21`, description: "Navro'z"                   },
      { date: `${thisYear}-05-09`, description: "Xotira va qadrlash kuni"   },
      { date: `${thisYear}-09-01`, description: "Mustaqillik kuni"          },
    ]);

    const today = new Date();
    for (let day = 9; day >= 0; day--) {
      const date = new Date(today);
      date.setDate(date.getDate() - day);
      const dateStr = date.toISOString().split("T")[0];
      const dow = date.getDay();
      if (dow === 0 || dow === 6) continue;

      for (const worker of createdWorkers) {
        if (Math.random() < 0.1) continue;
        const enterTime = new Date(`${dateStr}T09:00:00`);
        enterTime.setMinutes(enterTime.getMinutes() + Math.floor(Math.random() * 45) - 15);
        const exitTime = new Date(`${dateStr}T18:00:00`);
        exitTime.setMinutes(exitTime.getMinutes() + Math.floor(Math.random() * 60) - 30);

        await db.insert(events).values({ faceUserId: worker.faceUserId!, resolvedName: worker.fullName, deviceId: "hikvision_1", eventType: "enter", timestamp: enterTime, isFirstEnter: true,  isFirstExit: false });
        await db.insert(events).values({ faceUserId: worker.faceUserId!, resolvedName: worker.fullName, deviceId: "hikvision_4", eventType: "exit",  timestamp: exitTime,  isFirstEnter: false, isFirstExit: true  });
      }
    }

    console.log(`[seed] Tayyor! Login: ${sudoUser}/${sudoPw} | ${adminUser}/${adminPw} | ${workerUser}/${workerPw}`);
  } catch (err) {
    console.error("[seed] Xato:", err);
  }
}
