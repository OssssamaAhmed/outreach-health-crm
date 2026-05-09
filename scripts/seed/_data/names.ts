/**
 * Curated reference lists for the synthetic seed generator.
 *
 * faker-js doesn't ship a Pakistani locale, so the name + area + clinical
 * lists below are hand-picked to give the demo data Pakistani local
 * flavour without using any real records.
 */

export const FIRST_NAMES_MALE = [
  "Ahmed", "Muhammad", "Ali", "Hassan", "Hussain", "Bilal", "Faisal",
  "Imran", "Kamran", "Nadeem", "Rashid", "Saleem", "Tariq", "Usman",
  "Zafar", "Asad", "Asif", "Kashif", "Saqib", "Yasir", "Khalid",
  "Junaid", "Adeel", "Waqas", "Hamza", "Faraz", "Sarmad", "Atif",
  "Rohan", "David", "Daniyal", "Talha",
];

export const FIRST_NAMES_FEMALE = [
  "Aisha", "Fatima", "Zainab", "Maryam", "Sana", "Hira", "Bushra",
  "Saima", "Naila", "Rabia", "Fariha", "Samina", "Nargis", "Rukhsana",
  "Sobia", "Ayesha", "Sadia", "Iqra", "Mehwish", "Rida", "Mahnoor",
  "Anum", "Hina", "Sumera", "Tanzeela", "Wajiha", "Zarmeena",
  "Sarah", "Anita", "Kainat", "Rimsha",
];

export const FAMILY_NAMES = [
  "Khan", "Hussain", "Ali", "Ahmed", "Sheikh", "Malik", "Qureshi",
  "Chaudhry", "Butt", "Awan", "Siddiqui", "Rana", "Mirza", "Shah",
  "Raza", "Iqbal", "Akram", "Khalid", "Rauf", "Hashmi", "Khokhar",
  "Bhatti", "Memon", "Lodhi",
];

/** Karachi neighborhoods — the original deployment's primary catchment area. */
export const AREAS = [
  "Gulshan-e-Iqbal", "North Nazimabad", "Korangi", "Saddar",
  "Clifton", "DHA Phase 2", "DHA Phase 5", "Malir", "North Karachi",
  "Gulistan-e-Johar", "F.B. Area", "PECHS", "Lyari", "Orangi Town",
  "New Karachi", "Liaquatabad", "Nazimabad", "Garden East",
  "Sector 11-A North Karachi", "Federal B Area", "Shah Faisal Colony",
  "Defence View", "Bahadurabad", "Soldier Bazaar",
];

/** Common primary-care complaints. Plausible without being from real records. */
export const COMPLAINTS = [
  "Fever", "Cough", "Headache", "Body pain", "Stomach pain",
  "Diarrhea", "Vomiting", "Sore throat", "Allergy", "Skin rash",
  "Cold/Flu", "BP check", "Diabetes follow-up", "Back pain",
  "Joint pain", "Chest pain", "Cough/fever", "Fatigue",
  "Itching", "Nausea",
];

/** Diagnoses that map plausibly to the complaint list above. */
export const DIAGNOSES = [
  "RTI", "URI", "Gastritis", "Migraine", "Hypertension",
  "Type 2 Diabetes", "Allergic rhinitis", "Viral fever",
  "Bacterial infection", "Tension headache", "Acute gastroenteritis",
  "Mechanical back pain", "Osteoarthritis", "Asthma", "GERD",
];

/** Names match the medicineData reference list in seed.ts. */
export const MEDICINES_GIVEN = [
  "Tab Paracetamol", "Syp Cough", "Tab Brufen", "Cap Risek",
  "Tab Septran", "Inj Normal Saline", "Tab Flagyl 400mg",
  "Syp Paracetamol", "Tab CPM", "Tab Hyoscine", "Tab Calciu-D",
  "Tab Montelukast 10mg", "Cap Doxycycline 100mg", "Inj PM2",
];

export const DOSAGES = [
  "1 Tab x 3 Daily", "1 Tab x 2 Daily", "1-2 Tab x 3 Daily",
  "5ml 3x daily", "10ml 3x daily", "5ml 2x daily",
  "1 Cap 1x daily", "Single dose", "1 Tab 1x daily at bedtime",
];

export const ELIGIBILITY_STATUSES = [
  "✓ Eligible - First time",
  "✓ Eligible",
  "⚠ TOO EARLY - Wait 4 days",
  "⚠ Recent visit - Confirm with senior",
];

/** Inventory item names — generic, no donor/foundation references. */
export const INVENTORY_ITEMS: Array<{ name: string; category: string; unit: string }> = [
  { name: "Air Conditioner", category: "Equipment", unit: "Unit" },
  { name: "Hospital Bed", category: "Furniture", unit: "Unit" },
  { name: "Wheel Chair", category: "Medical Equipment", unit: "Unit" },
  { name: "Stethoscope", category: "Medical Equipment", unit: "Unit" },
  { name: "Nebulizer", category: "Medical Equipment", unit: "Unit" },
  { name: "Operation Table", category: "Medical Equipment", unit: "Unit" },
  { name: "Drip Stand", category: "Medical Equipment", unit: "Unit" },
  { name: "Stretcher", category: "Medical Equipment", unit: "Unit" },
  { name: "Weight Machine", category: "Medical Equipment", unit: "Unit" },
  { name: "Blood Pressure Monitor", category: "Medical Equipment", unit: "Unit" },
  { name: "Glucometer", category: "Medical Equipment", unit: "Unit" },
  { name: "Examination Table", category: "Medical Equipment", unit: "Unit" },
  { name: "Desktop Computer", category: "Electronics", unit: "Unit" },
  { name: "Printer", category: "Electronics", unit: "Unit" },
  { name: "Wifi Router", category: "Electronics", unit: "Unit" },
  { name: "CCTV Camera", category: "Electronics", unit: "Unit" },
  { name: "LED Monitor", category: "Electronics", unit: "Unit" },
  { name: "Refrigerator", category: "Equipment", unit: "Unit" },
  { name: "Water Cooler", category: "Equipment", unit: "Unit" },
  { name: "Generator", category: "Equipment", unit: "Unit" },
  { name: "Office Chair", category: "Furniture", unit: "Piece" },
  { name: "Wooden Bench", category: "Furniture", unit: "Piece" },
  { name: "Steel Almirah", category: "Furniture", unit: "Unit" },
  { name: "Reception Counter", category: "Furniture", unit: "Unit" },
  { name: "Curtains", category: "Furniture", unit: "Piece" },
  { name: "White Bed Sheets", category: "Linen", unit: "Piece" },
  { name: "Pillows", category: "Linen", unit: "Piece" },
  { name: "Doctor Coat", category: "Uniform", unit: "Piece" },
  { name: "Nurse Uniform", category: "Uniform", unit: "Piece" },
  { name: "Plastic Cups", category: "Supplies", unit: "Piece" },
];

/** Cost centres the foundation tracked in the original deployment. */
export const COST_CENTRES = [
  "Pharmacy", "Reception", "OPD 1", "OPD 2", "Operation Theater 1",
  "Operation Theater 2", "ICU", "General Ward", "Kitchen",
  "Administration", "Vaccination", "Lounge", "Various",
];
