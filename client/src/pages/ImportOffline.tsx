import AppLayout from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type Classification =
  | { tag: "new" }
  | { tag: "duplicate_phone"; existingPatientId: string; existingName: string }
  | { tag: "duplicate_name_age_gender"; existingPatientId: string; existingName: string }
  | { tag: "invalid"; reason: string };

type PreviewRow = {
  rowIndex: number;
  date: string;
  name: string;
  fatherName: string;
  age: string;
  gender: "" | "Male" | "Female" | "Other";
  phone: string;
  area: string;
  complaint: string;
  diagnosis: string;
  medicineGiven: string;
  bottleSize: string;
  dosage: string;
  classification: Classification;
};

type CommitResult = {
  imported: number;
  errors: Array<{ rowIndex: number; message: string }>;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected reader result"));
        return;
      }
      const idx = result.indexOf(",");
      resolve(idx === -1 ? result : result.slice(idx + 1));
    };
    reader.readAsDataURL(file);
  });
}

function classificationBadge(c: Classification) {
  switch (c.tag) {
    case "new":
      return (
        <Badge className="gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">
          <CheckCircle2 className="h-3 w-3" /> new
        </Badge>
      );
    case "duplicate_phone":
      return (
        <Badge className="gap-1 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50">
          <AlertCircle className="h-3 w-3" /> phone match
        </Badge>
      );
    case "duplicate_name_age_gender":
      return (
        <Badge className="gap-1 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50">
          <AlertCircle className="h-3 w-3" /> name match
        </Badge>
      );
    case "invalid":
      return (
        <Badge className="gap-1 bg-red-50 text-red-700 border border-red-200 hover:bg-red-50">
          <XCircle className="h-3 w-3" /> invalid
        </Badge>
      );
  }
}

