/**
 * Client-side mirror of the server's ENV.demoMode flag.
 *
 * Read via Vite at build time. Server-side gates in routers.ts are the
 * source of truth — this constant is purely for UX hinting (showing the
 * banner, swapping the login screen, hiding destructive controls).
 *
 * Set VITE_DEMO_MODE=true in .env on the demo deployment. Production
 * deployments leave it unset; the strict string equality below ensures
 * any value other than the literal "true" resolves to false.
 */
export const IS_DEMO_MODE: boolean = import.meta.env.VITE_DEMO_MODE === "true";
