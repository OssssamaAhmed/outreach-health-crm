import { and, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  activityLogs,
  campDoctors,
  campPatients,
  campTests,
  inventory,
  medicalCamps,
  medicines,
  patients,
  pendingInvites,
  userSessions,
  users,
  visits,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database not initialised. DATABASE_URL=" + (process.env.DATABASE_URL ? "present" : "missing"));

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }

  // Owner gets super_admin
  if (user.openId === ENV.ownerOpenId) {
    values.role = "super_admin";
    updateSet.role = "super_admin";
  } else if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialised. DATABASE_URL=" + (process.env.DATABASE_URL ? "present" : "missing"));
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "user" | "admin" | "super_admin" | "receptionist") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ─── Patients ─────────────────────────────────────────────────────────────────

export async function getNextPatientId(): Promise<string> {
  const db = await getDb();
  if (!db) return "P-0001";
  const result = await db
    .select({ patientId: patients.patientId })
    .from(patients)
    .orderBy(desc(patients.id))
    .limit(1);
  if (result.length === 0) return "P-0001";
  const last = result[0].patientId;
  const num = parseInt(last.replace("P-", ""), 10);
  return `P-${String(num + 1).padStart(4, "0")}`;
}

export async function createPatient(data: {
  name: string;
  fatherName?: string;
  age?: number;
  gender?: "Male" | "Female" | "Other";
  phone?: string;
  area?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const patientId = await getNextPatientId();
  await db.insert(patients).values({ ...data, patientId });
  const result = await db.select().from(patients).where(eq(patients.patientId, patientId)).limit(1);
  return result[0];
}

export async function getPatients(search?: string, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    return db
      .select()
      .from(patients)
      .where(or(like(patients.name, `%${search}%`), like(patients.phone, `%${search}%`), like(patients.patientId, `%${search}%`)))
      .orderBy(desc(patients.createdAt))
      .limit(limit)
      .offset(offset);
  }
  return db.select().from(patients).orderBy(desc(patients.createdAt)).limit(limit).offset(offset);
}

export async function getPatientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
  return result[0];
}

export async function getPatientByPatientId(patientId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(patients).where(eq(patients.patientId, patientId)).limit(1);
  return result[0];
}

export async function updatePatient(id: number, data: Partial<{ name: string; fatherName: string; age: number; gender: "Male" | "Female" | "Other"; phone: string; area: string }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(patients).set(data).where(eq(patients.id, id));
}

export async function getTotalPatients() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(patients);
  return Number(result[0]?.count ?? 0);
}

// ─── Visits ───────────────────────────────────────────────────────────────────

export async function createVisit(data: {
  patientId: number;
  visitDate?: Date;
  complaint?: string;
  diagnosis?: string;
  medicineGiven?: string;
  bottleSize?: string;
  dosage?: string;
  medicineEndDate?: Date;
  eligibility?: string;
  notes?: string;
  createdBy?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const lastVisit = await db
    .select({ visitNumber: visits.visitNumber })
    .from(visits)
    .where(eq(visits.patientId, data.patientId))
    .orderBy(desc(visits.visitNumber))
    .limit(1);
  const visitNumber = lastVisit.length > 0 ? lastVisit[0].visitNumber + 1 : 1;
  await db.insert(visits).values({ ...data, visitNumber });
  const result = await db
    .select()
    .from(visits)
    .where(and(eq(visits.patientId, data.patientId), eq(visits.visitNumber, visitNumber)))
    .limit(1);
  return result[0];
}

export async function getVisitsByPatient(patientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(visits).where(eq(visits.patientId, patientId)).orderBy(desc(visits.visitDate));
}

export async function getRecentVisits(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      visit: visits,
      patient: patients,
    })
    .from(visits)
    .innerJoin(patients, eq(visits.patientId, patients.id))
    .orderBy(desc(visits.visitDate))
    .limit(limit);
}

export async function getTotalVisits() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(visits);
  return Number(result[0]?.count ?? 0);
}

export async function getVisitsToday() {
  const db = await getDb();
  if (!db) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(visits)
    .where(sql`DATE(${visits.visitDate}) = CURDATE()`);
  return Number(result[0]?.count ?? 0);
}

