import { getDb } from './db';
import { patients, visits } from '../drizzle/schema';
import { desc } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) { console.log('no db'); process.exit(1); }

  const allPatients = await db.select().from(patients).orderBy(desc(patients.id));
  console.log('Total patients:', allPatients.length);
  allPatients.forEach(p => console.log(p.patientId, '|', p.name, '|', p.fatherName, '|', p.age, '|', p.gender, '|', p.phone, '|', p.area));

  const allVisits = await db.select().from(visits).orderBy(desc(visits.id));
  console.log('\nTotal visits:', allVisits.length);
  allVisits.forEach(v => console.log('Visit', v.visitNumber, '| PatientID', v.patientId, '|', v.complaint, '|', v.diagnosis, '|', v.medicineGiven));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
