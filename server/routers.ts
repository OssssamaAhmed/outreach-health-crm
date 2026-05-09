import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import ExcelJS from "exceljs";
import { parse as parseCsv } from "csv-parse/sync";
import { getDb, logActivity, closeUserSession } from "./db";
import { ENV } from "./_core/env";
import { isDemoSeedUser } from "./_core/demo";
import {
  patients, visits, medicines, inventory,
  medicalCamps, campDoctors, campTests, campPatients, users,
  pendingInvites, userSessions, pendingApprovals, priceHistory, activityLogs, notifications,
} from "../drizzle/schema";
import { eq, like, or, desc, asc, and, lte, gte, sql, inArray, notInArray, type SQL } from "drizzle-orm";

// ── Role helpers ──────────────────────────────────────────────────────────────

function isAdminOrAbove(role: string) {
  return role === "admin" || role === "super_admin";
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdminOrAbove(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "super_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Super admin access required" });
  }
  return next({ ctx });
});

// ── Offline-import parsing helpers ────────────────────────────────────────────

type IntakeRow = {
  rowIndex: number;
  date: string;
  name: string;
  fatherName: string;
  age: string;
  gender: "" | "Male" | "Female" | "Other";
  phone: string;
  area: string;
  complaint: string;
  diagnosis: string;
  medicineGiven: string;
  bottleSize: string;
  dosage: string;
};

function normalizeIntakeDate(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    // Excel serial date fallback (exceljs usually hydrates Dates already)
    const dt = new Date(Math.round((value - 25569) * 86400 * 1000));
    return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return "";
  const s = value.trim();
  if (!s) return "";
  const slashed = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (slashed) {
    const [, dd, mm, yy] = slashed;
    const d = parseInt(dd, 10);
    const mo = parseInt(mm, 10) - 1;
    const y = yy.length === 2 ? 2000 + parseInt(yy, 10) : parseInt(yy, 10);
    if (y >= 2020 && y <= 2035 && mo >= 0 && mo <= 11 && d >= 1 && d <= 31) {
      const dt = new Date(y, mo, d);
      if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    }
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime()) && dt.getFullYear() >= 2020 && dt.getFullYear() <= 2035) {
    return dt.toISOString().slice(0, 10);
  }
  return "";
}

function normalizeIntakeGender(value: unknown): "" | "Male" | "Female" | "Other" {
  if (!value) return "";
  const s = String(value).trim().toLowerCase();
  if (s === "f" || s === "female") return "Female";
  if (s === "m" || s === "male") return "Male";
  if (s === "other") return "Other";
  return "";
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && value !== null && "result" in (value as Record<string, unknown>)) {
    return cellToString((value as { result: unknown }).result);
  }
  if (typeof value === "object" && value !== null && "text" in (value as Record<string, unknown>)) {
    return cellToString((value as { text: unknown }).text);
  }
  return String(value).trim();
}

async function parseIntakeXlsx(buffer: Buffer): Promise<IntakeRow[]> {
  const wb = new ExcelJS.Workbook();
  // exceljs types accept ArrayBuffer or a stricter Buffer shape; cast keeps it portable.
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.getWorksheet("Daily Entry") ?? wb.worksheets[0];
  if (!ws) return [];
  const rows: IntakeRow[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const get = (col: number) => cellToString(row.getCell(col).value);
    const r: IntakeRow = {
      rowIndex: rowNumber,
      date: normalizeIntakeDate(row.getCell(1).value),
      name: get(2),
      fatherName: get(3),
      age: get(4),
      gender: normalizeIntakeGender(get(5)),
      phone: get(6),
      area: get(7),
      complaint: get(8),
      diagnosis: get(9),
      medicineGiven: get(10),
      bottleSize: get(11),
      dosage: get(12),
    };
    if (!r.date && !r.name && !r.phone) return;
    rows.push(r);
  });
  return rows;
}

function parseIntakeCsv(buffer: Buffer): IntakeRow[] {
  const text = buffer.toString("utf-8").replace(/^﻿/, "");
  const records: string[][] = parseCsv(text, {
    columns: false,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as string[][];
  if (records.length === 0) return [];
  let headerIdx = records.findIndex((r) => (r[0] ?? "").toLowerCase() === "date");
  if (headerIdx === -1) headerIdx = 0;
  const dataRows = records.slice(headerIdx + 1);
  const out: IntakeRow[] = [];
  dataRows.forEach((r, idx) => {
    const row: IntakeRow = {
      rowIndex: idx + headerIdx + 2,
      date: normalizeIntakeDate(r[0]),
      name: (r[1] ?? "").trim(),
      fatherName: (r[2] ?? "").trim(),
      age: (r[3] ?? "").trim(),
      gender: normalizeIntakeGender(r[4]),
      phone: (r[5] ?? "").trim(),
      area: (r[6] ?? "").trim(),
      complaint: (r[7] ?? "").trim(),
      diagnosis: (r[8] ?? "").trim(),
      medicineGiven: (r[9] ?? "").trim(),
      bottleSize: (r[10] ?? "").trim(),
      dosage: (r[11] ?? "").trim(),
    };
    if (!row.date && !row.name && !row.phone) return;
    out.push(row);
  });
  return out;
}

// ── Patient ID generator ──────────────────────────────────────────────────────

async function generatePatientId(): Promise<string> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  const rows = await db
    .select({ patientId: patients.patientId })
    .from(patients)
    .orderBy(desc(patients.id))
    .limit(1);
  if (rows.length === 0) return "P-0001";
  const last = rows[0]!.patientId;
  const num = parseInt(last.replace("P-", ""), 10);
  return `P-${String(num + 1).padStart(4, "0")}`;
}

// ── Pagination — list pages use 20 rows/page across the app ──────────────────

const PAGE_SIZE = 20;
function pageOffset(page?: number) {
  const p = Math.max(1, Math.floor(page ?? 1));
  return (p - 1) * PAGE_SIZE;
}

// ── Approval workflow helpers (Change 1) ─────────────────────────────────────

/**
 * Approvable entity types and their allowed request types.
 *   delete: every top-level main-data table (patient, visit, inventory,
 *           medicine, medical_camp). Camp sub-entities are NOT approvable
 *           per Q1.1 (editorial work stays direct for admins).
 *   update: only patient, inventory, medicine. Visits and camps don't
 *           need update approval per the role-routing table.
 */
type ApprovableEntityType = "patient" | "visit" | "inventory" | "medicine" | "medical_camp";

const APPROVABLE_ENTITY_TYPES: readonly ApprovableEntityType[] = [
  "patient", "visit", "inventory", "medicine", "medical_camp",
];

const UPDATABLE_ENTITY_TYPES: readonly ApprovableEntityType[] = [
  "patient", "inventory", "medicine",
];

// Per-entity update payload schemas. Mirror the existing direct-route
// inputs so requested updates can't smuggle in invalid fields. All
// strict() — extra keys rejected.
const patientUpdateSchema = z.object({
  name: z.string().min(1),
  fatherName: z.string().optional(),
  age: z.string().optional(),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  phone: z.string().optional(),
  area: z.string().optional(),
}).strict();

const inventoryUpdateSchema = z.object({
  name: z.string().min(1),
  category: z.string(),
  costCentre: z.string().nullable().optional(),
  quantity: z.number().min(0),
  unit: z.string(),
  lowStockThreshold: z.number().min(0).optional(),
  notes: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
}).strict();

const medicineUpdateSchema = z.object({
  name: z.string().min(1),
  category: z.string(),
  form: z.enum(["Tablet", "Syrup", "Capsule", "Injection", "Other"]),
  unit: z.string().optional(),
  defaultDosage: z.string().optional(),
  durationDays: z.number().optional(),
  notes: z.string().optional(),
  quantity: z.number().min(0),
  price: z.string().nullable().optional(),
}).strict();

function validateUpdatePayload(entityType: ApprovableEntityType, payload: unknown) {
  switch (entityType) {
    case "patient":   return patientUpdateSchema.parse(payload);
    case "inventory": return inventoryUpdateSchema.parse(payload);
    case "medicine":  return medicineUpdateSchema.parse(payload);
    default:
      throw new TRPCError({ code: "BAD_REQUEST", message: `Updates for ${entityType} cannot be requested through approvals` });
  }
}

/**
 * Quantity major-update rule (Q3.2): require approval if the absolute
 * delta is more than 10% of the current value OR more than 50 absolute
 * units. Both inventory and medicine quantities use this rule.
 */
function quantityChangeIsMajor(oldQty: number | null | undefined, newQty: number): boolean {
  const o = oldQty ?? 0;
  const delta = Math.abs(newQty - o);
  if (delta === 0) return false;
  if (delta > 50) return true;
  if (o === 0) return true; // any non-zero new value when old is 0 → major
  return delta / Math.abs(o) > 0.10;
}

/**
 * Detect whether an update payload contains any "major" changes that
 * require super_admin approval. Compares against the current row.
 */
function isMajorUpdate(
  entityType: ApprovableEntityType,
  current: Record<string, unknown>,
  payload: Record<string, unknown>,
): boolean {
  const eq = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);
  switch (entityType) {
    case "patient": {
      // Major fields: name, phone. (nicNumber doesn't exist on patients per schema.)
      if (payload.name !== undefined && !eq(payload.name, current.name)) return true;
      if (payload.phone !== undefined && !eq(payload.phone, current.phone)) return true;
      return false;
    }
    case "inventory": {
      const oldPrice = current.price == null ? null : Number(current.price);
      const newPrice = payload.price == null ? null : Number(payload.price);
      if (oldPrice !== newPrice) return true;
      if (payload.quantity !== undefined &&
          quantityChangeIsMajor(current.quantity as number | null, Number(payload.quantity))) {
        return true;
      }
      return false;
    }
    case "medicine": {
      const oldPrice = current.price == null ? null : Number(current.price);
      const newPrice = payload.price == null ? null : Number(payload.price);
      if (oldPrice !== newPrice) return true;
      if (payload.quantity !== undefined &&
          quantityChangeIsMajor(current.quantity as number | null, Number(payload.quantity))) {
        return true;
      }
      return false;
    }
    default:
      return false;
  }
}

/**
 * Block any pending request on the same (entityType, entityId) regardless
 * of requestType or requester. Q1.2 ruling: one pending request per row.
 */
async function assertNoExistingPending(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  entityType: string,
  entityId: number,
) {
  const [existing] = await db
    .select({
      id: pendingApprovals.id,
      requestType: pendingApprovals.requestType,
      requesterFullName: users.fullName,
      requesterGoogleName: users.name,
    })
    .from(pendingApprovals)
    .leftJoin(users, eq(users.id, pendingApprovals.requestedBy))
    .where(and(
      eq(pendingApprovals.entityType, entityType),
      eq(pendingApprovals.entityId, entityId),
      eq(pendingApprovals.status, "pending"),
    ))
    .limit(1);
  if (existing) {
    const who = existing.requesterFullName ?? existing.requesterGoogleName ?? "another admin";
    throw new TRPCError({
      code: "CONFLICT",
      message: `There's already a pending ${existing.requestType} request for this item by ${who}. See pending approvals.`,
    });
  }
}

