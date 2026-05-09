import AppLayout from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarRange, Download, MapPin, Phone, Plus, Search, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { csvFilename, downloadCsv, toCsv, type CsvColumn } from "@/lib/csv";
import { PaginationBar, PAGINATION_PAGE_SIZE, readPageParam } from "@/components/PaginationBar";

type ChipKey = "all" | "week" | "month" | "year" | "custom";

type PatientRow = {
  id: number;
  patientId: string;
  name: string;
  fatherName: string | null;
  age: number | null;
  gender: "Male" | "Female" | "Other" | null;
  phone: string | null;
  area: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  lastVisitAt: Date | null;
};

function dateRangeFromChip(chip: ChipKey, custom: { from?: Date; to?: Date }) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  if (chip === "all") return { from: undefined, to: undefined };
  if (chip === "week") {
    const monday = new Date(startOfDay);
    monday.setDate(startOfDay.getDate() - ((startOfDay.getDay() + 6) % 7));
    return { from: monday, to: undefined };
  }
  if (chip === "month") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: undefined };
  if (chip === "year") return { from: new Date(now.getFullYear(), 0, 1), to: undefined };
  return { from: custom.from, to: custom.to };
}

const CSV_COLUMNS: CsvColumn<PatientRow>[] = [
  { header: "Patient ID", value: (r) => r.patientId },
  { header: "Name", value: (r) => r.name },
  { header: "Age", value: (r) => r.age ?? "" },
  { header: "Gender", value: (r) => r.gender ?? "" },
  { header: "Phone", value: (r) => r.phone ?? "" },
  { header: "Area", value: (r) => r.area ?? "" },
  { header: "Last Visit", value: (r) => (r.lastVisitAt ? new Date(r.lastVisitAt) : "") },
  { header: "Registered On", value: (r) => new Date(r.createdAt) },
];