export default function ImportOffline() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ rows: PreviewRow[]; stats: { total: number; new: number; dupPhone: number; dupNameAgeGender: number; invalid: number } } | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewMut = trpc.imports.preview.useMutation({
    onSuccess: (data) => {
      setPreview(data as { rows: PreviewRow[]; stats: { total: number; new: number; dupPhone: number; dupNameAgeGender: number; invalid: number } });
      setCommitResult(null);
      // Default selection — all "new" rows ticked, yellows + invalids unticked
      const defaults = new Set<number>();
      for (const r of data.rows as PreviewRow[]) {
        if (r.classification.tag === "new") defaults.add(r.rowIndex);
      }
      setTicked(defaults);
    },
    onError: (e) => {
      toast.error(e.message);
      setPreview(null);
      setTicked(new Set());
    },
  });

  const commitMut = trpc.imports.commit.useMutation({
    onSuccess: (data) => {
      setCommitResult(data);
      if (data.imported > 0) toast.success(`Imported ${data.imported} patient${data.imported === 1 ? "" : "s"}`);
      if (data.errors.length > 0) toast.error(`${data.errors.length} row${data.errors.length === 1 ? "" : "s"} failed`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFile = async (f: File) => {
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".csv")) {
      toast.error("Use a .xlsx or .csv file");
      return;
    }
    setFile(f);
    setPreview(null);
    setCommitResult(null);
    try {
      const base64 = await fileToBase64(f);
      previewMut.mutate({ filename: f.name, base64 });
    } catch {
      toast.error("Could not read the file");
    }
  };

  const tickedCount = ticked.size;
  const yellowTickedCount = useMemo(() => {
    if (!preview) return 0;
    return preview.rows.filter((r) =>
      ticked.has(r.rowIndex) &&
      (r.classification.tag === "duplicate_phone" || r.classification.tag === "duplicate_name_age_gender")
    ).length;
  }, [preview, ticked]);

  const onTickAllGreens = () => {
    if (!preview) return;
    const next = new Set(ticked);
    for (const r of preview.rows) if (r.classification.tag === "new") next.add(r.rowIndex);
    setTicked(next);
  };
  const onTickAllYellows = () => {
    if (!preview) return;
    const next = new Set(ticked);
    for (const r of preview.rows) {
      if (r.classification.tag === "duplicate_phone" || r.classification.tag === "duplicate_name_age_gender") {
        next.add(r.rowIndex);
      }
    }
    setTicked(next);
  };
  const onUntickAll = () => setTicked(new Set());

  const onImport = () => {
    if (!preview || tickedCount === 0) return;
    const rowsToImport = preview.rows
      .filter((r) => ticked.has(r.rowIndex) && r.classification.tag !== "invalid")
      .map((r) => ({
        rowIndex: r.rowIndex,
        date: r.date,
        name: r.name,
        fatherName: r.fatherName,
        age: r.age,
        gender: r.gender,
        phone: r.phone,
        area: r.area,
        complaint: r.complaint,
        diagnosis: r.diagnosis,
        medicineGiven: r.medicineGiven,
        bottleSize: r.bottleSize,
        dosage: r.dosage,
      }));
    if (rowsToImport.length === 0) return;
    commitMut.mutate({ rows: rowsToImport });
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setTicked(new Set());
    setCommitResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="Offline Import"
          description="Upload a filled-in template after a power outage"
          action={
            <a href="/api/templates/patient-intake.xlsx" download>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download template
              </Button>
            </a>
          }
        />

        {/* Upload zone */}
        {!preview && !commitResult && (
          <Card>
            <CardContent className="p-6">
              <label
                htmlFor="offline-upload"
                onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
                className={[
                  "flex flex-col items-center justify-center text-center cursor-pointer border-2 border-dashed rounded-lg py-12 px-6 transition-colors",
                  dragOver ? "border-brand-primary bg-brand-primary-soft/40" : "border-border hover:bg-muted/30",
                ].join(" ")}
              >
                <UploadCloud className="h-10 w-10 text-text-muted mb-3" />
                <p className="text-[14px] font-medium text-text-primary">
                  Drag and drop a file, or click to browse
                </p>
                <p className="text-[12px] text-text-muted mt-1">
                  .xlsx or .csv — Daily Entry format
                </p>
                <input
                  id="offline-upload"
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </label>
              {previewMut.isPending && (
                <p className="text-center text-[13px] text-text-secondary mt-4">
                  Reading {file?.name}…
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Final result */}
        {commitResult && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 mt-0.5" />
                <div className="flex-1">
                  <h2 className="font-display text-[18px] font-medium text-text-primary">Import complete</h2>
                  <p className="text-[13px] text-text-secondary mt-1">
                    {commitResult.imported} imported · {commitResult.errors.length} failed
                  </p>
                </div>
              </div>
              {commitResult.errors.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <p className="text-[12px] font-semibold text-red-700 mb-1">Errors</p>
                  <ul className="text-[12px] text-red-700 space-y-0.5">
                    {commitResult.errors.slice(0, 20).map((e) => (
                      <li key={e.rowIndex}>Row {e.rowIndex}: {e.message}</li>
                    ))}
                    {commitResult.errors.length > 20 && (
                      <li className="text-red-600">… and {commitResult.errors.length - 20} more</li>
                    )}
                  </ul>
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="outline" onClick={reset}>Import another file</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview */}
        {preview && !commitResult && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap text-[13px]">
                <FileSpreadsheet className="h-4 w-4 text-text-secondary" />
                <span className="font-medium text-text-primary">{file?.name}</span>
                <span className="text-text-muted">·</span>
                <span className="text-text-secondary">{preview.stats.total} rows</span>
                <span className="text-emerald-700">· {preview.stats.new} new</span>
                {(preview.stats.dupPhone + preview.stats.dupNameAgeGender) > 0 && (
                  <span className="text-amber-700">
                    · {preview.stats.dupPhone + preview.stats.dupNameAgeGender} possible duplicate{preview.stats.dupPhone + preview.stats.dupNameAgeGender === 1 ? "" : "s"}
                  </span>
                )}
                {preview.stats.invalid > 0 && (
                  <span className="text-red-700">· {preview.stats.invalid} invalid</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onTickAllGreens}>Tick all greens</Button>
                <Button variant="ghost" size="sm" onClick={onTickAllYellows}>Tick all yellows</Button>
                <Button variant="ghost" size="sm" onClick={onUntickAll}>Untick all</Button>
                <Button variant="outline" size="sm" onClick={reset}>Cancel</Button>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 flex items-start gap-2">
              <Info className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
              <p className="text-[12px] text-text-secondary">
                Imported records will be attributed to you as the importer.
                Yellow rows are possible duplicates — only tick them if you've checked them.
              </p>
            </div>

            {yellowTickedCount > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
                You have {yellowTickedCount} possible-duplicate row{yellowTickedCount === 1 ? "" : "s"} ticked. Importing will create new records anyway.
              </div>
            )}

            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-3 py-3 w-10"></th>
                      <th className="text-left px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground">Status</th>
                      <th className="text-left px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground">Row</th>
                      <th className="text-left px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground">Name</th>
                      <th className="text-left px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground">Age / Gender</th>
                      <th className="text-left px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground">Phone</th>
                      <th className="text-left px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground">Date</th>
                      <th className="text-left px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground">Complaint</th>
                      <th className="text-left px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground">Match / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.rows.map((r) => {
                      const invalid = r.classification.tag === "invalid";
                      const isTicked = ticked.has(r.rowIndex);
                      return (
                        <tr
                          key={r.rowIndex}
                          className={[
                            "transition-colors",
                            invalid ? "bg-red-50/30 hover:bg-red-50/40" : "hover:bg-muted/30",
                          ].join(" ")}
                        >
                          <td className="px-3 py-2.5 align-top">
                            <Checkbox
                              checked={isTicked}
                              disabled={invalid}
                              onCheckedChange={(v) => {
                                const next = new Set(ticked);
                                if (v) next.add(r.rowIndex);
                                else next.delete(r.rowIndex);
                                setTicked(next);
                              }}
                            />
                          </td>
                          <td className="px-3 py-2.5 align-top">{classificationBadge(r.classification)}</td>
                          <td className="px-3 py-2.5 align-top text-muted-foreground text-xs">{r.rowIndex}</td>
                          <td className="px-3 py-2.5 align-top">
                            <p className="font-medium text-foreground">{r.name || "—"}</p>
                            {r.fatherName && (
                              <p className="text-[11px] text-muted-foreground">S/O or D/O: {r.fatherName}</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-top text-muted-foreground text-xs">
                            {r.age || "—"} {r.gender ? `· ${r.gender}` : ""}
                          </td>
                          <td className="px-3 py-2.5 align-top text-muted-foreground text-xs">{r.phone || "—"}</td>
                          <td className="px-3 py-2.5 align-top text-muted-foreground text-xs">{r.date || "—"}</td>
                          <td className="px-3 py-2.5 align-top text-muted-foreground text-xs">{r.complaint || "—"}</td>
                          <td className="px-3 py-2.5 align-top text-xs">
                            {r.classification.tag === "duplicate_phone" && (
                              <p className="text-amber-700">
                                ↔ {r.classification.existingPatientId} · {r.classification.existingName}
                              </p>
                            )}
                            {r.classification.tag === "duplicate_name_age_gender" && (
                              <p className="text-amber-700">
                                ↔ {r.classification.existingPatientId} · {r.classification.existingName}
                              </p>
                            )}
                            {r.classification.tag === "invalid" && (
                              <p className="text-red-700">{r.classification.reason}</p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="flex justify-end gap-3 pt-2 border-t border-border-strong pt-4">
              <Button variant="outline" onClick={reset}>Cancel</Button>
              <Button onClick={onImport} disabled={tickedCount === 0 || commitMut.isPending}>
                {commitMut.isPending ? "Importing…" : `Import ${tickedCount} ticked row${tickedCount === 1 ? "" : "s"}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
