/**
 * Daily demo-reset job.
 *
 * Active only when ENV.demoMode === true.
 *
 * Schedule: 0 3 * * *  UTC (03:00 daily). Outside likely demo-traffic
 * hours globally.
 *
 * Implementation:
 *   - node-cron registers the schedule on startup
 *   - The job wipes all non-users tables (14 of them) and the non-seed
 *     users, then re-runs seedDatabase() to repopulate
 *   - The truncate + reseed run inside a single MySQL transaction so a
 *     mid-job failure rolls back to the pre-reset state
 *   - One row written to demo_reset_log per run (success OR failure)
 *
 * Endpoints (gated by demoMode):
 *   POST /__demo/reset   — manual trigger, requires X-Demo-Reset-Secret
 *   GET  /__demo/health  — HTML page with last 30 reset log entries
 */
import type { Express, Request, Response } from "express";
import cron from "node-cron";
import { desc, notInArray } from "drizzle-orm";
import { getDb } from "../db";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { DEMO_USERS } from "./demo";
import { seedDatabase, type SeedCounts } from "../seed";
import {
  activityLogs,
  campDoctors,
  campPatients,
  campTests,
  demoResetLog,
  inventory,
  medicalCamps,
  medicines,
  notifications,
  patients,
  pendingApprovals,
  pendingInvites,
  priceHistory,
  users,
  userSessions,
  visits,
} from "../../drizzle/schema";

const DEMO_SEED_OPEN_IDS = DEMO_USERS.map((u) => u.openId);

type ResetResult = {
  success: boolean;
  durationMs: number;
  counts: SeedCounts;
  errorMessage: string | null;
};

/**
 * Wipe-and-reseed the demo database. Returns the result instead of
 * throwing so callers (cron + HTTP endpoint) can both log + render.
 */
