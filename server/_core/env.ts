export const ENV = {
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Feature flag — when "true", admin destructive/major actions route
  // through the super_admin approval workflow. Default off for safe
  // rollout; flip on Railway after the UI in commit E is deployed.
  approvalsEnforced: process.env.APPROVALS_ENFORCED === "true",
  // Feature flag — when "true", the app runs in demo mode:
  //   - Login page swaps to role-switcher buttons (no Google OAuth)
  //   - users.updateRole + users.setActive on seeded demo accounts return FORBIDDEN
  //   - /__demo/login mints a session for the picked role
  //   - Daily reset cron wipes non-user tables at 03:00 UTC (commit 7)
  // Use ONLY on a separate demo deployment with a separate database.
  demoMode: process.env.DEMO_MODE === "true",
};
