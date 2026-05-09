/**
 * Seed script — populates the database with the medicine reference list,
 * inventory items, and patient/visit records.
 *
 * The patient, visit, inventory, and camp-patient arrays in this file are
 * intentionally empty. The synthetic-data generator (next commit) will
 * populate them with locale-aware fake data via @faker-js/faker.
 *
 * Run: pnpm seed
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

const DATABASE_URL = process.env.DATABASE_URL!;
const db = drizzle(DATABASE_URL);

// ─── 1. Patient Visits (synthetic generator fills this in next commit) ───────

const patientVisitRows: Array<{
  date: string;
  name: string;
  fatherName: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  phone: string;
  area: string;
  complaint: string;
  diagnosis: string;
  medicineGiven: string;
  bottleSize: string;
  dosage: string;
  patientId: string;
  visitNumber: number;
  medicineEndDate: string;
  eligibility: string;
}> = [];

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

// ─── 3. Inventory (synthetic generator fills this in next commit) ────────────

const inventoryData: Array<{
  name: string;
  category: string;
  costCentre: string;
  quantity: number;
  unit: string;
}> = [];

// ─── 4. Medical Camp — "Sector G-9 Community Camp" ───────────────────────────
// campPatientData filled by synthetic generator in next commit.

const campPatientData: Array<{
  serialNo: number;
  patientName: string;
  age: string;
  phone: string;
  fatherHusbandName: string;
  area: string;
}> = [];

// ─── Main Seed Function ──────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Starting seed...");

  // ── Medicines ──
  console.log("  → Seeding medicines...");
  const existingMeds = await db.select({ id: medicines.id }).from(medicines).limit(1);
  if (existingMeds.length === 0) {
    await db.insert(medicines).values(medicineData);
    console.log(`     ✓ ${medicineData.length} medicines inserted`);
  } else {
    console.log("     ⏭  Medicines already seeded, skipping");
  }

  // ── Inventory ──
  console.log("  → Seeding inventory...");
  const existingInv = await db.select({ id: inventory.id }).from(inventory).limit(1);
  if (existingInv.length === 0 && inventoryData.length > 0) {
    await db.insert(inventory).values(
      inventoryData.map((i) => ({ ...i, lowStockThreshold: 2 })),
    );
    console.log(`     ✓ ${inventoryData.length} inventory items inserted`);
  } else if (inventoryData.length === 0) {
    console.log("     ⏭  Inventory data is empty (synthetic generator not yet wired), skipping");
  } else {
    console.log("     ⏭  Inventory already seeded, skipping");
  }

  // ── Patients & Visits ──
  console.log("  → Seeding patients and visits...");
  const existingPats = await db.select({ id: patients.id }).from(patients).limit(1);
  if (existingPats.length === 0 && patientVisitRows.length > 0) {
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
        const [inserted] = await db.insert(patients).values({
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
        await db.insert(visits).values({
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
    console.log(
      `     ✓ ${visitOk}/${patientVisitRows.length} visits inserted` +
        (visitFailures.length ? ` (${visitFailures.length} failed)` : "") +
        (visitOrphan ? ` (${visitOrphan} skipped — parent patient missing)` : ""),
    );
  } else if (patientVisitRows.length === 0) {
    console.log("     ⏭  Patient data is empty (synthetic generator not yet wired), skipping");
  } else {
    console.log("     ⏭  Patients already seeded, skipping");
  }

  // ── Medical Camp ──
  console.log("  → Seeding medical camp...");
  const existingCamps = await db.select({ id: medicalCamps.id }).from(medicalCamps).limit(1);
  if (existingCamps.length === 0) {
    const [camp] = await db
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

    await db.insert(campDoctors).values([
      { campId, doctorName: "Dr. General Physician", specialty: "General Medicine" },
    ]);

    await db.insert(campTests).values([
      { campId, testName: "General OPD Consultation" },
      { campId, testName: "Blood Pressure Check" },
      { campId, testName: "Blood Sugar Test" },
    ]);

    if (campPatientData.length > 0) {
      await db.insert(campPatients).values(campPatientData.map((p) => ({ campId, ...p })));
    }

    console.log(`     ✓ Medical camp created with ${campPatientData.length} patients`);
  } else {
    console.log("     ⏭  Medical camps already seeded, skipping");
  }

  console.log("✅ Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