export default function Patients() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("all");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [customOpen, setCustomOpen] = useState(false);
  const [page, setPage] = useState(() => readPageParam());
  const isFirstFilterChange = useRef(true);

  // Browser back/forward navigation — re-read page param
  useEffect(() => {
    const onPop = () => setPage(readPageParam());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setActivePage = (newPage: number) => {
    setPage(newPage);
    navigate(newPage === 1 ? "/patients" : `/patients?page=${newPage}`);
  };

  // Reset page to 1 whenever search/filter changes (skip the first render)
  useEffect(() => {
    if (isFirstFilterChange.current) {
      isFirstFilterChange.current = false;
      return;
    }
    setActivePage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, chip, customRange.from, customRange.to]);

  const range = useMemo(() => dateRangeFromChip(chip, customRange), [chip, customRange]);
  const filterInput = useMemo(
    () => ({
      search: search || undefined,
      dateFrom: range.from ? range.from.toISOString() : undefined,
      dateTo: range.to ? range.to.toISOString() : undefined,
    }),
    [search, range.from, range.to]
  );
  const queryInput = useMemo(() => ({ ...filterInput, page }), [filterInput, page]);

  const { data, isLoading } = trpc.patients.list.useQuery(queryInput);
  const patients = data?.rows;
  const total = data?.total ?? 0;
  const { data: stats } = trpc.patients.stats.useQuery();
  const utils = trpc.useUtils();
  const [exporting, setExporting] = useState(false);

  const onExport = async () => {
    setExporting(true);
    try {
      const rows = (await utils.patients.export.fetch(filterInput)) as PatientRow[];
      if (rows.length === 0) {
        toast.message("Nothing to export for the current filter");
        return;
      }
      const csv = toCsv(rows, CSV_COLUMNS);
      downloadCsv(csvFilename("patients"), csv);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const customChipLabel = (() => {
    if (customRange.from && customRange.to) {
      return `${format(customRange.from, "dd MMM")} – ${format(customRange.to, "dd MMM")}`;
    }
    if (customRange.from) return `${format(customRange.from, "dd MMM yyyy")} +`;
    return "Custom range";
  })();

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Patients"
          description={total === 0 ? "No patients" : `${total} patient${total === 1 ? "" : "s"}`}
          action={
            <Link href="/patients/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Patient
              </Button>
            </Link>
          }
        />

        {/* Filter chips + search + export */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={chip === "all"} onClick={() => setChip("all")} label="All time" count={stats?.countAllTime} />
          <FilterChip active={chip === "week"} onClick={() => setChip("week")} label="This week" count={stats?.countThisWeek} />
          <FilterChip active={chip === "month"} onClick={() => setChip("month")} label="This month" count={stats?.countThisMonth} />
          <FilterChip active={chip === "year"} onClick={() => setChip("year")} label="This year" count={stats?.countThisYear} />
          <Popover open={customOpen} onOpenChange={setCustomOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={() => setChip("custom")}
                className={chipClasses(chip === "custom")}
              >
                <CalendarRange className="h-3.5 w-3.5" />
                {customChipLabel}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                numberOfMonths={2}
                selected={{ from: customRange.from, to: customRange.to }}
                onSelect={(r) => {
                  setCustomRange({ from: r?.from, to: r?.to });
                  setChip("custom");
                  if (r?.from && r?.to) setCustomOpen(false);
                }}
              />
              {(customRange.from || customRange.to) && (
                <div className="flex justify-end p-2 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={() => { setCustomRange({}); setChip("all"); setCustomOpen(false); }}>
                    Clear
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <div className="relative ml-auto w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" className="gap-2" onClick={onExport} disabled={exporting || isLoading}>
            <Download className="h-4 w-4" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>

        {/* Loading + empty states (shared by mobile + desktop) */}
        {isLoading ? (
          <PatientsSkeleton />
        ) : !patients || patients.length === 0 ? (
          <EmptyState search={search} chipActive={chip !== "all" || !!customRange.from} />
        ) : (
          <>
            {/* Desktop table */}
            <Card className="hidden lg:block p-0 shadow-none">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Patient ID</TableHead>
                    <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Name</TableHead>
                    <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Age</TableHead>
                    <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Gender</TableHead>
                    <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Phone</TableHead>
                    <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Area</TableHead>
                    <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Last Visit</TableHead>
                    <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Registered On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(patients as PatientRow[]).map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/patients/${p.id}`)}
                    >
                      <TableCell className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.patientId}</TableCell>
                      <TableCell className="px-4 py-3 font-medium text-foreground">{p.name}</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">{p.age ?? "—"}</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">{p.gender ?? "—"}</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">{p.phone ?? "—"}</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">{p.area ?? "—"}</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {p.lastVisitAt ? formatDistanceToNow(new Date(p.lastVisitAt), { addSuffix: true }) : "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {format(new Date(p.createdAt), "dd MMM yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Mobile cards */}
            <div className="grid sm:grid-cols-2 gap-4 lg:hidden">
              {(patients as PatientRow[]).map((patient) => (
                <Link key={patient.id} href={`/patients/${patient.id}`} className="block">
                  <Card className="hover:border-border-strong transition-colors cursor-pointer h-full">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="h-10 w-10 rounded-full bg-brand-primary-soft flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-brand-primary">
                            {patient.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{patient.name}</p>
                          <p className="text-xs text-muted-foreground">{patient.patientId}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {patient.gender && (
                            <Badge variant="secondary" className="text-[10px]">{patient.gender}</Badge>
                          )}
                          {patient.age != null && (
                            <Badge variant="outline" className="text-[10px]">{patient.age}y</Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {patient.phone && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                            <span>{patient.phone}</span>
                          </div>
                        )}
                        {patient.area && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                            <span className="truncate">{patient.area}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-border flex justify-between text-[10px] text-muted-foreground">
                        <span>Registered: {format(new Date(patient.createdAt), "dd MMM yyyy")}</span>
                        <span>
                          {patient.lastVisitAt
                            ? `Last visit: ${formatDistanceToNow(new Date(patient.lastVisitAt), { addSuffix: true })}`
                            : "No visits"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            <PaginationBar
              page={page}
              pageSize={PAGINATION_PAGE_SIZE}
              total={total}
              onPageChange={setActivePage}
              resourceName="patients"
            />
          </>
        )}
      </div>
    </AppLayout>
  );
}

function chipClasses(active: boolean) {
  return [
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
    active
      ? "bg-brand-primary text-white border-brand-primary"
      : "bg-card border-border text-text-secondary hover:bg-muted",
  ].join(" ");
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number | undefined;
}) {
  return (
    <button type="button" onClick={onClick} className={chipClasses(active)}>
      {label}
      {count !== undefined && (
        <span className={active ? "opacity-90" : "text-muted-foreground"}>({count})</span>
      )}
    </button>
  );
}

function PatientsSkeleton() {
  return (
    <>
      <Card className="hidden lg:block p-0 shadow-none">
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-8 gap-4 px-4 py-3 animate-pulse">
              {Array.from({ length: 8 }).map((__, j) => (
                <div key={j} className="h-4 bg-muted rounded" />
              ))}
            </div>
          ))}
        </div>
      </Card>
      <div className="grid sm:grid-cols-2 gap-4 lg:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-5">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function EmptyState({ search, chipActive }: { search: string; chipActive: boolean }) {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <User className="h-12 w-12 text-text-muted/40 mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">
          {search
            ? `No patients found for "${search}"`
            : chipActive
            ? "No patients in this date range"
            : "No patients registered yet"}
        </p>
        {!search && !chipActive && (
          <Link href="/patients/new">
            <Button className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Register First Patient
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