// ─── Medicines ────────────────────────────────────────────────────────────────

export async function getMedicines() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(medicines).orderBy(medicines.category, medicines.name);
}

export async function createMedicine(data: {
  name: string;
  category?: string;
  form?: "Tablet" | "Syrup" | "Capsule" | "Injection" | "Other";
  unit?: string;
  defaultDosage?: string;
  durationDays?: number;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(medicines).values(data);
}

export async function updateMedicine(id: number, data: Partial<{ name: string; category: string; form: "Tablet" | "Syrup" | "Capsule" | "Injection" | "Other"; unit: string; defaultDosage: string; durationDays: number; notes: string }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(medicines).set(data).where(eq(medicines.id, id));
}

export async function deleteMedicine(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(medicines).where(eq(medicines.id, id));
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function getInventory(search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    return db
      .select()
      .from(inventory)
      .where(or(like(inventory.name, `%${search}%`), like(inventory.category, `%${search}%`), like(inventory.costCentre, `%${search}%`)))
      .orderBy(inventory.costCentre, inventory.name);
  }
  return db.select().from(inventory).orderBy(inventory.costCentre, inventory.name);
}

export async function getLowStockItems() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(inventory)
    .where(sql`${inventory.quantity} <= ${inventory.lowStockThreshold}`)
    .orderBy(inventory.quantity);
}

export async function createInventoryItem(data: {
  name: string;
  category?: string;
  costCentre?: string;
  quantity?: number;
  unit?: string;
  notes?: string;
  lowStockThreshold?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(inventory).values(data);
}

export async function updateInventoryItem(id: number, data: Partial<{ name: string; category: string; costCentre: string; quantity: number; unit: string; notes: string; lowStockThreshold: number }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(inventory).set(data).where(eq(inventory.id, id));
}

export async function deleteInventoryItem(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(inventory).where(eq(inventory.id, id));
}

// ─── Medical Camps ────────────────────────────────────────────────────────────

export async function getMedicalCamps() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(medicalCamps).orderBy(desc(medicalCamps.campDate));
}

export async function getMedicalCampById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(medicalCamps).where(eq(medicalCamps.id, id)).limit(1);
  return result[0];
}

export async function createMedicalCamp(data: {
  title: string;
  campDate: Date;
  location?: string;
  notes?: string;
  totalPatients?: number;
  totalVolunteers?: number;
  totalExpense?: string;
  status?: "upcoming" | "completed" | "cancelled";
  createdBy?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(medicalCamps).values(data);
  const result = await db.select().from(medicalCamps).orderBy(desc(medicalCamps.id)).limit(1);
  return result[0];
}

export async function updateMedicalCamp(id: number, data: Partial<{ title: string; campDate: Date; location: string; notes: string; totalPatients: number; totalVolunteers: number; totalExpense: string; status: "upcoming" | "completed" | "cancelled" }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(medicalCamps).set(data).where(eq(medicalCamps.id, id));
}

export async function getUpcomingCamps(limit = 5) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(medicalCamps)
    .where(and(eq(medicalCamps.status, "upcoming"), sql`${medicalCamps.campDate} >= NOW()`))
    .orderBy(medicalCamps.campDate)
    .limit(limit);
}

// ─── Camp Doctors ─────────────────────────────────────────────────────────────

export async function getCampDoctors(campId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campDoctors).where(eq(campDoctors.campId, campId));
}

export async function addCampDoctor(data: { campId: number; doctorName: string; specialty?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(campDoctors).values(data);
}

export async function removeCampDoctor(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(campDoctors).where(eq(campDoctors.id, id));
}

// ─── Camp Tests ───────────────────────────────────────────────────────────────

export async function getCampTests(campId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campTests).where(eq(campTests.campId, campId));
}

export async function addCampTest(data: { campId: number; testName: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(campTests).values(data);
}

export async function removeCampTest(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(campTests).where(eq(campTests.id, id));
}

// ─── Camp Patients ────────────────────────────────────────────────────────────

export async function getCampPatients(campId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campPatients).where(eq(campPatients.campId, campId)).orderBy(campPatients.serialNo);
}

