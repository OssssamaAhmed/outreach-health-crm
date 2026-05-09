import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "super_admin", "receptionist"]).default("receptionist").notNull(),
  fullName: varchar("fullName", { length: 255 }),
  nicNumber: varchar("nicNumber", { length: 20 }).unique(),
  phoneNumber: varchar("phoneNumber", { length: 32 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Patients table
export const patients = mysqlTable("patients", {
  id: int("id").autoincrement().primaryKey(),
  patientId: varchar("patientId", { length: 20 }).notNull().unique(), // P-0001 format
  name: varchar("name", { length: 255 }).notNull(),
  fatherName: varchar("fatherName", { length: 255 }),
  age: int("age"),
  gender: mysqlEnum("gender", ["Male", "Female", "Other"]),
  phone: varchar("phone", { length: 20 }),
  area: varchar("area", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
}, (t) => [
  index("patients_phone_idx").on(t.phone),
]);

export type Patient = typeof patients.$inferSelect;
export type InsertPatient = typeof patients.$inferInsert;

// Patient visits table
export const visits = mysqlTable("visits", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  visitNumber: int("visitNumber").notNull().default(1),
  visitDate: timestamp("visitDate").defaultNow().notNull(),
  complaint: varchar("complaint", { length: 500 }),
  diagnosis: varchar("diagnosis", { length: 500 }),
  medicineGiven: varchar("medicineGiven", { length: 500 }),
  bottleSize: varchar("bottleSize", { length: 50 }),
  dosage: varchar("dosage", { length: 255 }),
  medicineEndDate: timestamp("medicineEndDate"),
  eligibility: varchar("eligibility", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
  campId: int("campId"),
  doctor: varchar("doctor", { length: 255 }),
}, (t) => [
  index("visits_camp_idx").on(t.campId),
]);

export type Visit = typeof visits.$inferSelect;
export type InsertVisit = typeof visits.$inferInsert;

// Medicine reference list (now stockable: quantity + price)
export const medicines = mysqlTable("medicines", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  form: mysqlEnum("form", ["Tablet", "Syrup", "Capsule", "Injection", "Other"]).default("Tablet"),
  unit: varchar("unit", { length: 100 }),
  defaultDosage: varchar("defaultDosage", { length: 255 }),
  durationDays: int("durationDays"),
  notes: text("notes"),
  quantity: int("quantity").default(0).notNull(),
  price: decimal("price", { precision: 12, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Medicine = typeof medicines.$inferSelect;
export type InsertMedicine = typeof medicines.$inferInsert;

// Inventory table
export const inventory = mysqlTable("inventory", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  costCentre: varchar("costCentre", { length: 255 }),
  quantity: int("quantity").default(0),
  unit: varchar("unit", { length: 100 }),
  notes: text("notes"),
  lowStockThreshold: int("lowStockThreshold").default(5),
  price: decimal("price", { precision: 12, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = typeof inventory.$inferInsert;

// Medical camps
export const medicalCamps = mysqlTable("medical_camps", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  campDate: timestamp("campDate").notNull(),
  location: varchar("location", { length: 500 }),
  notes: text("notes"),
  totalPatients: int("totalPatients").default(0),
  totalVolunteers: int("totalVolunteers").default(0),
  totalExpense: decimal("totalExpense", { precision: 12, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["upcoming", "completed", "cancelled"]).default("upcoming"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
});

export type MedicalCamp = typeof medicalCamps.$inferSelect;
export type InsertMedicalCamp = typeof medicalCamps.$inferInsert;

// Camp doctors
export const campDoctors = mysqlTable("camp_doctors", {
  id: int("id").autoincrement().primaryKey(),
  campId: int("campId").notNull(),
  doctorName: varchar("doctorName", { length: 255 }).notNull(),
  specialty: varchar("specialty", { length: 255 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  qualification: varchar("qualification", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CampDoctor = typeof campDoctors.$inferSelect;
export type InsertCampDoctor = typeof campDoctors.$inferInsert;

// Camp tests/services
export const campTests = mysqlTable("camp_tests", {
  id: int("id").autoincrement().primaryKey(),
  campId: int("campId").notNull(),
  testName: varchar("testName", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CampTest = typeof campTests.$inferSelect;
export type InsertCampTest = typeof campTests.$inferInsert;

// Camp patient log (matching PDF format) — links back to main patients/visits
// for beneficiary continuity tracking. patientId/visitId are nullable for
// backward compat; clinical fields are free-text per design decision.
export const campPatients = mysqlTable("camp_patients", {
  id: int("id").autoincrement().primaryKey(),
  campId: int("campId").notNull(),
  serialNo: int("serialNo").notNull(),
  patientId: int("patientId"),
  visitId: int("visitId"),
  patientName: varchar("patientName", { length: 255 }).notNull(),
  age: varchar("age", { length: 20 }),
  phone: varchar("phone", { length: 30 }),
  fatherHusbandName: varchar("fatherHusbandName", { length: 255 }),
  area: varchar("area", { length: 255 }),
  doctor: varchar("doctor", { length: 255 }),
  complaint: text("complaint"),
  diagnosis: text("diagnosis"),
  tests: text("tests"),
  medicines: text("medicines"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("camp_patients_patient_idx").on(t.patientId),
]);

export type CampPatient = typeof campPatients.$inferSelect;
export type InsertCampPatient = typeof campPatients.$inferInsert;

// Activity log
export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 100 }),
  entityId: int("entityId"),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("activity_logs_user_entity_created_idx").on(t.userId, t.entityType, t.createdAt),
]);

// User sessions — tracks login/logout for staff activity reports
export const userSessions = mysqlTable("user_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  loginAt: timestamp("loginAt").defaultNow().notNull(),
  logoutAt: timestamp("logoutAt"),
  durationMinutes: int("durationMinutes"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: varchar("userAgent", { length: 500 }),
  autoClosed: boolean("autoClosed").default(false).notNull(),
}, (t) => [
  index("user_sessions_user_idx").on(t.userId),
  index("user_sessions_login_idx").on(t.loginAt),
  index("user_sessions_open_idx").on(t.userId, t.logoutAt),
]);

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;

export type ActivityLog = typeof activityLogs.$inferSelect;

// Pending invites (email allowlist for pre-authorizing roles before first sign-in)
export const pendingInvites = mysqlTable("pending_invites", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  assignedRole: mysqlEnum("assignedRole", ["admin", "receptionist"]).notNull(),
  invitedBy: int("invitedBy").notNull(),
  invitedAt: timestamp("invitedAt").defaultNow().notNull(),
});

export type PendingInvite = typeof pendingInvites.$inferSelect;
export type InsertPendingInvite = typeof pendingInvites.$inferInsert;

// Price history — written every time inventory.price or medicines.price changes
export const priceHistory = mysqlTable("price_history", {
  id: int("id").autoincrement().primaryKey(),
  entityType: mysqlEnum("entityType", ["inventory", "medicine"]).notNull(),
  entityId: int("entityId").notNull(),
  oldPrice: decimal("oldPrice", { precision: 12, scale: 2 }),
  newPrice: decimal("newPrice", { precision: 12, scale: 2 }).notNull(),
  changedBy: int("changedBy").notNull(),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
  reason: text("reason"),
}, (t) => [
  index("price_history_entity_idx").on(t.entityType, t.entityId),
]);

export type PriceHistory = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = typeof priceHistory.$inferInsert;

// Approval workflow — admin-initiated destructive actions await super_admin sign-off.
// payload is JSON-stringified update input for requestType='update', null for deletes.
export const pendingApprovals = mysqlTable("pending_approvals", {
  id: int("id").autoincrement().primaryKey(),
  requestedBy: int("requestedBy").notNull(),
  requestType: mysqlEnum("requestType", ["delete", "update"]).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId").notNull(),
  payload: text("payload"),
  reason: text("reason"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled", "superseded"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  decidedBy: int("decidedBy"),
  decidedAt: timestamp("decidedAt"),
  decisionNote: text("decisionNote"),
}, (t) => [
  index("pending_approvals_status_entity_idx").on(t.status, t.entityType, t.entityId),
  index("pending_approvals_requester_idx").on(t.requestedBy, t.status),
]);

export type PendingApproval = typeof pendingApprovals.$inferSelect;
export type InsertPendingApproval = typeof pendingApprovals.$inferInsert;

// User-facing notifications. type='request_decided' for admins on their own
// requests, type='new_pending_request' for super_admins on incoming requests,
// type='account_status_changed' for users when their account is (re)activated.
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["request_decided", "new_pending_request", "account_status_changed"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  link: varchar("link", { length: 500 }),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("notifications_user_read_idx").on(t.userId, t.readAt),
]);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
