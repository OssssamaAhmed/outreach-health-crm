import AppLayout from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, FileText } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type StatusKey = "all" | "pending" | "approved" | "rejected" | "cancelled" | "superseded";

const STATUS_LABEL: Record<Exclude<StatusKey, "all">, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  superseded: "Superseded",
};

const STATUS_BADGE: Record<Exclude<StatusKey, "all">, string> = {
  pending:    "bg-amber-50 text-amber-700 border-amber-200",
  approved:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected:   "bg-red-50 text-red-700 border-red-200",
  cancelled:  "bg-gray-100 text-gray-600 border-gray-200",
  superseded: "bg-gray-100 text-gray-600 border-gray-200",
};

const ENTITY_LABEL: Record<string, string> = {
  patient:      "Patient",
  visit:        "Visit",
  inventory:    "Inventory item",
  medicine:     "Medicine",
  medical_camp: "Medical camp",
};

function chipClasses(active: boolean) {
  return [
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
    active
      ? "bg-brand-primary text-white border-brand-primary"
      : "bg-card border-border text-text-secondary hover:bg-muted",
  ].join(" ");
}

export default function MyRequests() {
  const [filter, setFilter] = useState<StatusKey>("all");
  const utils = trpc.useUtils();

  // Fetch all (no status param) and filter client-side so the chip counts can render
  const { data: all, isLoading } = trpc.approvals.listMyRequests.useQuery({});

  const filtered = useMemo(() => {
    if (!all) return [];
    if (filter === "all") return all;
    return all.filter((r) => r.status === filter);
  }, [all, filter]);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, cancelled: 0, superseded: 0 };
    if (all) for (const r of all) (c as Record<string, number>)[r.status] = ((c as Record<string, number>)[r.status] ?? 0) + 1;
    return c;
  }, [all]);

  const cancelMut = trpc.approvals.cancel.useMutation({
    onSuccess: () => {
      toast.success("Request cancelled");
      utils.approvals.listMyRequests.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <PageHeader
          title="My Requests"
          description="Track your deletion and update requests pending super-admin approval"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setFilter("all")} className={chipClasses(filter === "all")}>
            All <span className="opacity-80">({all?.length ?? 0})</span>
          </button>
          <button type="button" onClick={() => setFilter("pending")} className={chipClasses(filter === "pending")}>
            Pending <span className="opacity-80">({counts.pending})</span>
          </button>
          <button type="button" onClick={() => setFilter("approved")} className={chipClasses(filter === "approved")}>
            Approved <span className="opacity-80">({counts.approved})</span>
          </button>
          <button type="button" onClick={() => setFilter("rejected")} className={chipClasses(filter === "rejected")}>
            Rejected <span className="opacity-80">({counts.rejected})</span>
          </button>
          <button type="button" onClick={() => setFilter("cancelled")} className={chipClasses(filter === "cancelled")}>
            Cancelled <span className="opacity-80">({counts.cancelled})</span>
          </button>
          {counts.superseded > 0 && (
            <button type="button" onClick={() => setFilter("superseded")} className={chipClasses(filter === "superseded")}>
              Superseded <span className="opacity-80">({counts.superseded})</span>
            </button>
          )}
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">Loading…</CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="h-10 w-10 text-text-muted/40 mx-auto mb-3" />
              <p className="text-sm text-text-secondary">
                {filter === "all" ? "You haven't submitted any approval requests yet." : `No ${STATUS_LABEL[filter]?.toLowerCase()} requests.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[11px] border ${STATUS_BADGE[r.status]}`}>
                          {STATUS_LABEL[r.status]}
                        </Badge>
                        <span className="text-[13px] font-medium text-text-primary">
                          {r.requestType === "delete" ? "Delete" : "Update"} · {ENTITY_LABEL[r.entityType] ?? r.entityType} #{r.entityId}
                        </span>
                        <span className="text-[12px] text-text-muted">
                          {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      {r.reason && (
                        <p className="text-[13px] text-text-secondary mt-2">
                          <span className="text-text-muted">Reason:</span> {r.reason}
                        </p>
                      )}
                      {r.decisionNote && (
                        <p className="text-[13px] text-text-secondary mt-1">
                          <span className="text-text-muted">Decision note:</span> {r.decisionNote}
                        </p>
                      )}
                      {r.decidedAt && (
                        <p className="text-[12px] text-text-muted mt-1">
                          Decided {format(new Date(r.decidedAt), "dd MMM yyyy, HH:mm")}
                        </p>
                      )}
                    </div>
                    {r.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm("Cancel this request?")) cancelMut.mutate({ id: r.id });
                        }}
                        disabled={cancelMut.isPending}
                      >
                        Cancel request
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="rounded-md border border-border bg-muted/30 p-3 flex items-start gap-2">
          <Clock className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
          <p className="text-[12px] text-text-secondary">
            Pending requests stay visible to super admins until decided. Approved deletions and updates execute immediately on decision; the affected row may be hidden from your list view in the meantime.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

