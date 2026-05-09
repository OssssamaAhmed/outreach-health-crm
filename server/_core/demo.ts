/**
 * Demo-mode primitives.
 *
 * Active only when ENV.demoMode === true. Three seed accounts persist
 * across the daily reset; the rest of the database is wiped nightly.
 *
 * The session-mint endpoint at GET /__demo/login?role=... bypasses Google
 * OAuth entirely and creates a session cookie for the matching seed user.
 * This route returns 404 when demoMode is off, so the production deploy
 * has no surface area exposed.
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

export type DemoRole = "super_admin" | "admin" | "receptionist";

type DemoUser = {
  openId: string;
  role: DemoRole;
  name: string;
  email: string;
};

/**
 * Sentinel openIds used only by the demo. Identifying seed users by
 * openId (not by id, not by email) lets the daily-reset cron reliably
 * distinguish them from session-created accounts.
 */
export const DEMO_USERS: readonly DemoUser[] = [
  {
    openId: "demo-super-admin",
    role: "super_admin",
    name: "Demo Super-admin",
    email: "demo-super-admin@example.com",
  },
  {
    openId: "demo-admin",
    role: "admin",
    name: "Demo Admin",
    email: "demo-admin@example.com",
  },
  {
    openId: "demo-receptionist",
    role: "receptionist",
    name: "Demo Receptionist",
    email: "demo-receptionist@example.com",
  },
] as const;

const DEMO_SEED_OPEN_IDS: ReadonlySet<string> = new Set(DEMO_USERS.map((u) => u.openId));

/** Is this the openId of one of the three demo seed accounts? */
export function isDemoSeedUser(openId: string | null | undefined): boolean {
  if (!openId) return false;
  return DEMO_SEED_OPEN_IDS.has(openId);
}

/**
 * Upserts the three demo accounts. Idempotent — safe to call on every
 * startup. Errors are logged but never thrown; a DB outage during
 * startup must not crash the boot sequence.
 */
export async function seedDemoUsers(): Promise<void> {
  if (!ENV.demoMode) return;
  for (const u of DEMO_USERS) {
    try {
      await db.upsertUser({
        openId: u.openId,
        name: u.name,
        email: u.email,
        loginMethod: "demo",
        role: u.role,
        lastSignedIn: new Date(),
      });
    } catch (err) {
      console.error("[demo] failed to seed demo user", u.openId, err);
    }
  }
  console.log("[demo] seeded demo users:", DEMO_USERS.map((u) => u.openId).join(", "));
}

/**
 * Registers GET /__demo/login?role=... — only when demoMode is on.
 *
 * In production (demoMode=false), the route is not registered, so a
 * direct hit returns 404 from express's default handler.
 */
export function registerDemoRoutes(app: Express) {
  if (!ENV.demoMode) return;

  app.get("/__demo/login", async (req: Request, res: Response) => {
    const roleParam = typeof req.query.role === "string" ? req.query.role : "";
    const target = DEMO_USERS.find((u) => u.role === roleParam);
    if (!target) {
      res.status(400).send(
        "Bad request. ?role= must be one of: super_admin, admin, receptionist",
      );
      return;
    }

    try {
      // Make sure the user row exists (cheap; the function is idempotent)
      await db.upsertUser({
        openId: target.openId,
        name: target.name,
        email: target.email,
        loginMethod: "demo",
        role: target.role,
        lastSignedIn: new Date(),
        isActive: true,
      });

      // Open a tracked session row mirroring the OAuth flow
      try {
        const ip = (req.ip ?? req.socket?.remoteAddress ?? null) as string | null;
        const userAgent = req.get("user-agent") ?? null;
        const user = await db.getUserByOpenId(target.openId);
        if (user) {
          await db.openUserSession({ userId: user.id, ipAddress: ip, userAgent });
          await db.logActivity({ userId: user.id, action: "login", entityType: "session" });
        }
      } catch (sessionErr) {
        console.error("[demo] session-tracking failed (non-fatal)", sessionErr);
      }

      const sessionToken = await sdk.createSessionToken(target.openId, {
        name: target.name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (err) {
      console.error("[demo] /__demo/login failed", err);
      res.status(500).send("Demo login failed");
    }
  });
}
