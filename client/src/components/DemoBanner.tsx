import { Info } from "lucide-react";
import { IS_DEMO_MODE } from "@/lib/demoMode";

/**
 * Yellow strip rendered above main content when VITE_DEMO_MODE=true.
 * Renders nothing in production, so importing it from AppLayout is free.
 */
export function DemoBanner() {
  if (!IS_DEMO_MODE) return null;
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-[12.5px] text-amber-900">
      <Info className="h-3.5 w-3.5 flex-shrink-0" />
      <p>
        <span className="font-medium">Demo environment.</span>{" "}
        Data resets daily at 03:00 UTC. Do not enter real data.
      </p>
    </div>
  );
}
