import AppLayout from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronRight, Clock, Download, Edit, History, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { csvFilename, downloadCsv, toCsv, type CsvColumn } from "@/lib/csv";
import { PaginationBar, PAGINATION_PAGE_SIZE, readPageParam } from "@/components/PaginationBar";

type PendingRequest = {
  id: number;
  requestType: "delete" | "update";
  requestedBy: number;
  requesterName: string;
  reason: string | null;
};

type MedicineForm = "Tablet" | "Syrup" | "Capsule" | "Injection" | "Other";

type MedicineRow = {
  id: number;
  name: string;
  category: string | null;
  form: MedicineForm | null;
  unit: string | null;
  defaultDosage: string | null;
  durationDays: number | null;
  notes: string | null;
  quantity: number;
  price: string | null;
  pendingRequest?: PendingRequest | null;
};

function formatRupees(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return `Rs. ${n.toLocaleString()}`;
}

/** Major-update rule for medicines — mirrors server isMajorUpdate. */
function isMedicineMajor(
  current: { quantity: number | null; price: string | null },
  payload: { quantity: number; price: string | null },
): boolean {
  const oldP = current.price == null ? null : Number(current.price);
  const newP = payload.price == null ? null : Number(payload.price);
  if (oldP !== newP) return true;
  const oldQ = current.quantity ?? 0;
  const delta = Math.abs(payload.quantity - oldQ);
  if (delta === 0) return false;
  if (delta > 50) return true;
  if (oldQ === 0) return true;
  return delta / Math.abs(oldQ) > 0.10;
}

const CATEGORIES = ["Pain Relief", "Antibiotic", "Antacid", "Vitamin", "Supplement", "Respiratory", "Antihistamine", "Antispasmodic", "Steroid", "PPI/Antacid", "Digestive", "Nebulization", "Other"];
const FORMS = ["Tablet", "Syrup", "Capsule", "Injection", "Cream", "Drops", "Other"] as const;

