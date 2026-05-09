import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");

    if (!code) {
      res.status(400).json({ error: "code is required" });
      return;
    }

    try {
      const tokens = await sdk.exchangeCodeForToken(code);
      
      if (!tokens.id_token) {
        res.status(400).json({ error: "id_token missing from Google response" });
        return;
      }

      const userInfo = await sdk.getUserInfo(tokens.id_token);

      if (!userInfo.sub) {
        res.status(400).json({ error: "sub missing from user info" });
        return;
      }

      let step: "upsertUser" | "getUserByOpenId" | "applyInvite" = "upsertUser";
      let user: Awaited<ReturnType<typeof db.getUserByOpenId>>;
      try {
        await db.upsertUser({
          openId: userInfo.sub,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: "google",
          lastSignedIn: new Date(),
        });
        step = "getUserByOpenId";
        user = await db.getUserByOpenId(userInfo.sub);

        if (user && userInfo.email) {
          step = "applyInvite";
          const invite = await db.findPendingInviteByEmail(userInfo.email);
          if (invite) {
            await db.updateUserRole(user.id, invite.assignedRole);
            await db.consumePendingInvite(invite.id);
            user = await db.getUserByOpenId(userInfo.sub);
          }
        }
      } catch (err) {
        const e = err as { code?: string; errno?: number; sqlState?: string; sqlMessage?: string; sql?: string; message?: string; stack?: string };
        console.error(`[OAuth] ${step} failed`, {
          step,
          openId: userInfo.sub,
          email: userInfo.email ?? null,
          code: e?.code,
          errno: e?.errno,
          sqlState: e?.sqlState,
          sqlMessage: e?.sqlMessage,
          sql: e?.sql,
          message: e?.message,
          stack: e?.stack,
        });
        throw err;
      }

      if (!user) {
        res.status(500).json({ error: "Failed to create user" });
        return;
      }

      // Deactivated users never get a session cookie — bounce to a public
      // /access-denied page. Defensively clear any stale cookie they might
      // have from a prior active session so they don't loop through here.
      if (!user.isActive) {
        const cookieOptions = getSessionCookieOptions(req);
        res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        res.redirect(302, "/access-denied");
        return;
      }

      // Open a tracked session row (auto-closes any prior open one)
      try {
        const ip = (req.ip ?? req.socket?.remoteAddress ?? null) as string | null;
        const userAgent = req.get("user-agent") ?? null;
        const sessionId = await db.openUserSession({ userId: user.id, ipAddress: ip, userAgent });
        await db.logActivity({ userId: user.id, action: "login", entityType: "session", entityId: sessionId });
      } catch (sessionErr) {
        console.error("[OAuth] Failed to open user session", sessionErr);
        // Do not fail the login over session-tracking issues
      }

      const sessionToken = await sdk.createSessionToken(userInfo.sub, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