export async function runDemoReset(): Promise<ResetResult> {
  const startedAt = Date.now();
  const db = await getDb();
  if (!db) {
    return {
      success: false,
      durationMs: Date.now() - startedAt,
      counts: emptyCounts(),
      errorMessage: "Database handle unavailable",
    };
  }

  let counts: SeedCounts = emptyCounts();
  try {
    counts = await db.transaction(async (tx) => {
      // Order matters: child tables before parents (FK respect).
      // ── Children of patients ──
      await tx.delete(priceHistory);
      await tx.delete(notifications);
      await tx.delete(pendingApprovals);
      await tx.delete(activityLogs);
      await tx.delete(userSessions);
      await tx.delete(campPatients);
      await tx.delete(campDoctors);
      await tx.delete(campTests);
      await tx.delete(visits);
      await tx.delete(pendingInvites);
      // ── Parent tables ──
      await tx.delete(patients);
      await tx.delete(medicalCamps);
      await tx.delete(inventory);
      await tx.delete(medicines);
      // ── Users: keep only the three seed accounts ──
      await tx.delete(users).where(notInArray(users.openId, DEMO_SEED_OPEN_IDS));

      // ── Reseed via the shared generator ──
      return await seedDatabase(tx);
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[demoReset] transaction failed", err);
    const durationMs = Date.now() - startedAt;
    // Best-effort log row (outside the rolled-back transaction)
    try {
      await db.insert(demoResetLog).values({
        durationMs,
        patientsInserted: 0,
        visitsInserted: 0,
        inventoryInserted: 0,
        medicinesInserted: 0,
        campsInserted: 0,
        campPatientsInserted: 0,
        success: false,
        errorMessage,
      });
    } catch (logErr) {
      console.error("[demoReset] failed to write failure log row", logErr);
    }
    return { success: false, durationMs, counts, errorMessage };
  }

  const durationMs = Date.now() - startedAt;
  // Success log row
  try {
    await db.insert(demoResetLog).values({
      durationMs,
      patientsInserted: counts.patientsInserted,
      visitsInserted: counts.visitsInserted,
      inventoryInserted: counts.inventoryInserted,
      medicinesInserted: counts.medicinesInserted,
      campsInserted: counts.campsInserted,
      campPatientsInserted: counts.campPatientsInserted,
      success: true,
      errorMessage: null,
    });
  } catch (logErr) {
    console.error("[demoReset] failed to write success log row", logErr);
  }

  return { success: true, durationMs, counts, errorMessage: null };
}

function emptyCounts(): SeedCounts {
  return {
    medicinesInserted: 0,
    inventoryInserted: 0,
    patientsInserted: 0,
    visitsInserted: 0,
    campsInserted: 0,
    campPatientsInserted: 0,
  };
}

/** Schedules the daily 03:00 UTC reset. */
export function registerDemoCron() {
  cron.schedule(
    "0 3 * * *",
    async () => {
      console.log("[demoReset] starting scheduled reset");
      const result = await runDemoReset();
      console.log(
        `[demoReset] ${result.success ? "OK" : "FAILED"} in ${result.durationMs}ms`,
        result.success ? result.counts : result.errorMessage,
      );
    },
    { timezone: "UTC" },
  );
  console.log("[demoReset] cron scheduled for 0 3 * * * UTC");
}

/**
 * Registers POST /__demo/reset and GET /__demo/health.
 *
 * POST /__demo/reset requires header X-Demo-Reset-Secret matching
 * ENV.demoResetSecret. If the secret is empty (env var unset), the
 * endpoint refuses every request — manual reset is opt-in.
 *
 * GET /__demo/health requires an authenticated session. Renders a small
 * HTML page with the last 30 entries from demo_reset_log.
 */
export function registerDemoResetEndpoints(app: Express) {
  app.post("/__demo/reset", async (req: Request, res: Response) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");

    if (!ENV.demoResetSecret) {
      res.status(503).json({ error: "Manual reset is disabled (DEMO_RESET_SECRET unset)." });
      return;
    }
    const provided = req.get("x-demo-reset-secret");
    if (provided !== ENV.demoResetSecret) {
      res.status(401).json({ error: "Bad or missing X-Demo-Reset-Secret" });
      return;
    }

    console.log("[demoReset] manual reset triggered");
    const result = await runDemoReset();
    res
      .status(result.success ? 200 : 500)
      .json({
        success: result.success,
        durationMs: result.durationMs,
        counts: result.counts,
        errorMessage: result.errorMessage,
      });
  });

  app.get("/__demo/health", async (req: Request, res: Response) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");

    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user) {
      res.status(401).type("text").send("Sign in required.");
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(503).type("text").send("Database unavailable.");
      return;
    }

    const rows = await db
      .select()
      .from(demoResetLog)
      .orderBy(desc(demoResetLog.ranAt))
      .limit(30);

    const tableRows = rows
      .map(
        (r) => `
          <tr class="${r.success ? "ok" : "fail"}">
            <td>${new Date(r.ranAt).toISOString()}</td>
            <td>${r.durationMs}</td>
            <td>${r.success ? "✓" : "✗"}</td>
            <td>${r.patientsInserted}</td>
            <td>${r.visitsInserted}</td>
            <td>${r.inventoryInserted}</td>
            <td>${r.medicinesInserted}</td>
            <td>${r.campsInserted}</td>
            <td>${r.campPatientsInserted}</td>
            <td>${escapeHtml(r.errorMessage ?? "")}</td>
          </tr>`,
      )
      .join("");

    res.status(200).type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Demo Reset Health · Outreach Health CRM</title>
  <style>
    body { font: 13px/1.4 -apple-system, system-ui, sans-serif; margin: 24px; color: #111; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    p { color: #666; margin: 0 0 16px; }
    table { border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; vertical-align: top; }
    th { background: #f6f6f6; }
    tr.ok td { background: #f6fff6; }
    tr.fail td { background: #fff4f4; }
    code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Demo Reset Health</h1>
  <p>Last 30 runs of the daily reset (03:00 UTC) and any manual triggers. Page is gated by <code>DEMO_MODE=true</code> and requires an authenticated session.</p>
  ${rows.length === 0
    ? "<p><em>No reset rows yet. The cron has not fired since deploy.</em></p>"
    : `<table>
      <thead>
        <tr>
          <th>Ran at (UTC)</th><th>ms</th><th>OK</th>
          <th>pat</th><th>vis</th><th>inv</th><th>med</th><th>camp</th><th>cp</th>
          <th>Error</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>`}
</body>
</html>`);
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
