/**
 * Seed script — populates the database with the medicine reference list,
 * a synthetic patient/visit set, synthetic inventory, and one medical
 * camp with synthetic camp-patient records.
 *
 * Patient, inventory, and camp data are produced by the deterministic
 * generators under scripts/seed/, seeded with a fixed value so the same
 * dataset reappears on every run. The data is locale-flavored
 * (Pakistani names + Karachi areas) but contains no real records.
 *
 * Two entry points:
 *   pnpm seed                  → runs the standalone seed (this file's bottom).
 *   seedDatabase(handle)       → reusable function, called from the demo
 *                                reset cron with a transaction handle so
 *                                deletes + reseed run atomically.
 */
import { drizzle } from "drizzle-orm/mysql2";
import {
  patients,
  visits,
  medicines,
  inventory,
  medicalCamps,
  campDoctors,
  campTests,
  campPatients,
} from "../drizzle/schema";
import { generatePatientVisitRows } from "../scripts/seed/patients";
import { generateInventoryItems } from "../scripts/seed/inventory";
import { generateCampPatients } from "../scripts/seed/camp";

export type SeedCounts = {
  medicinesInserted: number;
  inventoryInserted: number;
  patientsInserted: number;
  visitsInserted: number;
  campsInserted: number;
  campPatientsInserted: number;
};

// ─── 1. Patient Visits (synthetic) ───────────────────────────────────────────

const patientVisitRows = generatePatientVisitRows();

// ─── 2. Medicine Reference List ──────────────────────────────────────────────
// Clinical reference, no PHI. Kept verbatim from the original build.

