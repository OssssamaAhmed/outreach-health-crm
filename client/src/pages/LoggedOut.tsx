import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { getLoginUrl } from "@/const";

const LOGO_URL = "/logo.png";

/**
 * Standalone landing page shown immediately after a user signs out. Lives
 * outside AppLayout so the unauthenticated-bounce guard never fires here —
 * which is the whole point: a "logged out" page must be reachable while
 * logged out. Click "Sign in" to begin a fresh OAuth flow.
 */
export default function LoggedOut() {
  const handleSignIn = () => {
    window.location.href = getLoginUrl();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px]">
        <div className="bg-card rounded-lg border border-border p-8">
          {/* Logo + brand */}
          <div className="text-center mb-6">
            <img
              src={LOGO_URL}
              alt="Outreach Health"
              className="h-14 w-14 mx-auto mb-4 object-contain"
            />
            <h1 className="font-display text-[24px] font-medium text-text-primary leading-tight">
              You've been signed out
            </h1>
            <p className="text-[13px] text-text-secondary mt-2 leading-relaxed">
              Click below when you're ready to sign in again.
            </p>
          </div>

          {/* Sign in */}
          <div className="pt-6 border-t border-border">
            <Button onClick={handleSignIn} className="w-full gap-2">
              <LogOut className="h-4 w-4 rotate-180" />
              Sign in
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
