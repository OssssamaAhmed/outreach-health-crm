import { Button } from "@/components/ui/button";
import { ShieldOff } from "lucide-react";
import { trpc } from "@/lib/trpc";

const LOGO_URL = "/logo.png";

/**
 * Standalone landing page shown when a deactivated user lands here from the
 * OAuth callback (or via SDK auth gate redirect). Lives outside AppLayout
 * so it remains reachable even while signed out / locked out.
 */
export default function AccessDenied() {
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/logged-out"; },
    onError:   () => { window.location.href = "/logged-out"; }, // best-effort — still bounce
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px]">
        <div className="bg-card rounded-lg border border-border p-8">
          <div className="text-center mb-6">
            <img
              src={LOGO_URL}
              alt="Outreach Health"
              className="h-14 w-14 mx-auto mb-4 object-contain"
            />
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-red-50 border border-red-100 mb-4">
              <ShieldOff className="h-5 w-5 text-red-700" />
            </div>
            <h1 className="font-display text-[22px] font-medium text-text-primary leading-tight">
              Access has been revoked
            </h1>
            <p className="text-[13px] text-text-secondary mt-2 leading-relaxed">
              Your account has been deactivated. Contact your administrator if
              you think this is a mistake.
            </p>
          </div>

          <div className="pt-6 border-t border-border">
            <Button
              variant="outline"
              onClick={() => logout.mutate(undefined)}
              disabled={logout.isPending}
              className="w-full"
            >
              {logout.isPending ? "Signing out…" : "Sign out"}
            </Button>
            <p className="text-[12px] text-text-muted text-center mt-4 leading-relaxed">
              Outreach Health · CRM
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