const medicineData = [
  { name: "Syp. Paracetamol", category: "Pain Relief", form: "Syrup" as const, unit: "Bottle (60ml)", defaultDosage: "5ml 3x daily", durationDays: 4, notes: "Pediatric use" },
  { name: "Syp. Paracetamol", category: "Pain Relief", form: "Syrup" as const, unit: "Bottle (100ml)", defaultDosage: "5ml 3x daily", durationDays: 7, notes: "Standard bottle" },
  { name: "Syp. Cough", category: "Cough", form: "Syrup" as const, unit: "Bottle (100ml)", defaultDosage: "10ml 3x daily", durationDays: 4, notes: "General cough syrup" },
  { name: "Syp. Antacid/Dijex", category: "Antacid", form: "Syrup" as const, unit: "Bottle (100ml)", defaultDosage: "15ml 3x daily", durationDays: 3, notes: "" },
  { name: "Syp. B/C", category: "Vitamin", form: "Syrup" as const, unit: "Bottle (100ml)", defaultDosage: "15ml 2x daily", durationDays: 4, notes: "Vitamin B Complex" },
  { name: "Syp. Flagyl", category: "Antibiotic", form: "Syrup" as const, unit: "Bottle (100ml)", defaultDosage: "5ml 3x daily", durationDays: 7, notes: "Metronidazole" },
  { name: "Syp. Septran", category: "Antibiotic", form: "Syrup" as const, unit: "Bottle (100ml)", defaultDosage: "5ml 2x daily", durationDays: 10, notes: "" },
  { name: "Syp. Brufen", category: "Pain Relief", form: "Syrup" as const, unit: "Bottle (100ml)", defaultDosage: "5ml 3x daily", durationDays: 7, notes: "Ibuprofen" },
  { name: "Syp. Promethazine", category: "Antihistamine", form: "Syrup" as const, unit: "Bottle (100ml)", defaultDosage: "5ml 2-3x daily", durationDays: 7, notes: "Phenergan syrup" },
  { name: "Syp. CPM", category: "Antihistamine", form: "Syrup" as const, unit: "Bottle (100ml)", defaultDosage: "5ml 2-3x daily", durationDays: 7, notes: "" },
  { name: "Tab. Paracetamol", category: "Pain Relief", form: "Tablet" as const, unit: "Strip (10)", defaultDosage: "1-2 tab 3x daily", durationDays: 3, notes: "Generic paracetamol" },
  { name: "Tab. Flagyl 400mg", category: "Antibiotic", form: "Tablet" as const, unit: "Strip (10)", defaultDosage: "1 tab 3x daily", durationDays: 5, notes: "Metronidazole" },
  { name: "Tab. Gelusil", category: "Antacid", form: "Tablet" as const, unit: "Strip (10)", defaultDosage: "1 tab 3x daily", durationDays: 3, notes: "Also called Frisil" },
  { name: "Tab. Dyelo 50mg", category: "Pain Relief", form: "Tablet" as const, unit: "Strip (10)", defaultDosage: "1 tab 2x daily", durationDays: 5, notes: "" },
  { name: "Tab. B/C", category: "Vitamin", form: "Tablet" as const, unit: "Strip (10)", defaultDosage: "1 tab 2x daily", durationDays: 5, notes: "Vitamin B Complex" },
  { name: "Tab. Calciu-D", category: "Supplement", form: "Tablet" as const, unit: "Strip (10)", defaultDosage: "1 tab 1x daily", durationDays: 10, notes: "Calcium + Vitamin D" },
  { name: "Tab. Montelukast 10mg", category: "Respiratory", form: "Tablet" as const, unit: "Strip (10)", defaultDosage: "1 tab 1x daily", durationDays: 10, notes: "For asthma/allergies" },
  { name: "Tab. Septran", category: "Antibiotic", form: "Tablet" as const, unit: "Strip (10)", defaultDosage: "1 tab 2x daily", durationDays: 5, notes: "Cotrimoxazole" },
  { name: "Tab. Hyoscine", category: "Antispasmodic", form: "Tablet" as const, unit: "Strip (10)", defaultDosage: "1 tab 3x daily", durationDays: 3, notes: "Buscopan" },
  { name: "Tab. Dexa", category: "Steroid", form: "Tablet" as const, unit: "Strip (10)", defaultDosage: "1 tab 1-2x daily", durationDays: 5, notes: "Dexamethasone" },
  { name: "Tab. Belnosol", category: "Steroid", form: "Tablet" as const, unit: "Strip (10)", defaultDosage: "1 tab 2x daily", durationDays: 5, notes: "" },
  { name: "Tab. CPM", category: "Antihistamine", form: "Tablet" as const, unit: "Strip (10)", defaultDosage: "1 tab 2-3x daily", durationDays: 5, notes: "Chlorpheniramine" },
  { name: "Tab. Promethazine 10mg", category: "Antihistamine", form: "Tablet" as const, unit: "Strip (10)", defaultDosage: "1 tab 2-3x daily", durationDays: 5, notes: "Also known as Phenergan" },
  { name: "Cap. Risek 20mg", category: "PPI/Antacid", form: "Capsule" as const, unit: "Strip (14)", defaultDosage: "1 cap 1x daily", durationDays: 14, notes: "Omeprazole" },
  { name: "Cap. Doxycycline 100mg", category: "Antibiotic", form: "Capsule" as const, unit: "Strip (10)", defaultDosage: "1 cap 2x daily", durationDays: 7, notes: "Vibramycin/Doxxy" },
  { name: "Inj. PM2", category: "Antihistamine", form: "Injection" as const, unit: "Ampoule", defaultDosage: "Single dose", durationDays: 1, notes: "Promethazine injection" },
  { name: "Inj. Metso", category: "Digestive", form: "Injection" as const, unit: "Ampoule", defaultDosage: "Single dose", durationDays: 1, notes: "" },
  { name: "Inj. Volansos", category: "Pain Relief", form: "Injection" as const, unit: "Ampoule", defaultDosage: "Single dose", durationDays: 1, notes: "" },
  { name: "Inj. Normal Saline", category: "Nebulization", form: "Injection" as const, unit: "Ampoule (25ml)", defaultDosage: "Single dose", durationDays: 1, notes: "For nebulizer" },
];

// ─── 3. Inventory (synthetic) ────────────────────────────────────────────────

const inventoryData = generateInventoryItems();