export async function addCampPatient(data: {
  campId: number;
  serialNo: number;
  patientName: string;
  age?: string;
  phone?: string;
  fatherHusbandName?: string;
  area?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(campPatients).values(data);
}

export async function getNextCampSerialNo(campId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 1;
  const result = await db
    .select({ serialNo: campPatients.serialNo })
    .from(campPatients)
    .where(eq(campPatients.campId, campId))
    .orderBy(desc(campPatients.serialNo))
    .limit(1);
  return result.length > 0 ? result[0].serialNo + 1 : 1;
}

export async function removeCampPatient(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(campPatients).where(eq(campPatients.id, id));
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export async function logActivity(data: {
  userId?: number;
  action: string;
  entityType?: string;
  entityId?: number;
  details?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values(data);
}

export async function getActivityLogs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(limit);
}

// ─── User Sessions ────────────────────────────────────────────────────────────

function diffMinutes(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60000));
}

/**
 * Auto-close any open sessions for `userId` then open a new one.
 * Returns the new session id, or undefined if DB is unavailable.
 */
export async function openUserSession(data: {
  userId: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<number | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const now = new Date();

  // Auto-close any prior open sessions for this user
  const open = await db
    .select({ id: userSessions.id, loginAt: userSessions.loginAt })
    .from(userSessions)
    .where(and(eq(userSessions.userId, data.userId), isNull(userSessions.logoutAt)));
  for (const s of open) {
    await db
      .update(userSessions)
      .set({
        logoutAt: now,
        durationMinutes: diffMinutes(new Date(s.loginAt), now),
        autoClosed: true,
      })
      .where(eq(userSessions.id, s.id));
  }

  const ip = (data.ipAddress ?? "").slice(0, 64) || null;
  const ua = (data.userAgent ?? "").slice(0, 500) || null;
  const [result] = await db
    .insert(userSessions)
    .values({ userId: data.userId, loginAt: now, ipAddress: ip, userAgent: ua, autoClosed: false })
    .$returningId();
  return result?.id;
}

/**
 * Close the most recent open session for `userId`, if any.
 * Returns the closed session id, or undefined if none was open.
 */
export async function closeUserSession(userId: number): Promise<number | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const now = new Date();
  const [open] = await db
    .select({ id: userSessions.id, loginAt: userSessions.loginAt })
    .from(userSessions)
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.logoutAt)))
    .orderBy(desc(userSessions.loginAt))
    .limit(1);
  if (!open) return undefined;
  await db
    .update(userSessions)
    .set({ logoutAt: now, durationMinutes: diffMinutes(new Date(open.loginAt), now) })
    .where(eq(userSessions.id, open.id));
  return open.id;
}

// ─── Pending Invites (email allowlist) ───────────────────────────────────────

export async function listPendingInvites() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      invite: pendingInvites,
      invitedByName: users.name,
    })
    .from(pendingInvites)
    .leftJoin(users, eq(pendingInvites.invitedBy, users.id))
    .orderBy(desc(pendingInvites.invitedAt));
}

export async function findPendingInviteByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(pendingInvites)
    .where(eq(pendingInvites.email, email.toLowerCase()))
    .limit(1);
  return result[0];
}

export async function createPendingInvite(data: {
  email: string;
  assignedRole: "admin" | "receptionist";
  invitedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(pendingInvites).values({
    email: data.email.toLowerCase(),
    assignedRole: data.assignedRole,
    invitedBy: data.invitedBy,
  });
}

export async function consumePendingInvite(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(pendingInvites).where(eq(pendingInvites.id, id));
}

export async function findUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return result[0];
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { totalPatients: 0, totalVisits: 0, visitsToday: 0, totalCamps: 0, lowStockCount: 0 };
  const [totalPatients, totalVisits, visitsToday, totalCamps, lowStock] = await Promise.all([
    getTotalPatients(),
    getTotalVisits(),
    getVisitsToday(),
    db.select({ count: sql<number>`count(*)` }).from(medicalCamps).then(r => Number(r[0]?.count ?? 0)),
    getLowStockItems().then(r => r.length),
  ]);
  return { totalPatients, totalVisits, visitsToday, totalCamps, lowStockCount: lowStock };
}