/**
 * For admin list views: fetch the entity IDs that currently have pending
 * delete requests on them. Returns [] for super_admin (no filtering).
 * When pending_approvals is empty, returns []. Cheap query — indexed on
 * (status, entityType, entityId).
 */
async function fetchAdminFilterPendingDeleteIds(
  role: string,
  entityType: ApprovableEntityType,
): Promise<number[]> {
  if (role !== "admin") return [];
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ entityId: pendingApprovals.entityId })
    .from(pendingApprovals)
    .where(and(
      eq(pendingApprovals.entityType, entityType),
      eq(pendingApprovals.requestType, "delete"),
      eq(pendingApprovals.status, "pending"),
    ));
  return rows.map((r) => r.entityId);
}

/**
 * Convenience: should the request route admin's destructive action
 * through the approval workflow instead of direct execution?
 */
function requiresApprovalRouting(role: string): boolean {
  return role === "admin" && ENV.approvalsEnforced;
}

/**
 * Fetch pending request info for a set of entity IDs. Returns a Map keyed
 * by entityId; values contain enough info for inline badges + edit-lock
 * decisions. Used to enrich list responses for both admin and super_admin
 * (admin sees pending updates only since pending-deletes are filtered out
 * at query time; super_admin sees everything).
 */
type PendingRequestInfo = {
  id: number;
  requestType: "delete" | "update";
  requestedBy: number;
  requesterName: string;
  reason: string | null;
};

async function fetchPendingForEntities(
  entityType: ApprovableEntityType,
  ids: number[],
): Promise<Map<number, PendingRequestInfo>> {
  if (ids.length === 0) return new Map();
  const db = await getDb();
  if (!db) return new Map();
  const rows = await db
    .select({
      id: pendingApprovals.id,
      entityId: pendingApprovals.entityId,
      requestType: pendingApprovals.requestType,
      requestedBy: pendingApprovals.requestedBy,
      requesterFullName: users.fullName,
      requesterGoogleName: users.name,
      requesterEmail: users.email,
      reason: pendingApprovals.reason,
    })
    .from(pendingApprovals)
    .leftJoin(users, eq(users.id, pendingApprovals.requestedBy))
    .where(and(
      eq(pendingApprovals.entityType, entityType),
      inArray(pendingApprovals.entityId, ids),
      eq(pendingApprovals.status, "pending"),
    ));
  const map = new Map<number, PendingRequestInfo>();
  for (const r of rows) {
    map.set(r.entityId, {
      id: r.id,
      requestType: r.requestType,
      requestedBy: r.requestedBy,
      requesterName: r.requesterFullName ?? r.requesterGoogleName ?? r.requesterEmail ?? "Admin",
      reason: r.reason,
    });
  }
  return map;
}

// ── Notification helpers ─────────────────────────────────────────────────────
type NotificationType = "request_decided" | "new_pending_request" | "account_status_changed";

/**
 * Best-effort notification write. Failures are logged but never thrown — a
 * notification problem must not break the underlying mutation that triggered it.
 */
async function notifyUser(
  userId: number,
  type: NotificationType,
  title: string,
  message: string | null,
  link: string | null,
) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(notifications).values({ userId, type, title, message, link });
  } catch (err) {
    console.error("[notifyUser] failed", { userId, type, err });
  }
}

/** Fan out a notification to every active super-admin (optionally excluding one userId). */
async function notifyAllSuperAdmins(
  type: NotificationType,
  title: string,
  message: string | null,
  link: string | null,
  exceptUserId?: number,
) {
  try {
    const db = await getDb();
    if (!db) return;
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "super_admin"), eq(users.isActive, true)));
    const targets = admins.filter((u) => u.id !== exceptUserId);
    if (targets.length === 0) return;
    await db.insert(notifications).values(
      targets.map((u) => ({ userId: u.id, type, title, message, link })),
    );
  } catch (err) {
    console.error("[notifyAllSuperAdmins] failed", { type, err });
  }
}

// ── Patients query helper (list + export share this) ──────────────────────────

function buildPatientsWhere(input: { search?: string; dateFrom?: string; dateTo?: string; excludeIds?: number[] }) {
  const conditions: SQL[] = [];
  if (input.search) {
    const term = `%${input.search}%`;
    const searchClause = or(
      like(patients.name, term),
      like(patients.phone, term),
      like(patients.patientId, term)
    );
    if (searchClause) conditions.push(searchClause);
  }
  if (input.dateFrom) conditions.push(gte(patients.createdAt, new Date(input.dateFrom)));
  if (input.dateTo) conditions.push(lte(patients.createdAt, new Date(input.dateTo)));
  if (input.excludeIds && input.excludeIds.length > 0) {
    conditions.push(notInArray(patients.id, input.excludeIds));
  }
  return conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
}

async function queryPatientsWithLastVisit(input: {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  excludeIds?: number[];
}) {
  const db = await getDb();
  if (!db) return [];
  const where = buildPatientsWhere(input);

  const baseQuery = db
    .select({
      patient: patients,
      lastVisitAt: sql<Date | null>`MAX(${visits.visitDate})`,
    })
    .from(patients)
    .leftJoin(visits, eq(visits.patientId, patients.id))
    .where(where)
    .groupBy(patients.id)
    .orderBy(desc(patients.id));

  const rows = input.page !== undefined
    ? await baseQuery.limit(PAGE_SIZE).offset(pageOffset(input.page))
    : await baseQuery;

  return rows.map((r) => ({
    ...r.patient,
    lastVisitAt: r.lastVisitAt ? new Date(r.lastVisitAt) : null,
  }));
}

async function countPatients(input: { search?: string; dateFrom?: string; dateTo?: string; excludeIds?: number[] }) {
  const db = await getDb();
  if (!db) return 0;
  const where = buildPatientsWhere(input);
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(patients).where(where);
  return Number(row?.count ?? 0);
}