function MedicineDialog({
  open,
  onClose,
  item,
  userRole,
}: {
  open: boolean;
  onClose: () => void;
  item?: MedicineRow | null;
  userRole: string;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<{
    name: string;
    category: string;
    form: MedicineForm;
    unit: string;
    defaultDosage: string;
    durationDays: string;
    notes: string;
    quantity: string;
    price: string;
  }>({
    name: item?.name ?? "",
    category: item?.category ?? "Pain Relief",
    form: (item?.form ?? "Tablet") as MedicineForm,
    unit: item?.unit ?? "Strip (10)",
    defaultDosage: item?.defaultDosage ?? "",
    durationDays: String(item?.durationDays ?? 5),
    notes: item?.notes ?? "",
    quantity: String(item?.quantity ?? 0),
    price: item?.price ?? "",
  });
  const [reason, setReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const isAdmin = userRole === "admin";
  const isEdit = !!item;

  const isMajor = useMemo(() => {
    if (!item) return false;
    const qty = Number(form.quantity);
    if (Number.isNaN(qty)) return false;
    const newPrice = form.price.trim() === "" ? null : form.price;
    return isMedicineMajor(
      { quantity: item.quantity, price: item.price },
      { quantity: qty, price: newPrice },
    );
  }, [item, form.quantity, form.price]);

  const needsApproval = isEdit && isAdmin && isMajor;

  const historyQuery = trpc.medicines.priceHistory.useQuery(
    { id: item?.id ?? 0 },
    { enabled: !!item && showHistory },
  );

  const create = trpc.medicines.create.useMutation({
    onSuccess: () => { toast.success("Medicine added"); utils.medicines.list.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.medicines.update.useMutation({
    onSuccess: () => { toast.success("Medicine updated"); utils.medicines.list.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const requestApproval = trpc.approvals.request.useMutation({
    onSuccess: () => {
      toast.success("Update request submitted for super-admin approval");
      utils.medicines.list.invalidate();
      utils.approvals.listMyRequests.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      category: form.category,
      form: form.form,
      unit: form.unit || undefined,
      defaultDosage: form.defaultDosage || undefined,
      durationDays: Number(form.durationDays) || undefined,
      notes: form.notes || undefined,
      quantity: Number(form.quantity),
      price: form.price.trim() === "" ? null : form.price.trim(),
    };

    if (!item) {
      create.mutate(payload);
      return;
    }

    if (needsApproval) {
      if (!reason.trim()) {
        toast.error("A reason is required for major updates");
        return;
      }
      requestApproval.mutate({
        requestType: "update",
        entityType: "medicine",
        entityId: item.id,
        payload,
        reason: reason.trim(),
      });
      return;
    }

    update.mutate({ id: item.id, ...payload });
  };

  const submitting = create.isPending || update.isPending || requestApproval.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Medicine" : "Add Medicine"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <Label>Medicine Name <span className="text-destructive">*</span></Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Tab Paracetamol 500mg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Form</Label>
              <Select value={form.form} onValueChange={(v) => setForm({ ...form, form: v as MedicineForm })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unit / Pack</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. Strip (10)" />
            </div>
            <div>
              <Label>Default Duration (days)</Label>
              <Input type="number" min="1" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Stock Quantity</Label>
              <Input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div>
              <Label>Unit Price (Rs.)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="—"
              />
            </div>
          </div>
          <div>
            <Label>Default Dosage</Label>
            <Input value={form.defaultDosage} onChange={(e) => setForm({ ...form, defaultDosage: e.target.value })} placeholder="e.g. 1 Tab x 3 Daily" />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
          </div>

          {isEdit && (
            <div className="rounded-md border border-border">
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-[12px] text-text-secondary hover:bg-muted/50 rounded-md"
              >
                <span className="inline-flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Price history
                </span>
                {showHistory ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              {showHistory && (
                <div className="border-t border-border px-3 py-2">
                  {historyQuery.isLoading ? (
                    <p className="text-[12px] text-text-muted">Loading…</p>
                  ) : !historyQuery.data || historyQuery.data.length === 0 ? (
                    <p className="text-[12px] text-text-muted">No price changes recorded yet.</p>
                  ) : (
                    <ul className="space-y-1.5 max-h-44 overflow-y-auto">
                      {historyQuery.data.map((h) => (
                        <li key={h.id} className="text-[12px] text-text-secondary flex items-baseline gap-2">
                          <span className="text-text-muted tabular-nums">
                            {new Date(h.changedAt).toLocaleDateString()}
                          </span>
                          <span className="truncate">
                            {formatRupees(h.oldPrice)} → <span className="font-medium text-text-primary">{formatRupees(h.newPrice)}</span>
                          </span>
                          <span className="text-text-muted ml-auto truncate">{h.changedByName ?? "—"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {needsApproval && (
            <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 space-y-2">
              <p className="text-[12px] text-amber-800">
                <span className="font-medium">Approval required.</span> Price or quantity change exceeds the auto-approve threshold (price change of any amount, or qty &gt;10% / &gt;50 units). This update will be sent to a super-admin for review.
              </p>
              <div>
                <Label>Reason <span className="text-destructive">*</span></Label>
                <Textarea
                  rows={3}
                  placeholder="Why is this change needed?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1" disabled={submitting || (needsApproval && !reason.trim())}>
              {needsApproval ? "Submit for approval" : (item ? "Update" : "Add")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteRequestDialog({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item: MedicineRow | null;
}) {
  const utils = trpc.useUtils();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const requestApproval = trpc.approvals.request.useMutation({
    onSuccess: () => {
      toast.success("Deletion request submitted for super-admin approval");
      utils.medicines.list.invalidate();
      utils.approvals.listMyRequests.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!item) return;
    if (!reason.trim()) {
      toast.error("A reason is required");
      return;
    }
    requestApproval.mutate({
      requestType: "delete",
      entityType: "medicine",
      entityId: item.id,
      reason: reason.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request deletion</DialogTitle>
        </DialogHeader>
        {item && (
          <div className="space-y-3 pt-2">
            <p className="text-[13px] text-text-secondary">
              Deleting <span className="font-medium text-text-primary">{item.name}</span> requires super-admin approval. Provide a reason for the request.
            </p>
            <div>
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Textarea
                rows={3}
                placeholder="Why should this medicine be removed?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button variant="outline" onClick={onClose} disabled={requestApproval.isPending}>Cancel</Button>
              <Button
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleSubmit}
                disabled={requestApproval.isPending || !reason.trim()}
              >
                {requestApproval.isPending ? "Submitting…" : "Submit request"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Medicines() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<MedicineRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MedicineRow | null>(null);
  const [page, setPage] = useState(() => readPageParam());
  const isFirstFilterChange = useRef(true);

  useEffect(() => {
    const onPop = () => setPage(readPageParam());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setActivePage = (newPage: number) => {
    setPage(newPage);
    navigate(newPage === 1 ? "/medicines" : `/medicines?page=${newPage}`);
  };

  useEffect(() => {
    if (isFirstFilterChange.current) {
      isFirstFilterChange.current = false;
      return;
    }
    setActivePage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data, isLoading } = trpc.medicines.list.useQuery({ search, page });
  const meds = data?.rows;
  const total = data?.total ?? 0;
  const utils = trpc.useUtils();

  const deleteMed = trpc.medicines.delete.useMutation({
    onSuccess: () => { toast.success("Medicine deleted"); utils.medicines.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const role = user?.role ?? "receptionist";
  const canEdit = role === "admin" || role === "super_admin";
  const isAdmin = role === "admin";
  const isSuperAdmin = role === "super_admin";

  const onDeleteClick = (med: MedicineRow) => {
    if (isSuperAdmin) {
      if (confirm(`Delete "${med.name}"?`)) deleteMed.mutate({ id: med.id });
      return;
    }
    if (isAdmin) setDeleteTarget(med);
  };

  const [exporting, setExporting] = useState(false);
  const onExport = async () => {
    setExporting(true);
    try {
      const rows = await utils.medicines.export.fetch({ search });
      if (rows.length === 0) {
        toast.message("Nothing to export");
        return;
      }
      const columns: CsvColumn<typeof rows[number]>[] = [
        { header: "Name", value: (r) => r.name },
        { header: "Category", value: (r) => r.category ?? "" },
        { header: "Form", value: (r) => r.form ?? "" },
        { header: "Unit", value: (r) => r.unit ?? "" },
        { header: "Default Dosage", value: (r) => r.defaultDosage ?? "" },
        { header: "Duration (days)", value: (r) => r.durationDays ?? "" },
        { header: "Quantity", value: (r) => r.quantity ?? 0 },
        { header: "Unit Price", value: (r) => r.price ?? "" },
        { header: "Notes", value: (r) => r.notes ?? "" },
      ];
      downloadCsv(csvFilename("medicines"), toCsv(rows, columns));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Medicines"
          description={`${total} medicines in reference list`}
          action={
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={onExport} disabled={exporting || isLoading}>
                <Download className="h-4 w-4" />
                {exporting ? "Exporting…" : "Export CSV"}
              </Button>
              {canEdit && (
                <Button className="gap-2" onClick={() => { setEditItem(null); setDialogOpen(true); }}>
                  <Plus className="h-4 w-4" />
                  Add Medicine
                </Button>
              )}
            </div>
          }
        />

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search medicines..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Medicine Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Form</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Default Dosage</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Duration</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Qty</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Price</th>
                  {canEdit && <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: canEdit ? 9 : 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : !meds || meds.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 9 : 8} className="px-4 py-12 text-center text-muted-foreground">No medicines found</td>
                  </tr>
                ) : (
                  meds.map((med, idx) => {
                    const pending = med.pendingRequest ?? null;
                    return (
                      <tr key={med.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span>{med.name}</span>
                            {pending && (
                              <Badge
                                className={pending.requestType === "delete"
                                  ? "gap-1 text-[10px] bg-red-50 text-red-700 border border-red-200"
                                  : "gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200"}
                                title={`${pending.requesterName} requested ${pending.requestType}`}
                              >
                                <Clock className="h-3 w-3" />
                                Pending {pending.requestType}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">{med.category}</Badge></td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{med.form}</Badge></td>
                        <td className="px-4 py-3 text-muted-foreground">{med.defaultDosage || "—"}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{med.durationDays ?? "—"} days</td>
                        <td className="px-4 py-3 text-center font-semibold">{med.quantity}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatRupees(med.price)}</td>
                        {canEdit && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => { setEditItem(med); setDialogOpen(true); }}
                                disabled={!!pending}
                                title={pending ? "Locked: pending approval" : "Edit"}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => onDeleteClick(med)}
                                disabled={!!pending}
                                title={pending ? "Locked: pending approval" : "Delete"}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <PaginationBar
          page={page}
          pageSize={PAGINATION_PAGE_SIZE}
          total={total}
          onPageChange={setActivePage}
          resourceName="medicines"
        />
      </div>

      <MedicineDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditItem(null); }}
        item={editItem}
        userRole={role}
      />

      <DeleteRequestDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        item={deleteTarget}
      />
    </AppLayout>
  );
}
