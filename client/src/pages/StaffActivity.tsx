import AppLayout from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CalendarRange, Download, Shield } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { csvFilename, downloadCsv, toCsv, type CsvColumn } from "@/lib/csv";
import { PaginationBar, PAGINATION_PAGE_SIZE, readPageParam } from "@/components/PaginationBar";

type ChipKey = "today" | "week" | "month" | "custom";
type TabKey = "receptionist" | "admin";

type SessionRow = {
  id: number;
  userId: number;
  loginAt: Date | string;
  logoutAt: Date | string | null;
  durationMinutes: number | null;
  autoClosed: boolean;
  userFullName: string | null;
  userGoogleName: string | null;
  userEmail: string | null;
  userRole: string;
  patientsAdded: number;
  visitsAdded: number;
  inventoryUpdates: number;
  medicineUpdates: number;
  campsCreated: number;
  patientsDeleted: number;
  totalActions: number;
};

type SummaryRow = {
  userId: number;
  userFullName: string | null;
  userGoogleName: string | null;
  userEmail: string | null;
  userRole: string;
  sessionCount: number;
  totalMinutes: number;
  patientsAdded: number;
  visitsAdded: number;
  inventoryUpdates: number;
  medicineUpdates: number;
  campsCreated: number;
  patientsDeleted: number;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfToday() {
  const x = startOfDay(new Date());
  x.setDate(x.getDate() + 1);
  return x;
}
function startOfThisWeek() {
  const x = startOfDay(new Date());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function startOfThisMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function chipClasses(active: boolean) {
  return [
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
    active
      ? "bg-brand-primary text-white border-brand-primary"
      : "bg-card border-border text-text-secondary hover:bg-muted",
  ].join(" ");
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={chipClasses(active)}>
      {label}
    </button>
  );
}

function displayName(s: { userFullName: string | null; userGoogleName: string | null; userEmail: string | null }) {
  return s.userFullName ?? s.userGoogleName ?? s.userEmail ?? "Unknown";
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
}

export default function StaffActivity() {
  const { user: currentUser } = useAuth();
  const [, navigate] = useLocation();

  const role = currentUser?.role ?? "receptionist";
  const isAdminOrAbove = role === "admin" || role === "super_admin";

  const [chip, setChip] = useState<ChipKey>("week");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [customOpen, setCustomOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("receptionist");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [page, setPage] = useState(() => readPageParam());
  const isFirstFilterChange = useRef(true);

  useEffect(() => {
    const onPop = () => setPage(readPageParam());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setActivePage = (newPage: number) => {
    setPage(newPage);
    navigate(newPage === 1 ? "/staff-activity" : `/staff-activity?page=${newPage}`);
  };

  // Reset to page 1 when any filter or tab changes
  useEffect(() => {
    if (isFirstFilterChange.current) {
      isFirstFilterChange.current = false;
      return;
    }
    setActivePage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chip, customRange.from, customRange.to, userFilter, tab]);

  const range = useMemo(() => {
    if (chip === "today") return { from: startOfDay(new Date()), to: endOfToday() };
    if (chip === "week") return { from: startOfThisWeek(), to: endOfToday() };
    if (chip === "month") return { from: startOfThisMonth(), to: endOfToday() };
    if (customRange.from && customRange.to) {
      const to = new Date(customRange.to);
      to.setDate(to.getDate() + 1); // make `to` exclusive end
      return { from: customRange.from, to };
    }
    return { from: customRange.from ?? startOfThisWeek(), to: endOfToday() };
  }, [chip, customRange]);

  const filterInput = useMemo(() => ({
    userId: userFilter === "all" ? undefined : Number(userFilter),
    dateFrom: range.from.toISOString(),
    dateTo: range.to.toISOString(),
    roleGroup: tab,
  }), [userFilter, range.from, range.to, tab]);
  const queryInput = useMemo(() => ({ ...filterInput, page }), [filterInput, page]);

  // Filtered list (the table) — server now paginates per role group
  const { data: sessionsData, isLoading } = trpc.sessions.list.useQuery(queryInput, { enabled: isAdminOrAbove });
  const sessions = sessionsData?.rows;
  const total = sessionsData?.total ?? 0;
  const utils = trpc.useUtils();

  // Filtered summary — used to populate the staff dropdown
  const { data: summary } = trpc.sessions.summary.useQuery(
    { dateFrom: range.from.toISOString(), dateTo: range.to.toISOString() },
    { enabled: isAdminOrAbove }
  );

  // Fixed-window top stats
  const { data: activeCount } = trpc.sessions.activeCount.useQuery(undefined, { enabled: isAdminOrAbove });
  const { data: todaySummary } = trpc.sessions.summary.useQuery(
    { dateFrom: startOfDay(new Date()).toISOString(), dateTo: endOfToday().toISOString() },
    { enabled: isAdminOrAbove }
  );
  const { data: weekSummary } = trpc.sessions.summary.useQuery(
    { dateFrom: startOfThisWeek().toISOString(), dateTo: endOfToday().toISOString() },
    { enabled: isAdminOrAbove }
  );

  // Tab-filtered rows — server already returns only the right role group via roleGroup input
  const tabRows: SessionRow[] = (sessions ?? []) as SessionRow[];

  // Staff dropdown options — derived from the summary so we list everyone, not just active sessions
  const staffOptions = useMemo(() => {
    if (!summary) return [] as { id: number; label: string; role: string }[];
    return (summary as SummaryRow[])
      .map((s) => ({ id: s.userId, label: displayName(s), role: s.userRole }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [summary]);

  // Top stats
  const patientsAddedToday = useMemo(() => {
    if (!todaySummary) return 0;
    return (todaySummary as SummaryRow[]).reduce((acc, r) => acc + r.patientsAdded, 0);
  }, [todaySummary]);

  const topPerformer = useMemo(() => {
    if (!weekSummary) return null;
    const sorted = [...(weekSummary as SummaryRow[])].sort((a, b) => b.patientsAdded - a.patientsAdded);
    const top = sorted[0];
    if (!top || top.patientsAdded === 0) return null;
    return { name: displayName(top), count: top.patientsAdded };
  }, [weekSummary]);

  if (currentUser && !isAdminOrAbove) {
    return (
      <AppLayout>
        <div className="p-6 text-center py-20">
          <Shield className="h-12 w-12 text-text-muted/40 mx-auto mb-4" />
          <p className="text-text-primary font-medium">Access Restricted</p>
          <p className="text-[13px] text-text-secondary mt-1">Staff Activity is for admins and super admins only.</p>
          <Button variant="ghost" onClick={() => navigate("/")} className="mt-4">Go to Dashboard</Button>
        </div>
      </AppLayout>
    );
  }

  // CSV export — fetches ALL rows in the current filter window (not just the visible page),
  // restricted to the current tab's role group server-side.
  const [exporting, setExporting] = useState(false);
  const onExport = async () => {
    setExporting(true);
    try {
      const result = await utils.sessions.list.fetch({ ...filterInput, all: true, page: 1 });
      const rows = (result?.rows ?? []) as SessionRow[];
      if (rows.length === 0) {
        toast.message("Nothing to export for this filter");
        return;
      }
      const sharedCols: CsvColumn<SessionRow>[] = [
        { header: "Name",     value: (r) => displayName(r) },
        { header: "Email",    value: (r) => r.userEmail ?? "" },
        { header: "Login",    value: (r) => new Date(r.loginAt) },
        { header: "Logout",   value: (r) => r.logoutAt ? new Date(r.logoutAt) : "" },
        { header: "Duration (min)", value: (r) => r.durationMinutes ?? "" },
        { header: "Auto-closed",    value: (r) => r.autoClosed ? "yes" : "no" },
      ];
      const recCols: CsvColumn<SessionRow>[] = [
        ...sharedCols,
        { header: "Patients added", value: (r) => r.patientsAdded },
        { header: "Visits logged",  value: (r) => r.visitsAdded },
      ];
      const adminCols: CsvColumn<SessionRow>[] = [
        ...sharedCols,
        { header: "Inventory updates", value: (r) => r.inventoryUpdates },
        { header: "Medicine updates",  value: (r) => r.medicineUpdates },
        { header: "Camps created",     value: (r) => r.campsCreated },
        { header: "Patients deleted",  value: (r) => r.patientsDeleted },
        { header: "Other actions",     value: (r) =>
            Math.max(0, r.totalActions - r.inventoryUpdates - r.medicineUpdates - r.campsCreated - r.patientsDeleted) },
      ];
      const cols = tab === "receptionist" ? recCols : adminCols;
      downloadCsv(csvFilename(`staff_activity_${tab}`), toCsv(rows, cols));
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
          title="Staff Activity"
          description="Track who logged in, when, and what they did"
          action={
            <Button variant="outline" className="gap-2" onClick={onExport} disabled={exporting || !tabRows.length}>
              <Download className="h-4 w-4" />
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          }
        />

        {/* Top stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard title="Active now" value={activeCount ?? 0} hint="open sessions" />
          <StatCard title="Patients added today" value={patientsAddedToday} hint={format(new Date(), "dd MMM")} />
          <StatCard
            title="Top performer this week"
            value={topPerformer ? topPerformer.name : "—"}
            hint={topPerformer ? `${topPerformer.count} patients` : "no activity yet"}
          />
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={chip === "today"} onClick={() => setChip("today")} label="Today" />
          <FilterChip active={chip === "week"}  onClick={() => setChip("week")}  label="This week" />
          <FilterChip active={chip === "month"} onClick={() => setChip("month")} label="This month" />
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
                  <Button variant="ghost" size="sm" onClick={() => { setCustomRange({}); setChip("week"); setCustomOpen(false); }}>
                    Clear
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <div className="ml-auto w-full sm:w-64">
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {staffOptions.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs + table */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="receptionist">Receptionists</TabsTrigger>
            <TabsTrigger value="admin">Admins</TabsTrigger>
          </TabsList>

          <TabsContent value="receptionist" className="mt-4">
            <SessionsTable rows={tabRows} columns="receptionist" loading={isLoading} />
          </TabsContent>
          <TabsContent value="admin" className="mt-4">
            <SessionsTable rows={tabRows} columns="admin" loading={isLoading} />
          </TabsContent>
        </Tabs>

        <PaginationBar
          page={page}
          pageSize={PAGINATION_PAGE_SIZE}
          total={total}
          onPageChange={setActivePage}
          resourceName="sessions"
        />
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value, hint }: { title: string; value: string | number; hint: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-[12px] text-text-secondary uppercase tracking-wide">{title}</p>
        <p className="font-display text-[22px] font-medium text-text-primary mt-1 leading-tight truncate">
          {value}
        </p>
        <p className="text-[11px] text-text-muted mt-0.5">{hint}</p>
      </CardContent>
    </Card>
  );
}

function SessionsTable({
  rows,
  columns,
  loading,
}: {
  rows: SessionRow[];
  columns: "receptionist" | "admin";
  loading: boolean;
}) {
  const adminCols = columns === "admin";

  if (loading) {
    return (
      <Card className="p-0">
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3 animate-pulse">
              {Array.from({ length: adminCols ? 9 : 6 }).map((__, j) => (
                <div key={j} className="h-4 bg-muted rounded flex-1" />
              ))}
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No sessions in this date range</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Login</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Logout</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Duration</th>
              {adminCols ? (
                <>
                  <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Inventory</th>
                  <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Medicine</th>
                  <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Camps</th>
                  <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Patients deleted</th>
                  <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Other actions</th>
                </>
              ) : (
                <>
                  <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Patients added</th>
                  <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Visits logged</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const isOpen = r.logoutAt == null;
              const otherActions = Math.max(0, r.totalActions - r.inventoryUpdates - r.medicineUpdates - r.campsCreated - r.patientsDeleted);
              return (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isOpen && <span className="h-2 w-2 rounded-full bg-emerald-500" title="Active session" />}
                      <span className="font-medium text-foreground">{displayName(r)}</span>
                    </div>
                    {r.userEmail && (
                      <p className="text-[11px] text-muted-foreground">{r.userEmail}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {format(new Date(r.loginAt), "dd MMM HH:mm")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {r.logoutAt ? (
                      <span className="inline-flex items-center gap-1.5">
                        {format(new Date(r.logoutAt), "dd MMM HH:mm")}
                        {r.autoClosed && <Badge variant="outline" className="text-[10px] py-0">auto</Badge>}
                      </span>
                    ) : (
                      <span className="text-emerald-700">active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDuration(r.durationMinutes)}</td>
                  {adminCols ? (
                    <>
                      <td className="px-4 py-3 text-right">{r.inventoryUpdates}</td>
                      <td className="px-4 py-3 text-right">{r.medicineUpdates}</td>
                      <td className="px-4 py-3 text-right">{r.campsCreated}</td>
                      <td className="px-4 py-3 text-right">{r.patientsDeleted}</td>
                      <td className="px-4 py-3 text-right">{otherActions}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-right">{r.patientsAdded}</td>
                      <td className="px-4 py-3 text-right">{r.visitsAdded}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
