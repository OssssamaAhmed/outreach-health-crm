/**
 * Synthetic camp-patient generator.
 *
 * Produces 60 camp-patient records with serial numbers 1..60. Output
 * matches the campPatientData shape in server/seed.ts. Records are
 * left unlinked from the main patients table on purpose — the demo
 * highlights the beneficiary-continuity flow where camp records are
 * matched to existing patients via the findCandidate route.
 */
import { faker } from "@faker-js/faker";
import {
  AREAS,
  FAMILY_NAMES,
  FIRST_NAMES_FEMALE,
  FIRST_NAMES_MALE,
} from "./_data/names";

export type CampPatientRow = {
  serialNo: number;
  patientName: string;
  age: string;
  phone: string;
  fatherHusbandName: string;
  area: string;
};

function pakistaniMobile(): string {
  const prefix = faker.helpers.arrayElement(["0300", "0301", "0312", "0321", "0333", "0345"]);
  const rest = faker.string.numeric(7);
  return `${prefix} ${rest}`;
}

export function generateCampPatients(seed = 44): CampPatientRow[] {
  faker.seed(seed);

  const COUNT = 60;
  const rows: CampPatientRow[] = [];

  for (let i = 1; i <= COUNT; i++) {
    const gender = faker.helpers.arrayElement(["Male", "Female"]);
    const first =
      gender === "Male"
        ? faker.helpers.arrayElement(FIRST_NAMES_MALE)
        : faker.helpers.arrayElement(FIRST_NAMES_FEMALE);
    const family = faker.helpers.arrayElement(FAMILY_NAMES);
    const father =
      faker.helpers.arrayElement(FIRST_NAMES_MALE) +
      " " +
      faker.helpers.arrayElement(FAMILY_NAMES);

    const ageRaw = faker.number.int({ min: 1, max: 80 });
    // Some camp records leave age blank — match the original CSV's variability
    const age = faker.helpers.maybe(() => String(ageRaw), { probability: 0.85 }) ?? "";

    const phone = faker.helpers.maybe(() => pakistaniMobile(), { probability: 0.7 }) ?? "";

    rows.push({
      serialNo: i,
      patientName: `${first} ${family}`,
      age,
      phone,
      fatherHusbandName: father,
      area: faker.helpers.arrayElement(AREAS),
    });
  }

  return rows;
}