// ── App Router ────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      // Close the tracked session row, if a user is logged in
      if (ctx.user) {
        try {
          const sessionId = await closeUserSession(ctx.user.id);
          if (sessionId !== undefined) {
            await logActivity({ userId: ctx.user.id, action: "logout", entityType: "session", entityId: sessionId });
          }
        } catch (err) {
          console.error("[auth.logout] Failed to close session", err);
        }
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── Dashboard ──────────────────────────────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { totalPatients: 0, totalVisits: 0, visitsToday: 0, totalCamps: 0, inventoryWorth: 0, medicinesWorth: 0 };

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [patCount] = await db.select({ count: sql<number>`count(*)` }).from(patients);
      const [visitCount] = await db.select({ count: sql<number>`count(*)` }).from(visits);
      const [todayCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(visits)
        .where(and(gte(visits.visitDate, today), lte(visits.visitDate, tomorrow)));

      let campCount = { count: 0 };
      let inventoryWorth = 0;
      let medicinesWorth = 0;
      if (isAdminOrAbove(ctx.user.role)) {
        const [c] = await db.select({ count: sql<number>`count(*)` }).from(medicalCamps);
        campCount = c ?? campCount;
        const [invW] = await db
          .select({ worth: sql<number>`coalesce(sum(${inventory.price} * ${inventory.quantity}), 0)` })
          .from(inventory);
        const [medW] = await db
          .select({ worth: sql<number>`coalesce(sum(${medicines.price} * ${medicines.quantity}), 0)` })
          .from(medicines);
        inventoryWorth = Number(invW?.worth ?? 0);
        medicinesWorth = Number(medW?.worth ?? 0);
      }

      return {
        totalPatients: Number(patCount?.count ?? 0),
        totalVisits: Number(visitCount?.count ?? 0),
        visitsToday: Number(todayCount?.count ?? 0),
        totalCamps: Number(campCount.count),
        inventoryWorth,
        medicinesWorth,
      };
    }),

    recentVisits: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(visits)
        .innerJoin(patients, eq(visits.patientId, patients.id))
        .orderBy(desc(visits.visitDate), desc(visits.id))
        .limit(15);
      return rows.map((r) => ({ visit: r.visits, patient: r.patients }));
    }),

    upcomingCamps: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return db
        .select()
        .from(medicalCamps)
        .where(gte(medicalCamps.campDate, today))
        .orderBy(asc(medicalCamps.campDate))
        .limit(5);
    }),

    lowStockItems: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const all = await db.select().from(inventory);
      return all.filter((i) => (i.quantity ?? 0) <= (i.lowStockThreshold ?? 2));
    }),
  }),

  // ── Patients ───────────────────────────────────────────────────────────────
  patients: router({
    nextId: protectedProcedure.query(async () => {
      return { patientId: await generatePatientId() };
    }),

    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        page: z.number().int().min(1).default(1),
      }))
      .query(async ({ input, ctx }) => {
        const excludeIds = await fetchAdminFilterPendingDeleteIds(ctx.user.role, "patient");
        const filtered = { ...input, excludeIds };
        const [rows, total] = await Promise.all([
          queryPatientsWithLastVisit(filtered),
          countPatients(filtered),
        ]);
        return { rows, total };
      }),

    export: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const excludeIds = await fetchAdminFilterPendingDeleteIds(ctx.user.role, "patient");
        return queryPatientsWithLastVisit({ ...input, excludeIds });
      }),

    stats: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { countAllTime: 0, countThisWeek: 0, countThisMonth: 0, countThisYear: 0 };

      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const dayOfWeek = startOfDay.getDay(); // Sun=0..Sat=6
      const weekStart = new Date(startOfDay);
      weekStart.setDate(startOfDay.getDate() - ((dayOfWeek + 6) % 7)); // Monday
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const [row] = await db
        .select({
          allTime: sql<number>`count(*)`,
          week: sql<number>`sum(case when ${patients.createdAt} >= ${weekStart} then 1 else 0 end)`,
          month: sql<number>`sum(case when ${patients.createdAt} >= ${monthStart} then 1 else 0 end)`,
          year: sql<number>`sum(case when ${patients.createdAt} >= ${yearStart} then 1 else 0 end)`,
        })
        .from(patients);

      return {
        countAllTime: Number(row?.allTime ?? 0),
        countThisWeek: Number(row?.week ?? 0),
        countThisMonth: Number(row?.month ?? 0),
        countThisYear: Number(row?.year ?? 0),
      };
    }),

    detail: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [patient] = await db.select().from(patients).where(eq(patients.id, input.id));
        if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });
        // Visits enriched with campTitle via LEFT JOIN — null when not a camp visit
        // or when the linked camp was deleted. Powers the camp tag in the visits list.
        const patientVisits = await db
          .select({
            id:               visits.id,
            patientId:        visits.patientId,
            visitNumber:      visits.visitNumber,
            visitDate:        visits.visitDate,
            complaint:        visits.complaint,
            diagnosis:        visits.diagnosis,
            medicineGiven:    visits.medicineGiven,
            bottleSize:       visits.bottleSize,
            dosage:           visits.dosage,
            medicineEndDate:  visits.medicineEndDate,
            eligibility:      visits.eligibility,
            notes:            visits.notes,
            createdAt:        visits.createdAt,
            createdBy:        visits.createdBy,
            campId:           visits.campId,
            doctor:           visits.doctor,
            campTitle:        medicalCamps.title,
          })
          .from(visits)
          .leftJoin(medicalCamps, eq(medicalCamps.id, visits.campId))
          .where(eq(visits.patientId, input.id))
          .orderBy(desc(visits.visitNumber));
        return { patient, visits: patientVisits };
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        fatherName: z.string().optional(),
        age: z.string().optional(),
        gender: z.enum(["Male", "Female", "Other"]).default("Male"),
        phone: z.string().optional(),
        area: z.string().optional(),
        complaint: z.string().optional(),
        diagnosis: z.string().optional(),
        medicineGiven: z.string().optional(),
        bottleSize: z.string().optional(),
        dosage: z.string().optional(),
        medicineEndDate: z.string().optional(),
        notes: z.string().optional(),
        doctor: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const patientId = await generatePatientId();
        const ageNum = input.age ? parseInt(input.age, 10) : null;
        const [result] = await db.insert(patients).values({
          patientId,
          name: input.name,
          fatherName: input.fatherName || null,
          age: isNaN(ageNum as number) ? null : ageNum,
          gender: input.gender,
          phone: input.phone || null,
          area: input.area || null,
          createdBy: ctx.user.id,
        }).$returningId();
        const newId = result!.id;

        // Insert first visit
        await db.insert(visits).values({
          patientId: newId,
          visitNumber: 1,
          visitDate: new Date(),
          complaint: input.complaint || null,
          diagnosis: input.diagnosis || null,
          medicineGiven: input.medicineGiven || null,
          bottleSize: input.bottleSize || null,
          dosage: input.dosage || null,
          medicineEndDate: input.medicineEndDate ? new Date(input.medicineEndDate) : null,
          notes: input.notes || null,
          doctor: input.doctor?.trim() || null,
          createdBy: ctx.user.id,
        });

        await logActivity({ userId: ctx.user.id, action: "create", entityType: "patient", entityId: newId, details: patientId });

        return { id: newId, patientId };
      }),

    addVisit: protectedProcedure
      .input(z.object({
        patientId: z.number(),
        visitNumber: z.number(),
        visitDate: z.string(),
        complaint: z.string().optional(),
        diagnosis: z.string().optional(),
        medicineGiven: z.string().optional(),
        bottleSize: z.string().optional(),
        dosage: z.string().optional(),
        medicineEndDate: z.string().optional(),
        notes: z.string().optional(),
        doctor: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(visits).values({
          patientId: input.patientId,
          visitNumber: input.visitNumber,
          visitDate: new Date(input.visitDate),
          complaint: input.complaint || null,
          diagnosis: input.diagnosis || null,
          medicineGiven: input.medicineGiven || null,
          bottleSize: input.bottleSize || null,
          dosage: input.dosage || null,
          medicineEndDate: input.medicineEndDate ? new Date(input.medicineEndDate) : null,
          notes: input.notes || null,
          doctor: input.doctor?.trim() || null,
          createdBy: ctx.user.id,
        });
        await logActivity({ userId: ctx.user.id, action: "create", entityType: "visit", entityId: input.patientId });
        return { success: true };
      }),

    /**
     * Lookup helper for the camp-patient dialog (commit C). Returns the
     * matched master patient + their last visit + total visits, or null
     * if no match. Phone takes precedence; falls back to exact
     * name+age+gender when phone is empty.
     */
    findCandidate: protectedProcedure
      .input(z.object({
        phone: z.string().optional(),
        name: z.string().optional(),
        age: z.string().optional(),
        gender: z.enum(["Male", "Female", "Other"]).optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const projection = {
          id: patients.id,
          patientId: patients.patientId,
          name: patients.name,
          age: patients.age,
          gender: patients.gender,
          phone: patients.phone,
          area: patients.area,
        };

        let match: { id: number; patientId: string; name: string; age: number | null; gender: "Male" | "Female" | "Other" | null; phone: string | null; area: string | null } | undefined;

        const phone = input.phone?.trim();
        if (phone) {
          [match] = await db.select(projection).from(patients).where(eq(patients.phone, phone)).limit(1);
        } else if (input.name && input.age && input.gender) {
          const ageNum = parseInt(input.age, 10);
          if (!isNaN(ageNum)) {
            [match] = await db.select(projection).from(patients).where(and(
              sql`LOWER(${patients.name}) = ${input.name.toLowerCase()}`,
              eq(patients.age, ageNum),
              eq(patients.gender, input.gender),
            )).limit(1);
          }
        }

        if (!match) return null;

        const [lastVisit] = await db
          .select({ visitDate: visits.visitDate, complaint: visits.complaint, diagnosis: visits.diagnosis })
          .from(visits)
          .where(eq(visits.patientId, match.id))
          .orderBy(desc(visits.visitDate))
          .limit(1);
        const [count] = await db.select({ count: sql<number>`count(*)` }).from(visits).where(eq(visits.patientId, match.id));

        return {
          patient: match,
          lastVisit: lastVisit ?? null,
          totalVisits: Number(count?.count ?? 0),
        };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1),
        fatherName: z.string().optional(),
        age: z.string().optional(),
        gender: z.enum(["Male", "Female", "Other"]).optional(),
        phone: z.string().optional(),
        area: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Approval routing: when admin attempts a major-field update with
        // APPROVALS_ENFORCED=true, refuse direct execution and force the
        // client to submit through approvals.request.
        if (requiresApprovalRouting(ctx.user.role)) {
          const [current] = await db.select().from(patients).where(eq(patients.id, input.id)).limit(1);
          if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });
          if (isMajorUpdate("patient", current as unknown as Record<string, unknown>, input as unknown as Record<string, unknown>)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "This update changes a major field (name or phone) and requires super-admin approval. Submit via approvals.request.",
            });
          }
        }
        const ageNum = input.age ? parseInt(input.age, 10) : null;
        await db.update(patients).set({
          name: input.name,
          fatherName: input.fatherName?.trim() || null,
          age: ageNum != null && !isNaN(ageNum) ? ageNum : null,
          gender: input.gender ?? null,
          phone: input.phone?.trim() || null,
          area: input.area?.trim() || null,
        }).where(eq(patients.id, input.id));
        await logActivity({ userId: ctx.user.id, action: "update", entityType: "patient", entityId: input.id });
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (requiresApprovalRouting(ctx.user.role)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Deletion requires super-admin approval. Submit via approvals.request.",
          });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Cascade — no FK constraint, so delete dependents first
        await db.delete(visits).where(eq(visits.patientId, input.id));
        await db.delete(patients).where(eq(patients.id, input.id));
        await logActivity({ userId: ctx.user.id, action: "delete", entityType: "patient", entityId: input.id });
        return { success: true };
      }),
  }),

  // ── Visits ─────────────────────────────────────────────────────────────────
  visits: router({
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (requiresApprovalRouting(ctx.user.role)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Deletion requires super-admin approval. Submit via approvals.request.",
          });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(visits).where(eq(visits.id, input.id));
        await logActivity({ userId: ctx.user.id, action: "delete", entityType: "visit", entityId: input.id });
        return { success: true };
      }),
  }),

  // ── Inventory ──────────────────────────────────────────────────────────────
  inventory: router({
    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
      }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { rows: [] as Array<typeof inventory.$inferSelect & { pendingRequest: PendingRequestInfo | null }>, total: 0, lowStockCount: 0 };
        const excludeIds = await fetchAdminFilterPendingDeleteIds(ctx.user.role, "inventory");
        const conditions: SQL[] = [];
        if (input.search) {
          const searchClause = or(
            like(inventory.name, `%${input.search}%`),
            like(inventory.category, `%${input.search}%`),
            like(inventory.costCentre, `%${input.search}%`)
          );
          if (searchClause) conditions.push(searchClause);
        }
        if (excludeIds.length > 0) conditions.push(notInArray(inventory.id, excludeIds));
        const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
        const [rows, totalRow, lowStockRow] = await Promise.all([
          db.select().from(inventory).where(where).orderBy(asc(inventory.name))
            .limit(PAGE_SIZE).offset(pageOffset(input.page)),
          db.select({ count: sql<number>`count(*)` }).from(inventory).where(where),
          db.select({ count: sql<number>`count(*)` }).from(inventory)
            .where(sql`${inventory.quantity} <= COALESCE(${inventory.lowStockThreshold}, 2)`),
        ]);
        const pendingMap = await fetchPendingForEntities("inventory", rows.map((r) => r.id));
        const enriched = rows.map((r) => ({ ...r, pendingRequest: pendingMap.get(r.id) ?? null }));
        return {
          rows: enriched,
          total: Number(totalRow[0]?.count ?? 0),
          lowStockCount: Number(lowStockRow[0]?.count ?? 0),
        };
      }),

    export: protectedProcedure
      .input(z.object({ search: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        const excludeIds = await fetchAdminFilterPendingDeleteIds(ctx.user.role, "inventory");
        const conditions: SQL[] = [];
        if (input.search) {
          const searchClause = or(
            like(inventory.name, `%${input.search}%`),
            like(inventory.category, `%${input.search}%`),
            like(inventory.costCentre, `%${input.search}%`)
          );
          if (searchClause) conditions.push(searchClause);
        }
        if (excludeIds.length > 0) conditions.push(notInArray(inventory.id, excludeIds));
        const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
        return db.select().from(inventory).where(where).orderBy(asc(inventory.name));
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        category: z.string(),
        costCentre: z.string().nullable().optional(),
        quantity: z.number().min(0),
        unit: z.string(),
        lowStockThreshold: z.number().min(0).optional(),
        notes: z.string().nullable().optional(),
        price: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [r] = await db.insert(inventory).values({
          name: input.name,
          category: input.category,
          costCentre: input.costCentre ?? null,
          quantity: input.quantity,
          unit: input.unit,
          lowStockThreshold: input.lowStockThreshold ?? 2,
          notes: input.notes ?? null,
          price: input.price ?? null,
        }).$returningId();
        await logActivity({ userId: ctx.user.id, action: "create", entityType: "inventory", entityId: r?.id, details: input.name });
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1),
        category: z.string(),
        costCentre: z.string().nullable().optional(),
        quantity: z.number().min(0),
        unit: z.string(),
        lowStockThreshold: z.number().min(0).optional(),
        notes: z.string().nullable().optional(),
        price: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [current] = await db.select().from(inventory).where(eq(inventory.id, input.id)).limit(1);
        if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Inventory item not found" });
        if (requiresApprovalRouting(ctx.user.role)) {
          if (isMajorUpdate("inventory", current as unknown as Record<string, unknown>, input as unknown as Record<string, unknown>)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "This update changes price or quantity (>10% or >50 units) and requires super-admin approval. Submit via approvals.request.",
            });
          }
        }
        // Price preserved when not provided; null when explicitly cleared.
        const newPrice = input.price !== undefined ? (input.price ?? null) : current.price;
        await db.update(inventory).set({
          name: input.name,
          category: input.category,
          costCentre: input.costCentre ?? null,
          quantity: input.quantity,
          unit: input.unit,
          lowStockThreshold: input.lowStockThreshold ?? 2,
          notes: input.notes ?? null,
          price: newPrice,
        }).where(eq(inventory.id, input.id));
        // Price history when price actually changed (skip when clearing — newPrice column is NOT NULL)
        const oldNum = current.price == null ? null : Number(current.price);
        const newNum = newPrice == null ? null : Number(newPrice);
        if (oldNum !== newNum && newPrice != null) {
          await db.insert(priceHistory).values({
            entityType: "inventory",
            entityId: input.id,
            oldPrice: current.price,
            newPrice: newPrice,
            changedBy: ctx.user.id,
            reason: null,
          });
        }
        await logActivity({ userId: ctx.user.id, action: "update", entityType: "inventory", entityId: input.id, details: input.name });
        return { success: true };
      }),

    priceHistory: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [] as Array<{ id: number; oldPrice: string | null; newPrice: string; changedBy: number; changedByName: string | null; changedAt: Date; reason: string | null }>;
        return db
          .select({
            id: priceHistory.id,
            oldPrice: priceHistory.oldPrice,
            newPrice: priceHistory.newPrice,
            changedBy: priceHistory.changedBy,
            changedByName: users.fullName,
            changedAt: priceHistory.changedAt,
            reason: priceHistory.reason,
          })
          .from(priceHistory)
          .leftJoin(users, eq(users.id, priceHistory.changedBy))
          .where(and(eq(priceHistory.entityType, "inventory"), eq(priceHistory.entityId, input.id)))
          .orderBy(desc(priceHistory.changedAt))
          .limit(30);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (requiresApprovalRouting(ctx.user.role)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Deletion requires super-admin approval. Submit via approvals.request.",
          });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(inventory).where(eq(inventory.id, input.id));
        await logActivity({ userId: ctx.user.id, action: "delete", entityType: "inventory", entityId: input.id });
        return { success: true };
      }),
  }),

  // ── Medicines ──────────────────────────────────────────────────────────────
  medicines: router({
    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
      }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { rows: [] as Array<typeof medicines.$inferSelect & { pendingRequest: PendingRequestInfo | null }>, total: 0 };
        const excludeIds = await fetchAdminFilterPendingDeleteIds(ctx.user.role, "medicine");
        const conditions: SQL[] = [];
        if (input.search) {
          const searchClause = or(
            like(medicines.name, `%${input.search}%`),
            like(medicines.category, `%${input.search}%`)
          );
          if (searchClause) conditions.push(searchClause);
        }
        if (excludeIds.length > 0) conditions.push(notInArray(medicines.id, excludeIds));
        const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
        const [rows, totalRow] = await Promise.all([
          db.select().from(medicines).where(where).orderBy(asc(medicines.name))
            .limit(PAGE_SIZE).offset(pageOffset(input.page)),
          db.select({ count: sql<number>`count(*)` }).from(medicines).where(where),
        ]);
        const pendingMap = await fetchPendingForEntities("medicine", rows.map((r) => r.id));
        const enriched = rows.map((r) => ({ ...r, pendingRequest: pendingMap.get(r.id) ?? null }));
        return { rows: enriched, total: Number(totalRow[0]?.count ?? 0) };
      }),

    export: protectedProcedure
      .input(z.object({ search: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        const excludeIds = await fetchAdminFilterPendingDeleteIds(ctx.user.role, "medicine");
        const conditions: SQL[] = [];
        if (input.search) {
          const searchClause = or(
            like(medicines.name, `%${input.search}%`),
            like(medicines.category, `%${input.search}%`)
          );
          if (searchClause) conditions.push(searchClause);
        }
        if (excludeIds.length > 0) conditions.push(notInArray(medicines.id, excludeIds));
        const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
        return db.select().from(medicines).where(where).orderBy(asc(medicines.name));
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        category: z.string(),
        form: z.enum(["Tablet", "Syrup", "Capsule", "Injection", "Other"]),
        unit: z.string().optional(),
        defaultDosage: z.string().optional(),
        durationDays: z.number().optional(),
        notes: z.string().optional(),
        quantity: z.number().min(0).optional(),
        price: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [r] = await db.insert(medicines).values({
          name: input.name,
          category: input.category,
          form: input.form,
          unit: input.unit ?? null,
          defaultDosage: input.defaultDosage ?? null,
          durationDays: input.durationDays ?? null,
          notes: input.notes ?? null,
          quantity: input.quantity ?? 0,
          price: input.price ?? null,
        }).$returningId();
        await logActivity({ userId: ctx.user.id, action: "create", entityType: "medicine", entityId: r?.id, details: input.name });
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1),
        category: z.string(),
        form: z.enum(["Tablet", "Syrup", "Capsule", "Injection", "Other"]),
        unit: z.string().optional(),
        defaultDosage: z.string().optional(),
        durationDays: z.number().optional(),
        notes: z.string().optional(),
        quantity: z.number().min(0).optional(),
        price: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [current] = await db.select().from(medicines).where(eq(medicines.id, input.id)).limit(1);
        if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Medicine not found" });
        if (requiresApprovalRouting(ctx.user.role)) {
          if (isMajorUpdate("medicine", current as unknown as Record<string, unknown>, input as unknown as Record<string, unknown>)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "This update changes price or quantity (>10% or >50 units) and requires super-admin approval. Submit via approvals.request.",
            });
          }
        }
        // Preserve existing price/quantity if caller did not send them.
        const newPrice = input.price !== undefined ? (input.price ?? null) : current.price;
        const newQuantity = input.quantity !== undefined ? input.quantity : current.quantity;
        await db.update(medicines).set({
          name: input.name,
          category: input.category,
          form: input.form,
          unit: input.unit ?? null,
          defaultDosage: input.defaultDosage ?? null,
          durationDays: input.durationDays ?? null,
          notes: input.notes ?? null,
          quantity: newQuantity,
          price: newPrice,
        }).where(eq(medicines.id, input.id));
        const oldNum = current.price == null ? null : Number(current.price);
        const newNum = newPrice == null ? null : Number(newPrice);
        if (oldNum !== newNum && newPrice != null) {
          await db.insert(priceHistory).values({
            entityType: "medicine",
            entityId: input.id,
            oldPrice: current.price,
            newPrice: newPrice,
            changedBy: ctx.user.id,
            reason: null,
          });
        }
        await logActivity({ userId: ctx.user.id, action: "update", entityType: "medicine", entityId: input.id, details: input.name });
        return { success: true };
      }),

    priceHistory: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [] as Array<{ id: number; oldPrice: string | null; newPrice: string; changedBy: number; changedByName: string | null; changedAt: Date; reason: string | null }>;
        return db
          .select({
            id: priceHistory.id,
            oldPrice: priceHistory.oldPrice,
            newPrice: priceHistory.newPrice,
            changedBy: priceHistory.changedBy,
            changedByName: users.fullName,
            changedAt: priceHistory.changedAt,
            reason: priceHistory.reason,
          })
          .from(priceHistory)
          .leftJoin(users, eq(users.id, priceHistory.changedBy))
          .where(and(eq(priceHistory.entityType, "medicine"), eq(priceHistory.entityId, input.id)))
          .orderBy(desc(priceHistory.changedAt))
          .limit(30);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (requiresApprovalRouting(ctx.user.role)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Deletion requires super-admin approval. Submit via approvals.request.",
          });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(medicines).where(eq(medicines.id, input.id));
        await logActivity({ userId: ctx.user.id, action: "delete", entityType: "medicine", entityId: input.id });
        return { success: true };
      }),
  }),

  // ── Medical Camps ──────────────────────────────────────────────────────────
  camps: router({
    list: adminProcedure
      .input(z.object({ page: z.number().int().min(1).default(1) }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { rows: [] as Array<typeof medicalCamps.$inferSelect>, total: 0 };
        const excludeIds = await fetchAdminFilterPendingDeleteIds(ctx.user.role, "medical_camp");
        const where = excludeIds.length > 0 ? notInArray(medicalCamps.id, excludeIds) : undefined;
        const [rows, totalRow] = await Promise.all([
          db.select().from(medicalCamps).where(where).orderBy(desc(medicalCamps.campDate))
            .limit(PAGE_SIZE).offset(pageOffset(input.page)),
          db.select({ count: sql<number>`count(*)` }).from(medicalCamps).where(where),
        ]);
        return { rows, total: Number(totalRow[0]?.count ?? 0) };
      }),

    export: adminProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const excludeIds = await fetchAdminFilterPendingDeleteIds(ctx.user.role, "medical_camp");
      const where = excludeIds.length > 0 ? notInArray(medicalCamps.id, excludeIds) : undefined;
      return db.select().from(medicalCamps).where(where).orderBy(desc(medicalCamps.campDate));
    }),

    detail: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [camp] = await db.select().from(medicalCamps).where(eq(medicalCamps.id, input.id));
        if (!camp) throw new TRPCError({ code: "NOT_FOUND" });
        const doctors = await db.select().from(campDoctors).where(eq(campDoctors.campId, input.id));
        const tests = await db.select().from(campTests).where(eq(campTests.campId, input.id));
        // Enriched camp patient log — joins master patient for gender + master code,
        // plus a correlated subquery for total visit count (powers the
        // "Visit #N" beneficiary badge in the UI).
        const campPatientsRows = await db
          .select({
            id:                campPatients.id,
            campId:            campPatients.campId,
            serialNo:          campPatients.serialNo,
            patientId:         campPatients.patientId,
            visitId:           campPatients.visitId,
            patientName:       campPatients.patientName,
            age:               campPatients.age,
            phone:             campPatients.phone,
            fatherHusbandName: campPatients.fatherHusbandName,
            area:              campPatients.area,
            doctor:            campPatients.doctor,
            complaint:         campPatients.complaint,
            diagnosis:         campPatients.diagnosis,
            tests:             campPatients.tests,
            medicines:         campPatients.medicines,
            createdAt:         campPatients.createdAt,
            masterPatientCode: patients.patientId,
            masterGender:      patients.gender,
            totalVisits:       sql<number>`(SELECT COUNT(*) FROM ${visits} WHERE ${visits.patientId} = ${campPatients.patientId})`,
          })
          .from(campPatients)
          .leftJoin(patients, eq(patients.id, campPatients.patientId))
          .where(eq(campPatients.campId, input.id))
          .orderBy(asc(campPatients.serialNo));
        return { camp, doctors, tests, campPatients: campPatientsRows };
      }),

    create: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        campDate: z.string(),
        location: z.string().optional(),
        notes: z.string().optional(),
        totalVolunteers: z.number().optional(),
        totalExpense: z.string().optional(),
        status: z.enum(["upcoming", "completed", "cancelled"]).default("upcoming"),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [result] = await db.insert(medicalCamps).values({
          title: input.title,
          campDate: new Date(input.campDate),
          location: input.location ?? null,
          notes: input.notes ?? null,
          totalVolunteers: input.totalVolunteers ?? 0,
          totalExpense: input.totalExpense ?? "0",
          status: input.status,
        }).$returningId();
        await logActivity({ userId: ctx.user.id, action: "create", entityType: "camp", entityId: result!.id, details: input.title });
        return { id: result!.id };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1),
        campDate: z.string(),
        location: z.string().optional(),
        notes: z.string().optional(),
        totalVolunteers: z.number().optional(),
        totalExpense: z.string().optional(),
        status: z.enum(["upcoming", "completed", "cancelled"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(medicalCamps).set({
          title: input.title,
          campDate: new Date(input.campDate),
          location: input.location ?? null,
          notes: input.notes ?? null,
          totalVolunteers: input.totalVolunteers ?? 0,
          totalExpense: input.totalExpense ?? "0",
          status: input.status,
        }).where(eq(medicalCamps.id, input.id));
        await logActivity({ userId: ctx.user.id, action: "update", entityType: "camp", entityId: input.id });
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (requiresApprovalRouting(ctx.user.role)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Deletion requires super-admin approval. Submit via approvals.request.",
          });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Cascade — no FK constraints
        await db.delete(campDoctors).where(eq(campDoctors.campId, input.id));
        await db.delete(campTests).where(eq(campTests.campId, input.id));
        await db.delete(campPatients).where(eq(campPatients.campId, input.id));
        await db.delete(medicalCamps).where(eq(medicalCamps.id, input.id));
        await logActivity({ userId: ctx.user.id, action: "delete", entityType: "camp", entityId: input.id });
        return { success: true };
      }),

    addDoctor: adminProcedure
      .input(z.object({
        campId: z.number(),
        doctorName: z.string().min(1),
        specialty: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        qualification: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(campDoctors).values({
          campId: input.campId,
          doctorName: input.doctorName,
          specialty: input.specialty?.trim() || null,
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          qualification: input.qualification?.trim() || null,
        });
        await logActivity({ userId: ctx.user.id, action: "create", entityType: "camp_doctor", entityId: input.campId, details: input.doctorName });
        return { success: true };
      }),

    updateDoctor: adminProcedure
      .input(z.object({
        id: z.number(),
        doctorName: z.string().min(1),
        specialty: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        qualification: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(campDoctors).set({
          doctorName: input.doctorName,
          specialty: input.specialty?.trim() || null,
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          qualification: input.qualification?.trim() || null,
        }).where(eq(campDoctors.id, input.id));
        await logActivity({ userId: ctx.user.id, action: "update", entityType: "camp_doctor", entityId: input.id });
        return { success: true };
      }),

    removeDoctor: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(campDoctors).where(eq(campDoctors.id, input.id));
        await logActivity({ userId: ctx.user.id, action: "delete", entityType: "camp_doctor", entityId: input.id });
        return { success: true };
      }),

    addTest: adminProcedure
      .input(z.object({ campId: z.number(), testName: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(campTests).values({
          campId: input.campId,
          testName: input.testName,
        });
        await logActivity({ userId: ctx.user.id, action: "create", entityType: "camp_test", entityId: input.campId, details: input.testName });
        return { success: true };
      }),

    removeTest: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(campTests).where(eq(campTests.id, input.id));
        await logActivity({ userId: ctx.user.id, action: "delete", entityType: "camp_test", entityId: input.id });
        return { success: true };
      }),

    /**
     * Add a patient to the camp log with main-table linkage.
     *
     * Flow:
     *   1. Try to match an existing master patient (phone first; else
     *      name+age+gender). Skipped entirely if `forceNew` is true.
     *   2. If matched → use that patient.id. If no match → create a new
     *      row in `patients` (createdBy = ctx.user.id) and use its id.
     *   3. Insert a visit row tied to the master patient with
     *      visitDate = camp.campDate, campId = input.campId, doctor +
     *      complaint + diagnosis + medicineGiven (from `medicines`)
     *      copied across.
     *   4. Insert a `camp_patients` row with:
     *      - patientId / visitId pointing at the records from steps 2-3
     *      - the snapshot fields (patientName, age, phone, etc.) so the
     *        camp-day report stays stable even if the master record is
     *        later edited
     *      - the clinical free-text fields (doctor, complaint, etc.)
     *   5. Bump `medical_camps.totalPatients` and log activity.
     *
     * Backwards compatible: every new field is optional in the zod
     * schema, so the existing AddPatientDialog (which only sends the
     * original five fields) continues to work end-to-end while the
     * client UI catches up in commit C.
     */
    addPatient: adminProcedure
      .input(z.object({
        campId: z.number(),
        patientName: z.string().min(1),
        age: z.string().optional(),
        gender: z.enum(["Male", "Female", "Other"]).optional(),
        phone: z.string().optional(),
        fatherHusbandName: z.string().optional(),
        area: z.string().optional(),
        doctor: z.string().optional(),
        complaint: z.string().optional(),
        diagnosis: z.string().optional(),
        tests: z.string().optional(),
        medicines: z.string().optional(),
        forceNew: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Step 1 — find existing master patient unless forceNew
        const phone = input.phone?.trim();
        let matched: { id: number; patientId: string; name: string } | null = null;
        if (!input.forceNew) {
          if (phone) {
            const [m] = await db
              .select({ id: patients.id, patientId: patients.patientId, name: patients.name })
              .from(patients)
              .where(eq(patients.phone, phone))
              .limit(1);
            if (m) matched = m;
          } else if (input.age && input.gender) {
            const ageNum = parseInt(input.age, 10);
            if (!isNaN(ageNum)) {
              const [m] = await db
                .select({ id: patients.id, patientId: patients.patientId, name: patients.name })
                .from(patients)
                .where(and(
                  sql`LOWER(${patients.name}) = ${input.patientName.toLowerCase()}`,
                  eq(patients.age, ageNum),
                  eq(patients.gender, input.gender),
                ))
                .limit(1);
              if (m) matched = m;
            }
          }
        }

        // Step 2 — use existing or create new master patient
        let masterPatientId: number;
        let masterPatientCode: string;
        if (matched) {
          masterPatientId = matched.id;
          masterPatientCode = matched.patientId;
        } else {
          const newPatientCode = await generatePatientId();
          const ageNum = input.age ? parseInt(input.age, 10) : null;
          const [r] = await db.insert(patients).values({
            patientId: newPatientCode,
            name: input.patientName,
            fatherName: input.fatherHusbandName?.trim() || null,
            age: ageNum != null && !isNaN(ageNum) ? ageNum : null,
            gender: input.gender ?? "Male",
            phone: phone || null,
            area: input.area?.trim() || null,
            createdBy: ctx.user.id,
          }).$returningId();
          masterPatientId = r!.id;
          masterPatientCode = newPatientCode;
          await logActivity({ userId: ctx.user.id, action: "create", entityType: "patient", entityId: masterPatientId, details: newPatientCode });
        }

        // Step 3 — fetch camp date for the visit row, and the next visit number
        const [camp] = await db
          .select({ campDate: medicalCamps.campDate })
          .from(medicalCamps)
          .where(eq(medicalCamps.id, input.campId))
          .limit(1);
        if (!camp) throw new TRPCError({ code: "NOT_FOUND", message: "Camp not found" });

        const [lastVisit] = await db
          .select({ visitNumber: visits.visitNumber })
          .from(visits)
          .where(eq(visits.patientId, masterPatientId))
          .orderBy(desc(visits.visitNumber))
          .limit(1);
        const nextVisitNumber = (lastVisit?.visitNumber ?? 0) + 1;

        // Step 4 — create the visit row tagged with this camp
        const [vis] = await db.insert(visits).values({
          patientId: masterPatientId,
          visitNumber: nextVisitNumber,
          visitDate: camp.campDate,
          complaint: input.complaint?.trim() || null,
          diagnosis: input.diagnosis?.trim() || null,
          medicineGiven: input.medicines?.trim() || null,
          doctor: input.doctor?.trim() || null,
          campId: input.campId,
          createdBy: ctx.user.id,
        }).$returningId();
        const visitId = vis!.id;
        await logActivity({ userId: ctx.user.id, action: "create", entityType: "visit", entityId: masterPatientId });

        // Step 5 — append to the camp log with snapshot + clinical fields
        const existingSerial = await db
          .select({ serialNo: campPatients.serialNo })
          .from(campPatients)
          .where(eq(campPatients.campId, input.campId))
          .orderBy(desc(campPatients.serialNo))
          .limit(1);
        const nextSerial = (existingSerial[0]?.serialNo ?? 0) + 1;

        await db.insert(campPatients).values({
          campId: input.campId,
          serialNo: nextSerial,
          patientId: masterPatientId,
          visitId,
          patientName: input.patientName,
          age: input.age?.trim() || null,
          phone: phone || null,
          fatherHusbandName: input.fatherHusbandName?.trim() || null,
          area: input.area?.trim() || null,
          doctor: input.doctor?.trim() || null,
          complaint: input.complaint?.trim() || null,
          diagnosis: input.diagnosis?.trim() || null,
          tests: input.tests?.trim() || null,
          medicines: input.medicines?.trim() || null,
        });

        // Step 6 — bookkeeping
        await db.update(medicalCamps)
          .set({ totalPatients: nextSerial })
          .where(eq(medicalCamps.id, input.campId));
        await logActivity({
          userId: ctx.user.id,
          action: "create",
          entityType: "camp_patient",
          entityId: input.campId,
          details: `${input.patientName} (${matched ? "linked to existing" : "new patient"} ${masterPatientCode})`,
        });

        return {
          success: true as const,
          masterPatientId,
          masterPatientCode,
          visitId,
          serialNo: nextSerial,
          isNew: !matched,
          matched: matched ? { patientId: matched.patientId, name: matched.name } : null,
        };
      }),

    removePatient: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(campPatients).where(eq(campPatients.id, input.id));
        await logActivity({ userId: ctx.user.id, action: "delete", entityType: "camp_patient", entityId: input.id });
        return { success: true };
      }),
  }),

  // ── Invites (email allowlist) ─────────────────────────────────────────────
  invites: router({
    list: superAdminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: pendingInvites.id,
          email: pendingInvites.email,
          assignedRole: pendingInvites.assignedRole,
          invitedBy: pendingInvites.invitedBy,
          invitedAt: pendingInvites.invitedAt,
          invitedByName: users.name,
        })
        .from(pendingInvites)
        .leftJoin(users, eq(pendingInvites.invitedBy, users.id))
        .orderBy(desc(pendingInvites.invitedAt));
      return rows;
    }),

    create: superAdminProcedure
      .input(z.object({
        email: z.string().email().transform((v) => v.toLowerCase().trim()),
        role: z.enum(["admin", "receptionist"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [existingUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, input.email))
          .limit(1);
        if (existingUser) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A user with this email already exists. Change their role from the user list instead.",
          });
        }

        const [existingInvite] = await db
          .select({ id: pendingInvites.id })
          .from(pendingInvites)
          .where(eq(pendingInvites.email, input.email))
          .limit(1);
        if (existingInvite) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An invite for this email is already pending.",
          });
        }

        await db.insert(pendingInvites).values({
          email: input.email,
          assignedRole: input.role,
          invitedBy: ctx.user.id,
        });
        await logActivity({ userId: ctx.user.id, action: "create", entityType: "invite", details: `${input.email} (${input.role})` });
        return { success: true };
      }),

    revoke: superAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(pendingInvites).where(eq(pendingInvites.id, input.id));
        await logActivity({ userId: ctx.user.id, action: "delete", entityType: "invite", entityId: input.id });
        return { success: true };
      }),
  }),

  // ── Offline import ─────────────────────────────────────────────────────────
  imports: router({
    /**
     * Parse the uploaded file and tag each row with new / duplicate /
     * invalid. The client sends the file as base64 in JSON to avoid
     * multipart handling on the server.
     */
    preview: protectedProcedure
      .input(z.object({
        filename: z.string(),
        base64: z.string(),
      }))
      .mutation(async ({ input }) => {
        const lower = input.filename.toLowerCase();
        const buffer = Buffer.from(input.base64, "base64");
        let parsed: IntakeRow[];
        try {
          if (lower.endsWith(".xlsx")) {
            parsed = await parseIntakeXlsx(buffer);
          } else if (lower.endsWith(".csv")) {
            parsed = parseIntakeCsv(buffer);
          } else {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported file type. Use .xlsx or .csv" });
          }
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Could not read the file. Make sure it is a valid Excel or CSV.",
            cause: err,
          });
        }

        const empty = {
          rows: [] as Array<IntakeRow & { classification:
            | { tag: "new" }
            | { tag: "duplicate_phone"; existingPatientId: string; existingName: string }
            | { tag: "duplicate_name_age_gender"; existingPatientId: string; existingName: string }
            | { tag: "invalid"; reason: string }
          }>,
          stats: { total: 0, new: 0, dupPhone: 0, dupNameAgeGender: 0, invalid: 0 },
        };
        if (parsed.length === 0) return empty;

        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Phone dedupe — single batch query
        const phonesToCheck = Array.from(new Set(parsed.map((r) => r.phone).filter((p) => p && p.length > 0)));
        const phoneMap = new Map<string, { id: number; patientId: string; name: string }>();
        if (phonesToCheck.length > 0) {
          const matches = await db
            .select({ id: patients.id, patientId: patients.patientId, name: patients.name, phone: patients.phone })
            .from(patients)
            .where(inArray(patients.phone, phonesToCheck));
          for (const m of matches) {
            if (m.phone && !phoneMap.has(m.phone)) {
              phoneMap.set(m.phone, { id: m.id, patientId: m.patientId, name: m.name });
            }
          }
        }

        // Tag rows — name+age+gender soft check is per-row when phone is empty
        const rows: typeof empty.rows = [];
        for (const r of parsed) {
          if (!r.name) {
            rows.push({ ...r, classification: { tag: "invalid", reason: "Patient Name is missing" } });
            continue;
          }
          if (!r.date) {
            rows.push({ ...r, classification: { tag: "invalid", reason: "Date is missing or unparseable" } });
            continue;
          }
          if (r.phone) {
            const m = phoneMap.get(r.phone);
            if (m) {
              rows.push({ ...r, classification: { tag: "duplicate_phone", existingPatientId: m.patientId, existingName: m.name } });
              continue;
            }
          } else if (r.age && r.gender) {
            const ageNum = parseInt(r.age, 10);
            if (!isNaN(ageNum)) {
              const [m] = await db
                .select({ id: patients.id, patientId: patients.patientId, name: patients.name })
                .from(patients)
                .where(and(
                  sql`LOWER(${patients.name}) = ${r.name.toLowerCase()}`,
                  eq(patients.age, ageNum),
                  eq(patients.gender, r.gender as "Male" | "Female" | "Other"),
                ))
                .limit(1);
              if (m) {
                rows.push({ ...r, classification: { tag: "duplicate_name_age_gender", existingPatientId: m.patientId, existingName: m.name } });
                continue;
              }
            }
          }
          rows.push({ ...r, classification: { tag: "new" } });
        }

        const stats = {
          total: rows.length,
          new: rows.filter((r) => r.classification.tag === "new").length,
          dupPhone: rows.filter((r) => r.classification.tag === "duplicate_phone").length,
          dupNameAgeGender: rows.filter((r) => r.classification.tag === "duplicate_name_age_gender").length,
          invalid: rows.filter((r) => r.classification.tag === "invalid").length,
        };
        return { rows, stats };
      }),

    /**
     * Insert each ticked row as a new patient + first visit. createdBy is
     * set from ctx so the imported records are attributed to the importer
     * (visible on the Staff Activity page).
     */
    commit: protectedProcedure
      .input(z.object({
        rows: z.array(z.object({
          rowIndex: z.number(),
          date: z.string(),
          name: z.string(),
          fatherName: z.string().optional(),
          age: z.string().optional(),
          gender: z.enum(["", "Male", "Female", "Other"]).optional(),
          phone: z.string().optional(),
          area: z.string().optional(),
          complaint: z.string().optional(),
          diagnosis: z.string().optional(),
          medicineGiven: z.string().optional(),
          bottleSize: z.string().optional(),
          dosage: z.string().optional(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const errors: { rowIndex: number; message: string }[] = [];
        let imported = 0;
        for (const r of input.rows) {
          const name = r.name?.trim();
          if (!name || !r.date) {
            errors.push({ rowIndex: r.rowIndex, message: "Missing required fields (name or date)" });
            continue;
          }
          try {
            const patientId = await generatePatientId();
            const ageNum = r.age ? parseInt(r.age, 10) : null;
            const visitDate = new Date(r.date);
            const [result] = await db.insert(patients).values({
              patientId,
              name,
              fatherName: r.fatherName?.trim() || null,
              age: ageNum != null && !isNaN(ageNum) ? ageNum : null,
              gender: r.gender ? r.gender : "Male",
              phone: r.phone?.trim() || null,
              area: r.area?.trim() || null,
              createdBy: ctx.user.id,
            }).$returningId();
            const newId = result!.id;

            await db.insert(visits).values({
              patientId: newId,
              visitNumber: 1,
              visitDate: !isNaN(visitDate.getTime()) ? visitDate : new Date(),
              complaint: r.complaint?.trim() || null,
              diagnosis: r.diagnosis?.trim() || null,
              medicineGiven: r.medicineGiven?.trim() || null,
              bottleSize: r.bottleSize?.trim() || null,
              dosage: r.dosage?.trim() || null,
              createdBy: ctx.user.id,
            });

            await logActivity({
              userId: ctx.user.id,
              action: "create",
              entityType: "patient",
              entityId: newId,
              details: `imported ${patientId}`,
            });
            imported++;
          } catch (err) {
            const e = err as { code?: string; sqlMessage?: string; message?: string };
            errors.push({ rowIndex: r.rowIndex, message: e.sqlMessage ?? e.message ?? "Insert failed" });
          }
        }
        return { imported, errors };
      }),
  }),

  // ── Sessions / Staff Activity ──────────────────────────────────────────────
  sessions: router({
    /**
     * Per-session activity. Returns all metric counts on every row; the UI
     * picks which to show based on the user's role tab.
     */
    list: adminProcedure
      .input(z.object({
        userId: z.number().optional(),
        dateFrom: z.string().optional(), // ISO
        dateTo: z.string().optional(),   // ISO
        roleGroup: z.enum(["receptionist", "admin"]).optional(),
        page: z.number().int().min(1).default(1),
        all: z.boolean().optional(),     // when true (export only) returns all rows in window, no limit/offset
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { rows: [], total: 0 };
        const dateFrom = input.dateFrom ? new Date(input.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const dateTo = input.dateTo ? new Date(input.dateTo) : new Date(Date.now() + 60 * 1000);
        const userIdCondition = input.userId !== undefined
          ? sql`AND s.userId = ${input.userId}`
          : sql``;
        // roleGroup filters by tab — receptionist tab shows receptionist sessions only;
        // admin tab shows admin OR super_admin. Server-side filter so pagination is per-tab.
        const roleCondition = input.roleGroup === "receptionist"
          ? sql`AND u.role = 'receptionist'`
          : input.roleGroup === "admin"
          ? sql`AND u.role IN ('admin','super_admin')`
          : sql``;
        const limitOffsetClause = input.all
          ? sql``
          : sql`LIMIT ${PAGE_SIZE} OFFSET ${pageOffset(input.page)}`;
        const [result, totalResult] = await Promise.all([
          db.execute(sql`
            SELECT
              s.id, s.userId, s.loginAt, s.logoutAt, s.durationMinutes, s.autoClosed,
              u.fullName, u.name, u.email, u.role,
              (SELECT COUNT(*) FROM patients p
               WHERE p.createdBy = s.userId
                 AND p.createdAt >= s.loginAt
                 AND p.createdAt < COALESCE(s.logoutAt, NOW())) AS patientsAdded,
              (SELECT COUNT(*) FROM visits v
               WHERE v.createdBy = s.userId
                 AND v.createdAt >= s.loginAt
                 AND v.createdAt < COALESCE(s.logoutAt, NOW())) AS visitsAdded,
              (SELECT COUNT(*) FROM activity_logs a
               WHERE a.userId = s.userId AND a.entityType = 'inventory'
                 AND a.action IN ('create','update','delete')
                 AND a.createdAt >= s.loginAt
                 AND a.createdAt < COALESCE(s.logoutAt, NOW())) AS inventoryUpdates,
              (SELECT COUNT(*) FROM activity_logs a
               WHERE a.userId = s.userId AND a.entityType = 'medicine'
                 AND a.action IN ('create','update','delete')
                 AND a.createdAt >= s.loginAt
                 AND a.createdAt < COALESCE(s.logoutAt, NOW())) AS medicineUpdates,
              (SELECT COUNT(*) FROM activity_logs a
               WHERE a.userId = s.userId AND a.entityType = 'camp' AND a.action = 'create'
                 AND a.createdAt >= s.loginAt
                 AND a.createdAt < COALESCE(s.logoutAt, NOW())) AS campsCreated,
              (SELECT COUNT(*) FROM activity_logs a
               WHERE a.userId = s.userId AND a.entityType = 'patient' AND a.action = 'delete'
                 AND a.createdAt >= s.loginAt
                 AND a.createdAt < COALESCE(s.logoutAt, NOW())) AS patientsDeleted,
              (SELECT COUNT(*) FROM activity_logs a
               WHERE a.userId = s.userId
                 AND a.entityType NOT IN ('session')
                 AND a.createdAt >= s.loginAt
                 AND a.createdAt < COALESCE(s.logoutAt, NOW())) AS totalActions
            FROM user_sessions s
            JOIN users u ON u.id = s.userId
            WHERE s.loginAt >= ${dateFrom} AND s.loginAt < ${dateTo}
            ${userIdCondition}
            ${roleCondition}
            ORDER BY s.loginAt DESC
            ${limitOffsetClause}
          `),
          db.execute(sql`
            SELECT COUNT(*) AS c FROM user_sessions s
            JOIN users u ON u.id = s.userId
            WHERE s.loginAt >= ${dateFrom} AND s.loginAt < ${dateTo}
            ${userIdCondition}
            ${roleCondition}
          `),
        ]);
        // mysql2 returns [rows, fields]; drizzle's execute typing is loose
        const rawRows = (Array.isArray(result) ? result[0] : result) as unknown as Array<{
          id: number; userId: number; loginAt: Date; logoutAt: Date | null;
          durationMinutes: number | null; autoClosed: number | boolean;
          fullName: string | null; name: string | null; email: string | null; role: string;
          patientsAdded: string | number; visitsAdded: string | number;
          inventoryUpdates: string | number; medicineUpdates: string | number;
          campsCreated: string | number; patientsDeleted: string | number;
          totalActions: string | number;
        }>;
        const totalRows = (Array.isArray(totalResult) ? totalResult[0] : totalResult) as unknown as Array<{ c: string | number }>;
        const rows = rawRows.map((r) => ({
          id: r.id,
          userId: r.userId,
          loginAt: new Date(r.loginAt),
          logoutAt: r.logoutAt ? new Date(r.logoutAt) : null,
          durationMinutes: r.durationMinutes,
          autoClosed: !!r.autoClosed,
          userFullName: r.fullName,
          userGoogleName: r.name,
          userEmail: r.email,
          userRole: r.role,
          patientsAdded: Number(r.patientsAdded),
          visitsAdded: Number(r.visitsAdded),
          inventoryUpdates: Number(r.inventoryUpdates),
          medicineUpdates: Number(r.medicineUpdates),
          campsCreated: Number(r.campsCreated),
          patientsDeleted: Number(r.patientsDeleted),
          totalActions: Number(r.totalActions),
        }));
        return { rows, total: Number(totalRows[0]?.c ?? 0) };
      }),

    /**
     * Per-user totals across the period. Used for the "top performer" stat
     * and CSV export of the summary view.
     */
    summary: adminProcedure
      .input(z.object({
        dateFrom: z.string(),
        dateTo: z.string(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const dateFrom = new Date(input.dateFrom);
        const dateTo = new Date(input.dateTo);
        const result = await db.execute(sql`
          SELECT
            u.id AS userId, u.fullName, u.name, u.email, u.role,
            COUNT(s.id) AS sessionCount,
            COALESCE(SUM(s.durationMinutes), 0) AS totalMinutes,
            (SELECT COUNT(*) FROM patients p
             WHERE p.createdBy = u.id
               AND p.createdAt >= ${dateFrom} AND p.createdAt < ${dateTo}) AS patientsAdded,
            (SELECT COUNT(*) FROM visits v
             WHERE v.createdBy = u.id
               AND v.createdAt >= ${dateFrom} AND v.createdAt < ${dateTo}) AS visitsAdded,
            (SELECT COUNT(*) FROM activity_logs a
             WHERE a.userId = u.id AND a.entityType = 'inventory'
               AND a.action IN ('create','update','delete')
               AND a.createdAt >= ${dateFrom} AND a.createdAt < ${dateTo}) AS inventoryUpdates,
            (SELECT COUNT(*) FROM activity_logs a
             WHERE a.userId = u.id AND a.entityType = 'medicine'
               AND a.action IN ('create','update','delete')
               AND a.createdAt >= ${dateFrom} AND a.createdAt < ${dateTo}) AS medicineUpdates,
            (SELECT COUNT(*) FROM activity_logs a
             WHERE a.userId = u.id AND a.entityType = 'camp' AND a.action = 'create'
               AND a.createdAt >= ${dateFrom} AND a.createdAt < ${dateTo}) AS campsCreated,
            (SELECT COUNT(*) FROM activity_logs a
             WHERE a.userId = u.id AND a.entityType = 'patient' AND a.action = 'delete'
               AND a.createdAt >= ${dateFrom} AND a.createdAt < ${dateTo}) AS patientsDeleted
          FROM users u
          LEFT JOIN user_sessions s
            ON s.userId = u.id AND s.loginAt >= ${dateFrom} AND s.loginAt < ${dateTo}
          WHERE u.role IN ('admin','super_admin','receptionist')
          GROUP BY u.id, u.fullName, u.name, u.email, u.role
          ORDER BY patientsAdded DESC, sessionCount DESC
        `);
        const rows = (Array.isArray(result) ? result[0] : result) as unknown as Array<{
          userId: number; fullName: string | null; name: string | null;
          email: string | null; role: string;
          sessionCount: string | number; totalMinutes: string | number;
          patientsAdded: string | number; visitsAdded: string | number;
          inventoryUpdates: string | number; medicineUpdates: string | number;
          campsCreated: string | number; patientsDeleted: string | number;
        }>;
        return rows.map((r) => ({
          userId: r.userId,
          userFullName: r.fullName,
          userGoogleName: r.name,
          userEmail: r.email,
          userRole: r.role,
          sessionCount: Number(r.sessionCount),
          totalMinutes: Number(r.totalMinutes),
          patientsAdded: Number(r.patientsAdded),
          visitsAdded: Number(r.visitsAdded),
          inventoryUpdates: Number(r.inventoryUpdates),
          medicineUpdates: Number(r.medicineUpdates),
          campsCreated: Number(r.campsCreated),
          patientsDeleted: Number(r.patientsDeleted),
        }));
      }),

    /**
     * Count of currently-open sessions (logoutAt IS NULL) — for the
     * "Active now" stat on the Staff Activity page.
     */
    activeCount: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return 0;
      const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(userSessions)
        .where(sql`${userSessions.logoutAt} IS NULL`);
      return Number(row?.count ?? 0);
    }),
  }),

  // ── Approval workflow ──────────────────────────────────────────────────────
  approvals: router({
    /**
     * Admin (or super_admin) submits a request for a destructive or major
     * action. Validates the payload against the entity-specific schema,
     * blocks duplicate pending requests on the same row.
     */
    request: protectedProcedure
      .input(z.object({
        requestType: z.enum(["delete", "update"]),
        entityType: z.enum(["patient", "visit", "inventory", "medicine", "medical_camp"]),
        entityId: z.number().int().positive(),
        payload: z.unknown().optional(),
        reason: z.string().min(1, "Reason is required").max(1000),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Validate update payload at request time (Q1.6)
        let serializedPayload: string | null = null;
        if (input.requestType === "update") {
          if (!UPDATABLE_ENTITY_TYPES.includes(input.entityType)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Updates for ${input.entityType} are not approval-routed; submit directly.`,
            });
          }
          const validated = validateUpdatePayload(input.entityType, input.payload);
          serializedPayload = JSON.stringify(validated);
        }

        // Block duplicate pending requests on the same entity (Q1.2)
        await assertNoExistingPending(db, input.entityType, input.entityId);

        const [r] = await db.insert(pendingApprovals).values({
          requestedBy: ctx.user.id,
          requestType: input.requestType,
          entityType: input.entityType,
          entityId: input.entityId,
          payload: serializedPayload,
          reason: input.reason,
        }).$returningId();

        // Fan out a notification to every active super-admin (best-effort).
        const requesterName = ctx.user.fullName ?? ctx.user.name ?? ctx.user.email ?? "An admin";
        await notifyAllSuperAdmins(
          "new_pending_request",
          "New approval request",
          `${requesterName} requested to ${input.requestType} ${input.entityType} #${input.entityId}`,
          "/pending-approvals",
        );

        return { id: r!.id, status: "pending" as const };
      }),

    /**
     * Super admin decides on a pending request. On approve, runs the
     * underlying mutation in a transaction (deleting cascades, updating
     * with payload, writing price_history if a price changed). Activity
     * log attributed to the requester per Q1.5.
     */
    decide: superAdminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        decision: z.enum(["approved", "rejected"]),
        decisionNote: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const result = await db.transaction(async (tx) => {
          // Fetch + verify the request is still pending
          const [req] = await tx
            .select()
            .from(pendingApprovals)
            .where(and(eq(pendingApprovals.id, input.id), eq(pendingApprovals.status, "pending")))
            .limit(1);
          if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found or already decided" });

          if (input.decision === "rejected") {
            await tx.update(pendingApprovals).set({
              status: "rejected",
              decidedBy: ctx.user.id,
              decidedAt: new Date(),
              decisionNote: input.decisionNote ?? null,
            }).where(eq(pendingApprovals.id, req.id));
            return {
              status: "rejected" as const,
              requestedBy: req.requestedBy,
              requestType: req.requestType,
              entityType: req.entityType,
              entityId: req.entityId,
              decisionNote: input.decisionNote ?? null,
            };
          }

          // Approved — execute the underlying mutation, gracefully marking
          // 'superseded' if the row was already deleted/changed.
          let finalStatus: "approved" | "superseded" = "approved";
          if (req.requestType === "delete") {
            switch (req.entityType) {
              case "patient": {
                await tx.delete(visits).where(eq(visits.patientId, req.entityId));
                const r = await tx.delete(patients).where(eq(patients.id, req.entityId));
                if ((r as unknown as { affectedRows?: number }).affectedRows === 0) finalStatus = "superseded";
                break;
              }
              case "visit": {
                const r = await tx.delete(visits).where(eq(visits.id, req.entityId));
                if ((r as unknown as { affectedRows?: number }).affectedRows === 0) finalStatus = "superseded";
                break;
              }
              case "inventory": {
                const r = await tx.delete(inventory).where(eq(inventory.id, req.entityId));
                if ((r as unknown as { affectedRows?: number }).affectedRows === 0) finalStatus = "superseded";
                break;
              }
              case "medicine": {
                const r = await tx.delete(medicines).where(eq(medicines.id, req.entityId));
                if ((r as unknown as { affectedRows?: number }).affectedRows === 0) finalStatus = "superseded";
                break;
              }
              case "medical_camp": {
                await tx.delete(campDoctors).where(eq(campDoctors.campId, req.entityId));
                await tx.delete(campTests).where(eq(campTests.campId, req.entityId));
                await tx.delete(campPatients).where(eq(campPatients.campId, req.entityId));
                const r = await tx.delete(medicalCamps).where(eq(medicalCamps.id, req.entityId));
                if ((r as unknown as { affectedRows?: number }).affectedRows === 0) finalStatus = "superseded";
                break;
              }
            }
          } else {
            // update path
            const payload = req.payload ? JSON.parse(req.payload) : {};
            switch (req.entityType) {
              case "patient": {
                const ageNum = payload.age ? parseInt(payload.age, 10) : null;
                const r = await tx.update(patients).set({
                  name: payload.name,
                  fatherName: payload.fatherName?.trim() || null,
                  age: ageNum != null && !isNaN(ageNum) ? ageNum : null,
                  gender: payload.gender ?? null,
                  phone: payload.phone?.trim() || null,
                  area: payload.area?.trim() || null,
                }).where(eq(patients.id, req.entityId));
                if ((r as unknown as { affectedRows?: number }).affectedRows === 0) finalStatus = "superseded";
                break;
              }
              case "inventory": {
                const [cur] = await tx.select().from(inventory).where(eq(inventory.id, req.entityId)).limit(1);
                if (!cur) { finalStatus = "superseded"; break; }
                await tx.update(inventory).set({
                  name: payload.name,
                  category: payload.category,
                  costCentre: payload.costCentre ?? null,
                  quantity: payload.quantity,
                  unit: payload.unit,
                  lowStockThreshold: payload.lowStockThreshold ?? 2,
                  notes: payload.notes ?? null,
                  price: payload.price ?? null,
                }).where(eq(inventory.id, req.entityId));
                // Price history when price changed
                const oldP = cur.price == null ? null : Number(cur.price);
                const newP = payload.price == null ? null : Number(payload.price);
                if (oldP !== newP) {
                  await tx.insert(priceHistory).values({
                    entityType: "inventory",
                    entityId: req.entityId,
                    oldPrice: cur.price,
                    newPrice: payload.price,
                    changedBy: req.requestedBy,
                    reason: req.reason,
                  });
                }
                break;
              }
              case "medicine": {
                const [cur] = await tx.select().from(medicines).where(eq(medicines.id, req.entityId)).limit(1);
                if (!cur) { finalStatus = "superseded"; break; }
                await tx.update(medicines).set({
                  name: payload.name,
                  category: payload.category,
                  form: payload.form,
                  unit: payload.unit ?? null,
                  defaultDosage: payload.defaultDosage ?? null,
                  durationDays: payload.durationDays ?? null,
                  notes: payload.notes ?? null,
                  quantity: payload.quantity,
                  price: payload.price ?? null,
                }).where(eq(medicines.id, req.entityId));
                const oldP = cur.price == null ? null : Number(cur.price);
                const newP = payload.price == null ? null : Number(payload.price);
                if (oldP !== newP) {
                  await tx.insert(priceHistory).values({
                    entityType: "medicine",
                    entityId: req.entityId,
                    oldPrice: cur.price,
                    newPrice: payload.price,
                    changedBy: req.requestedBy,
                    reason: req.reason,
                  });
                }
                break;
              }
            }
          }

          // Mark the request decided
          await tx.update(pendingApprovals).set({
            status: finalStatus,
            decidedBy: ctx.user.id,
            decidedAt: new Date(),
            decisionNote: input.decisionNote ?? null,
          }).where(eq(pendingApprovals.id, req.id));

          // Activity log attributed to requester (Q1.5), only when actually executed
          if (finalStatus === "approved") {
            await tx.insert(activityLogs).values({
              userId: req.requestedBy,
              action: req.requestType,
              entityType: req.entityType,
              entityId: req.entityId,
              details: `approved by user ${ctx.user.id}`,
            });
          }

          return {
            status: finalStatus,
            requestedBy: req.requestedBy,
            requestType: req.requestType,
            entityType: req.entityType,
            entityId: req.entityId,
            decisionNote: null as string | null,
          };
        });

        // Notify the requester of the outcome (best-effort, post-tx).
        const verb = result.status === "approved"
          ? "approved"
          : result.status === "superseded"
          ? "approved (record was already changed — marked superseded)"
          : "rejected";
        const noteSuffix = result.decisionNote ? ` Note: ${result.decisionNote}` : "";
        await notifyUser(
          result.requestedBy,
          "request_decided",
          `Your ${result.requestType} request was ${result.status}`,
          `${result.entityType} #${result.entityId} — ${verb}.${noteSuffix}`,
          "/my-requests",
        );

        return { status: result.status };
      }),

    /**
     * Admin cancels their own pending request. Status='pending' →
     * 'cancelled'. No-op if not pending or not theirs.
     */
    cancel: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [req] = await db.select({ requestedBy: pendingApprovals.requestedBy, status: pendingApprovals.status })
          .from(pendingApprovals).where(eq(pendingApprovals.id, input.id)).limit(1);
        if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
        if (req.requestedBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only cancel your own requests." });
        }
        if (req.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This request is no longer pending." });
        }
        await db.update(pendingApprovals).set({
          status: "cancelled",
          decidedAt: new Date(),
        }).where(eq(pendingApprovals.id, input.id));
        return { success: true as const };
      }),

    /**
     * List the caller's own requests (for the My Requests page in commit E).
     */
    listMyRequests: protectedProcedure
      .input(z.object({
        status: z.enum(["pending", "approved", "rejected", "cancelled", "superseded"]).optional(),
      }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions: SQL[] = [eq(pendingApprovals.requestedBy, ctx.user.id)];
        if (input.status) conditions.push(eq(pendingApprovals.status, input.status));
        return db
          .select()
          .from(pendingApprovals)
          .where(and(...conditions))
          .orderBy(desc(pendingApprovals.createdAt))
          .limit(200);
      }),

    /**
     * List pending requests for the Pending Approvals page (super_admin only).
     */
    listPending: superAdminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select({
          id: pendingApprovals.id,
          requestedBy: pendingApprovals.requestedBy,
          requesterFullName: users.fullName,
          requesterGoogleName: users.name,
          requesterEmail: users.email,
          requesterIsActive: users.isActive,
          requestType: pendingApprovals.requestType,
          entityType: pendingApprovals.entityType,
          entityId: pendingApprovals.entityId,
          payload: pendingApprovals.payload,
          reason: pendingApprovals.reason,
          createdAt: pendingApprovals.createdAt,
        })
        .from(pendingApprovals)
        .leftJoin(users, eq(users.id, pendingApprovals.requestedBy))
        .where(eq(pendingApprovals.status, "pending"))
        .orderBy(desc(pendingApprovals.createdAt))
        .limit(200);
    }),
  }),

  // ── Notifications ──────────────────────────────────────────────────────────
  notifications: router({
    /** Caller's notifications, newest first. */
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, ctx.user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(100);
    }),

    /** Number of unread notifications for the caller — used by the bell badge. */
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return 0;
      const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(and(eq(notifications.userId, ctx.user.id), sql`${notifications.readAt} IS NULL`));
      return Number(row?.count ?? 0);
    }),

    /** Mark a single notification as read (only the caller's own). */
    markRead: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .update(notifications)
          .set({ readAt: new Date() })
          .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
        return { success: true as const };
      }),

    /** Mark every unread notification for the caller as read. */
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.userId, ctx.user.id), sql`${notifications.readAt} IS NULL`));
      return { success: true as const };
    }),
  }),

  // ── Users ──────────────────────────────────────────────────────────────────
  users: router({
    list: superAdminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(users).orderBy(desc(users.lastSignedIn));
    }),

    updateRole: superAdminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["user", "admin", "receptionist", "super_admin"]),
      }))
      .mutation(async ({ input, ctx }) => {
        // Demo mode: role mutations are off, full stop. The role-switcher
        // buttons are the only way to assume a role on the demo deployment.
        if (ENV.demoMode) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Role changes are disabled in demo mode.",
          });
        }
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change your own role" });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Owner protection — the OWNER_OPEN_ID account is auto-restored to
        // super_admin on every login by db.upsertUser, so allowing the UI to
        // change it would be a lie. Block at the API.
        const [target] = await db
          .select({ openId: users.openId })
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        if (ENV.ownerOpenId && target.openId === ENV.ownerOpenId && input.role !== "super_admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot change the foundation owner's role.",
          });
        }
        await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
        await logActivity({ userId: ctx.user.id, action: "role_change", entityType: "user", entityId: input.userId, details: input.role });
        return { success: true };
      }),

    setActive: superAdminProcedure
      .input(z.object({
        userId: z.number(),
        isActive: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change your own active status" });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Owner protection — see updateRole. Direct DB intervention is the
        // only intended path to deactivate the foundation owner.
        const [target] = await db
          .select({ openId: users.openId })
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        if (ENV.ownerOpenId && target.openId === ENV.ownerOpenId && !input.isActive) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot deactivate the foundation owner account.",
          });
        }
        // Demo mode: the three seed accounts (super-admin, admin,
        // receptionist) cannot be deactivated. Other users created during
        // a demo session can be — they're cleared by the daily reset anyway.
        if (ENV.demoMode && isDemoSeedUser(target.openId)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Demo seed accounts cannot be deactivated.",
          });
        }
        await db.update(users).set({ isActive: input.isActive }).where(eq(users.id, input.userId));
        // Close any open user_sessions row when deactivating so the user is
        // immediately marked logged-out in the staff activity report.
        if (!input.isActive) {
          try {
            await closeUserSession(input.userId);
          } catch (err) {
            console.error("[users.setActive] failed to close open session", err);
          }
        }
        await logActivity({
          userId: ctx.user.id,
          action: input.isActive ? "reactivate" : "deactivate",
          entityType: "user",
          entityId: input.userId,
        });
        // Notify the affected user. Deactivation notice is largely cosmetic
        // (they can't sign in to read it), but creates an audit-visible record
        // for the case of later reactivation.
        await notifyUser(
          input.userId,
          "account_status_changed",
          input.isActive ? "Your account access has been restored" : "Your account has been deactivated",
          input.isActive
            ? "A super-admin reactivated your access. Sign in to continue."
            : "A super-admin deactivated your account. Contact a super-admin if you believe this is in error.",
          "/",
        );
        return { success: true as const };
      }),

    updateProfile: superAdminProcedure
      .input(z.object({
        userId: z.number(),
        fullName: z.string().optional(),
        nicNumber: z.string().optional(),
        phoneNumber: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        try {
          await db.update(users).set({
            fullName: input.fullName?.trim() || null,
            nicNumber: input.nicNumber?.trim() || null,
            phoneNumber: input.phoneNumber?.trim() || null,
          }).where(eq(users.id, input.userId));
        } catch (err) {
          const e = err as { code?: string; errno?: number; sqlMessage?: string };
          if (e?.code === "ER_DUP_ENTRY" || e?.errno === 1062) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "NIC already registered to another user",
              cause: err,
            });
          }
          throw err;
        }
        await logActivity({ userId: ctx.user.id, action: "profile_update", entityType: "user", entityId: input.userId });
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