// ─── 4. Medical Camp — "Sector G-9 Community Camp" (synthetic patients) ──────

const campPatientData = generateCampPatients();

// ─── Main Seed Function ──────────────────────────────────────────────────────

/**
 * Inserts the full reference + synthetic dataset using the given handle.
 *
 * The handle parameter is typed `any` because drizzle's MySql2Database and
 * MySqlTransaction are structurally compatible for our usage (insert/
 * select/returningId) but the official types are nominally different.
 * Using `any` here is the pragmatic choice that lets callers pass either
 * the module-level db OR a `db.transaction(async (tx) => ...)` handle.
 *
 * Returns counts so callers (the demo reset cron) can log them.
 *
 * Per-table "is this empty?" guards stay in place — running this against
 * an already-seeded database is a no-op (the daily reset wipes first, so
 * the guards always pass through to inserts in that path).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedDatabase(handle: any): Promise<SeedCounts> {
  const counts: SeedCounts = {
    medicinesInserted: 0,
    inventoryInserted: 0,
    patientsInserted: 0,
    visitsInserted: 0,
    campsInserted: 0,
    campPatientsInserted: 0,
  };

  // ── Medicines ──
  console.log("  → Seeding medicines...");
  const existingMeds = await handle.select({ id: medicines.id }).from(medicines).limit(1);
  if (existingMeds.length === 0) {
    await handle.insert(medicines).values(medicineData);
    counts.medicinesInserted = medicineData.length;
    console.log(`     ✓ ${medicineData.length} medicines inserted`);
  } else {
    console.log("     ⏭  Medicines already seeded, skipping");
  }

  // ── Inventory ──
  console.log("  → Seeding inventory...");
  const existingInv = await handle.select({ id: inventory.id }).from(inventory).limit(1);
  if (existingInv.length === 0) {
    await handle.insert(inventory).values(
      inventoryData.map((i) => ({ ...i, lowStockThreshold: 2 })),
    );
    counts.inventoryInserted = inventoryData.length;
    console.log(`     ✓ ${inventoryData.length} inventory items inserted`);
  } else {
    console.log("     ⏭  Inventory already seeded, skipping");
  }

  // ── Patients & Visits ──
  console.log("  → Seeding patients and visits...");
  const existingPats = await handle.select({ id: patients.id }).from(patients).limit(1);
  if (existingPats.length === 0) {
    // Build unique-patient map (one row per patientId; later rows merge missing fields)
    const patientMap = new Map<string, (typeof patientVisitRows)[number]>();
    for (const row of patientVisitRows) {
      const pid = row.patientId.trim();
      if (!patientMap.has(pid)) {
        patientMap.set(pid, row);
      } else {
        const existing = patientMap.get(pid)!;
        const updated = { ...existing };
        if (!existing.fatherName && row.fatherName) updated.fatherName = row.fatherName;
        if (!existing.phone && row.phone) updated.phone = row.phone;
        if (!existing.area && row.area) updated.area = row.area;
        patientMap.set(pid, updated);
      }
    }

    const patientIdToDbId = new Map<string, number>();
    let patientOk = 0;
    const patientFailures: Array<{ position: number; patientId: string; name: string; message: string }> = [];
    let position = 0;
    for (const [patientId, row] of Array.from(patientMap.entries())) {
      position++;
      try {
        const [inserted] = await handle.insert(patients).values({
          patientId,
          name: row.name,
          fatherName: row.fatherName || null,
          age: Number.isNaN(row.age) ? 0 : row.age,
          gender: row.gender,
          phone: row.phone || null,
          area: row.area || null,
        }).$returningId();
        patientIdToDbId.set(patientId, inserted.id);
        patientOk++;
      } catch (err) {
        const e = err as { message?: string };
        patientFailures.push({ position, patientId, name: row.name, message: e.message ?? "unknown error" });
        console.error(`     ✗ patient #${position} ${patientId} "${row.name}" failed:`, e);
      }
    }
    counts.patientsInserted = patientOk;
    console.log(
      `     ✓ ${patientOk}/${patientMap.size} patients inserted` +
        (patientFailures.length ? ` (${patientFailures.length} failed — see log above)` : ""),
    );

    let visitOk = 0;
    let visitOrphan = 0;
    const visitFailures: Array<{ rowIndex: number; patientId: string; visitNumber: number; message: string }> = [];
    for (let i = 0; i < patientVisitRows.length; i++) {
      const row = patientVisitRows[i];
      const dbId = patientIdToDbId.get(row.patientId.trim());
      if (!dbId) {
        visitOrphan++;
        continue;
      }
      const visitDate = row.date ? new Date(row.date) : new Date();
      const medicineEndDate = row.medicineEndDate ? new Date(row.medicineEndDate) : undefined;
      const bottleSizeRaw = parseInt(row.bottleSize);
      try {
        await handle.insert(visits).values({
          patientId: dbId,
          visitNumber: row.visitNumber,
          visitDate,
          complaint: row.complaint || null,
          diagnosis: row.diagnosis || null,
          medicineGiven: row.medicineGiven || null,
          bottleSize: Number.isNaN(bottleSizeRaw) ? null : String(bottleSizeRaw),
          dosage: row.dosage || null,
          medicineEndDate,
          eligibility: row.eligibility || null,
        });
        visitOk++;
      } catch (err) {
        const e = err as { message?: string };
        visitFailures.push({ rowIndex: i, patientId: row.patientId, visitNumber: row.visitNumber, message: e.message ?? "unknown error" });
        console.error(`     ✗ visit (row ${i}, ${row.patientId} #${row.visitNumber}) failed:`, e);
      }
    }
    counts.visitsInserted = visitOk;
    console.log(
      `     ✓ ${visitOk}/${patientVisitRows.length} visits inserted` +
        (visitFailures.length ? ` (${visitFailures.length} failed)` : "") +
        (visitOrphan ? ` (${visitOrphan} skipped — parent patient missing)` : ""),
    );
  } else {
    console.log("     ⏭  Patients already seeded, skipping");
  }

  // ── Medical Camp ──
  console.log("  → Seeding medical camp...");
  const existingCamps = await handle.select({ id: medicalCamps.id }).from(medicalCamps).limit(1);
  if (existingCamps.length === 0) {
    const [camp] = await handle
      .insert(medicalCamps)
      .values({
        title: "Sector G-9 Community Camp",
        campDate: new Date("2026-04-26"),
        location: "Sector G-9, Karachi",
        notes: "General OPD camp serving the Sector G-9 neighborhood.",
        totalPatients: campPatientData.length,
        totalVolunteers: 0,
        totalExpense: "0",
        status: "completed",
      })
      .$returningId();

    const campId = camp.id;
    counts.campsInserted = 1;

    await handle.insert(campDoctors).values([
      { campId, doctorName: "Dr. General Physician", specialty: "General Medicine" },
    ]);

    await handle.insert(campTests).values([
      { campId, testName: "General OPD Consultation" },
      { campId, testName: "Blood Pressure Check" },
      { campId, testName: "Blood Sugar Test" },
    ]);

    if (campPatientData.length > 0) {
      await handle.insert(campPatients).values(campPatientData.map((p) => ({ campId, ...p })));
      counts.campPatientsInserted = campPatientData.length;
    }

    console.log(`     ✓ Medical camp created with ${campPatientData.length} patients`);
  } else {
    console.log("     ⏭  Medical camps already seeded, skipping");
  }

  return counts;
}

// ─── Standalone runner ───────────────────────────────────────────────────────
// Only runs when seed.ts is executed directly (pnpm seed), NOT when this
// module is imported by demoReset.ts.

const isDirectRun =
  process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("/server/seed.ts");

if (isDirectRun) {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set");
    process.exit(1);
  }
  const db = drizzle(DATABASE_URL);
  console.log("🌱 Starting seed...");
  seedDatabase(db)
    .then(() => {
      console.log("✅ Seed complete!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}
