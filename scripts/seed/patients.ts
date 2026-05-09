/**
 * Synthetic patient + visit generator.
 *
 * Produces 60 unique patients, each with 1–4 visits spread over the past
 * year. Output shape matches the patientVisitRows array in server/seed.ts
 * verbatim, so the seed function's existing dedup + insert logic operates
 * unchanged.
 */
import { faker } from "@faker-js/faker";
import {
  AREAS,
  COMPLAINTS,
  DIAGNOSES,
  DOSAGES,
  ELIGIBILITY_STATUSES,
  FAMILY_NAMES,
  FIRST_NAMES_FEMALE,
  FIRST_NAMES_MALE,
  MEDICINES_GIVEN,
} from "./_data/names";

export type PatientVisitRow = {
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
};

function pakistaniMobile(): string {
  // 03XX XXXXXXX format — synthetic, not from a known assignment block
  const prefix = faker.helpers.arrayElement(["0300", "0301", "0312", "0321", "0333", "0345"]);
  const rest = faker.string.numeric(7);
  return `${prefix} ${rest}`;
}

function makePerson(gender: "Male" | "Female") {
  const first =
    gender === "Male"
      ? faker.helpers.arrayElement(FIRST_NAMES_MALE)
      : faker.helpers.arrayElement(FIRST_NAMES_FEMALE);
  const family = faker.helpers.arrayElement(FAMILY_NAMES);
  const father =
    faker.helpers.arrayElement(FIRST_NAMES_MALE) + " " + faker.helpers.arrayElement(FAMILY_NAMES);
  return { name: `${first} ${family}`, fatherName: father };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function generatePatientVisitRows(seed = 42): PatientVisitRow[] {
  faker.seed(seed);

  const PATIENT_COUNT = 60;
  const rows: PatientVisitRow[] = [];

  for (let i = 1; i <= PATIENT_COUNT; i++) {
    const patientId = `P-${String(i).padStart(4, "0")}`;
    const gender: "Male" | "Female" = faker.helpers.arrayElement(["Male", "Female"]);
    const { name, fatherName } = makePerson(gender);
    const age = faker.number.int({ min: 1, max: 78 });
    const phone = faker.helpers.maybe(() => pakistaniMobile(), { probability: 0.85 }) ?? "";
    const area = faker.helpers.arrayElement(AREAS);

    // 1–4 visits, with the first one farther back in time
    const visitCount = faker.number.int({ min: 1, max: 4 });
    let lastVisitAt = faker.date.between({
      from: new Date(Date.now() - 365 * 24 * 3600 * 1000),
      to: new Date(Date.now() - visitCount * 30 * 24 * 3600 * 1000),
    });

    for (let v = 1; v <= visitCount; v++) {
      const complaint = faker.helpers.arrayElement(COMPLAINTS);
      const diagnosis = faker.helpers.maybe(() => faker.helpers.arrayElement(DIAGNOSES), {
        probability: 0.8,
      }) ?? "";
      const medicineGiven = faker.helpers.arrayElement(MEDICINES_GIVEN);
      const dosage = faker.helpers.arrayElement(DOSAGES);
      const isLiquid = medicineGiven.startsWith("Syp") || medicineGiven.startsWith("Inj");
      const bottleSize = isLiquid
        ? faker.helpers.arrayElement(["30", "60", "100"])
        : "";

      const visitDate = lastVisitAt;
      const durationDays = faker.number.int({ min: 3, max: 14 });
      const medicineEndDate = new Date(visitDate.getTime() + durationDays * 24 * 3600 * 1000);

      rows.push({
        date: isoDate(visitDate),
        name,
        fatherName,
        age,
        gender,
        phone,
        area,
        complaint,
        diagnosis,
        medicineGiven,
        bottleSize,
        dosage,
        patientId,
        visitNumber: v,
        medicineEndDate: isoDate(medicineEndDate),
        eligibility: faker.helpers.arrayElement(ELIGIBILITY_STATUSES),
      });

      // Push the next visit forward by 1–8 weeks
      lastVisitAt = new Date(
        visitDate.getTime() + faker.number.int({ min: 7, max: 56 }) * 24 * 3600 * 1000,
      );
    }
  }

  return rows;
}
