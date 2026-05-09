/**
 * DO NOT RUN IN PRODUCTION ONCE LIVE DATA EXISTS
 *
 * One-shot recovery script: deletes everything in patients / visits /
 * camp_patients, then re-runs server/seed.ts to repopulate from the CSV.
 *
 * Run with:
 *   DATABASE_URL=mysql://… npx tsx scripts/wipe-and-reseed-patients.ts
 *
 * Will refuse to do anything until you type WIPE at the prompt.
 *
 * Tables NOT touched:
 *   - inventory, medicines (reference data)
 *   - medical_camps, camp_doctors, camp_tests
 *   - users, user_sessions, activity_logs, pending_invites
 *
 * Note: because medical_camps is preserved, the camp_patients table will
 * stay empty after this script runs — seed.ts skips its camp seed block
 * when medical_camps already has rows. If you also want camp_patients
 * re-seeded from the original PDF data, manually empty medical_camps too
 * (or extend this script after explicit approval).
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import { spawnSync } from "child_process";
import * as readline from "readline";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

function ask(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(prompt, (answer) => { rl.close(); res(answer); }));
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL is not set");
    process.exit(1);
  }
  const masked = url.replace(/:[^@]+@/, ":***@");

  console.log("");
  console.log("  ⚠  WIPE AND RESEED PATIENTS");
  console.log("");
  console.log("  This will DELETE all rows from:");
  console.log("     - visits");
  console.log("     - camp_patients");
  console.log("     - patients");
  console.log("");
  console.log("  Then re-run server/seed.ts to repopulate via the synthetic generator.");
  console.log("  inventory, medicines, medical_camps, camp_doctors, camp_tests,");
  console.log("  users, user_sessions, activity_logs, pending_invites are NOT touched.");
  console.log("");
  console.log(`  DATABASE_URL: ${masked}`);
  console.log("");

  const answer = await ask("  Type WIPE to continue (anything else aborts): ");
  if (answer.trim() !== "WIPE") {
    console.log("  Aborted. Nothing changed.");
    process.exit(0);
  }

  const db = drizzle(url);

  console.log("");
  console.log("  → Wiping visits...");
  await db.execute(sql`DELETE FROM visits`);
  console.log("  → Wiping camp_patients...");
  await db.execute(sql`DELETE FROM camp_patients`);
  console.log("  → Wiping patients...");
  await db.execute(sql`DELETE FROM patients`);
  console.log("  ✓ Wipe complete.");
  console.log("");
  console.log("  → Running server/seed.ts...");
  console.log("");

  // Spawn the seed in a child process — seed.ts has a top-level
  // `seed().catch(...)` that auto-runs at import, so calling it via
  // child_process keeps lifecycle clean.
  const seedPath = resolve(REPO_ROOT, "server/seed.ts");
  const isWin = process.platform === "win32";
  const result = spawnSync(isWin ? "npx.cmd" : "npx", ["tsx", seedPath], {
    stdio: "inherit",
    env: process.env,
    shell: isWin,
  });

  if (result.error) {
    console.error("✗ Failed to spawn seed:", result.error);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error("✗ wipe-and-reseed failed:", err);
  process.exit(1);
});
