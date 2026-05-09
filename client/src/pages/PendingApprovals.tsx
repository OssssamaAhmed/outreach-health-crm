import AppLayout from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, ClipboardCheck, Shield, XCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const ENTITY_LABEL: Record<string, string> = {
  patient:      "Patient",
  visit:        "Visit",
  inventory:    "Inventory item",
  medicine:     "Medicine",
  medical_camp: "Medical camp",
};

type PendingRow = {
  id: number;
  requestedBy: number;
  requesterFullName: string | null;
  requesterGoogleName: string | null;
  requesterEmail: string | null;
  requesterIsActive: boolean | null;
  requestType: "delete" | "update";
  entityType: string;
  entityId: number;
  payload: string | null;
  reason: string | null;
  createdAt: Date | string;
};

function displayRequester(r: Pick<PendingRow, "requesterFullName" | "requesterGoogleName" | "requesterEmail">) {
  return r.requesterFullName ?? r.requesterGoogleName ?? r.requesterEmail ?? "Unknown user";
}

export default function PendingApprovals() {
  const { user: currentUser } = useAuth();
  const [, navigate] = useLocation();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingRow | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const utils = trpc.useUtils();

  const isSuperAdmin = currentUser?.role === "super_admin";
  const { data: requests, isLoading } = trpc.approvals.listPending.useQuery(undefined, {
    enabled: isSuperAdmin,
  });

  const decideMut = trpc.approvals.decide.useMutation({
    onSuccess: (data) => {
      const verb = data.status === "approved"
        ? "approved"
        : data.status === "superseded"
        ? "approved (record was already changed — marked superseded)"
        : "rejected";
      toast.success(`Request ${verb}`);
      utils.approvals.listPending.invalidate();
      // Also invalidate any list that might have been affected
      utils.inventory.list.invalidate();
      utils.medicines.list.invalidate();
      utils.patients.list.invalidate();
      utils.camps.list.invalidate();
      setExpandedId(null);
      setRejectTarget(null);
      setRejectNote("");
    },
    onError: (e) => toast.error(e.message),
  });

  if (currentUser && !isSuperAdmin) {
    return (
      <AppLayout>
        <div className="p-6 text-center py-20">
          <Shield className="h-12 w-12 text-text-muted/40 mx-auto mb-4" />
          <p className="text-text-primary font-medium">Access Restricted</p>
          <p className="text-[13px] text-text-secondary mt-1">Only Super Admins can decide on approval requests.</p>
          <Button variant="ghost" onClick={() => navigate("/")} className="mt-4">Go to Dashboard</Button>
        </div>
      </AppLayout>
    );
  }

  const onApprove = (req: PendingRow) => {
    decideMut.mutate({ id: req.id, decision: "approved" });
  };

  const onConfirmReject = () => {
    if (!rejectTarget) return;
    if (!rejectNote.trim()) {
      toast.error("A decision note is required to reject");
      return;
    }
    decideMut.mutate({ id: rejectTarget.id, decision: "rejected", decisionNote: rejectNote.trim() });
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <PageHeader
          title="Pending Approvals"
          description="Admin requests waiting for your decision"
          action={
            <Badge className="text-xs gap-1 bg-amber-50 text-amber-700 border border-amber-200">
              <ClipboardCheck className="h-3 w-3" />
              {requests?.length ?? 0} pending
            </Badge>
          }
        />

        {isLoading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Loading…</CardContent></Card>
        ) : !requests || requests.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600/60 mx-auto mb-3" />
              <p className="text-sm text-text-secondary">No pending requests. Inbox zero.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const expanded = expandedId === req.id;
              const payloadObj: Record<string, unknown> | null = req.payload
                ? (() => { try { return JSON.parse(req.payload!) as Record<string, unknown>; } catch { return null; } })()
                : null;
              return (
                <Card key={req.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-medium text-text-primary">
                            {displayRequester(req)}
                          </span>
                          {req.requesterIsActive === false && (
                            <Badge className="text-[10px] bg-red-50 text-red-700 border border-red-200">
                              Requester deactivated
                            </Badge>
                          )}
                          <Badge className={req.requestType === "delete"
                            ? "text-[11px] bg-red-50 text-red-700 border border-red-200"
                            : "text-[11px] bg-amber-50 text-amber-700 border border-amber-200"}>
                            {req.requestType === "delete" ? "Delete" : "Update"}
                          </Badge>
                          <span className="text-[13px] text-text-secondary">
                            {ENTITY_LABEL[req.entityType] ?? req.entityType} #{req.entityId}
                          </span>
                          <span className="text-[12px] text-text-muted">
                            · {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        {req.reason && (
                          <p className="text-[13px] text-text-secondary mt-2">
                            <span className="text-text-muted">Reason:</span> {req.reason}
                          </p>
                        )}
                        {expanded && payloadObj && req.requestType === "update" && (
                          <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-[12px]">
                            <p className="font-medium text-text-secondary mb-1">Proposed update payload:</p>
                            <pre className="whitespace-pre-wrap break-words font-mono text-text-primary">
                              {JSON.stringify(payloadObj, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExpandedId(expanded ? null : req.id)}
                        >
                          {expanded ? "Collapse" : "Details"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-red-700 border-red-200 hover:bg-red-50"
                          onClick={() => setRejectTarget(req)}
                          disabled={decideMut.isPending}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => onApprove(req)}
                          disabled={decideMut.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                      </div>
                    </div>
                    {expanded && (
                      <p className="text-[12px] text-text-muted mt-3">
                        Submitted {format(new Date(req.createdAt), "dd MMM yyyy, HH:mm")} ·
                        Email: {req.requesterEmail ?? "—"}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject dialog — note required */}
      <Dialog open={rejectTarget !== null} onOpenChange={(v) => { if (!v) { setRejectTarget(null); setRejectNote(""); } }}>
        <DialogContent className="max-w-md">
          {rejectTarget && (
            <>
              <DialogHeader>
                <DialogTitle>Reject this request?</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <p className="text-[13px] text-text-secondary">
                  {displayRequester(rejectTarget)} requested to {rejectTarget.requestType} {ENTITY_LABEL[rejectTarget.entityType] ?? rejectTarget.entityType} #{rejectTarget.entityId}.
                </p>
                <div>
                  <Label>Decision note <span className="text-destructive">*</span></Label>
                  <Textarea
                    rows={3}
                    placeholder="Why are you rejecting this?"
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                  />
                  <p className="text-[11px] text-text-muted mt-1">The requester will see this note on their My Requests page.</p>
                </div>
                <div className="flex gap-3 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setRejectTarget(null); setRejectNote(""); }}
                    disabled={decideMut.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={onConfirmReject}
                    disabled={decideMut.isPending || !rejectNote.trim()}
                  >
                    {decideMut.isPending ? "Rejecting…" : "Reject"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
