import AppLayout from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Download, MapPin, Plus, Tent, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { csvFilename, downloadCsv, toCsv, type CsvColumn } from "@/lib/csv";
import { useAuth } from "@/_core/hooks/useAuth";
import { PaginationBar, PAGINATION_PAGE_SIZE, readPageParam } from "@/components/PaginationBar";

const statusColor: Record<string, string> = {
  planned: "bg-blue-50 text-blue-700 border-blue-200",
  ongoing: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

export default function MedicalCamps() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const role = user?.role ?? "receptionist";
  const canEdit = role === "admin" || role === "super_admin";
  const [page, setPage] = useState(() => readPageParam());

  useEffect(() => {
    const onPop = () => setPage(readPageParam());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setActivePage = (newPage: number) => {
    setPage(newPage);
    navigate(newPage === 1 ? "/camps" : `/camps?page=${newPage}`);
  };

  const { data, isLoading } = trpc.camps.list.useQuery({ page });
  const camps = data?.rows;
  const total = data?.total ?? 0;
  const utils = trpc.useUtils();

  const [exporting, setExporting] = useState(false);
  const onExport = async () => {
    setExporting(true);
    try {
      const rows = await utils.camps.export.fetch();
      if (rows.length === 0) {
        toast.message("Nothing to export");
        return;
      }
      const columns: CsvColumn<typeof rows[number]>[] = [
        { header: "Title", value: (r) => r.title },
        { header: "Date", value: (r) => new Date(r.campDate) },
        { header: "Location", value: (r) => r.location ?? "" },
        { header: "Status", value: (r) => r.status ?? "" },
        { header: "Total Patients", value: (r) => r.totalPatients ?? 0 },
        { header: "Total Volunteers", value: (r) => r.totalVolunteers ?? 0 },
        { header: "Total Expense", value: (r) => r.totalExpense ?? "" },
        { header: "Notes", value: (r) => r.notes ?? "" },
      ];
      downloadCsv(csvFilename("camps"), toCsv(rows, columns));
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
          title="Medical Camps"
          description={`${total} camps recorded`}
          action={
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={onExport} disabled={exporting || isLoading}>
                <Download className="h-4 w-4" />
                {exporting ? "Exporting…" : "Export CSV"}
              </Button>
              {canEdit && (
                <Link href="/camps/new">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Camp
                  </Button>
                </Link>
              )}
            </div>
          }
        />

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-5">
                  <div className="h-5 bg-muted rounded w-3/4 mb-3" />
                  <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !camps || camps.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Tent className="h-12 w-12 text-text-muted/40 mx-auto mb-4" />
              <p className="text-text-secondary">No medical camps recorded yet</p>
              {canEdit && (
                <Link href="/camps/new">
                  <Button className="mt-4 gap-2">
                    <Plus className="h-4 w-4" />
                    Create First Camp
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {camps.map((camp) => (
              <Link key={camp.id} href={`/camps/${camp.id}`} className="block">
                  <Card className="hover:border-border-strong transition-colors cursor-pointer h-full">
                    <CardContent className="p-5 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-foreground text-sm leading-snug flex-1">
                          {camp.title}
                        </h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${statusColor[camp.status ?? 'upcoming'] ?? statusColor.upcoming}`}>
                          {(camp.status ?? 'upcoming').charAt(0).toUpperCase() + (camp.status ?? 'upcoming').slice(1)}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5 text-primary" />
                          <span>{format(new Date(camp.campDate), "dd MMMM yyyy")}</span>
                        </div>
                        {camp.location && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            <span className="truncate">{camp.location}</span>
                          </div>
                        )}
                        {camp.totalPatients != null && camp.totalPatients > 0 && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="h-3.5 w-3.5 text-primary" />
                            <span>{camp.totalPatients} beneficiaries</span>
                          </div>
                        )}
                      </div>

                      {camp.totalExpense && Number(camp.totalExpense) > 0 && (
                        <div className="pt-2 border-t border-border">
                          <p className="text-xs text-muted-foreground">
                            Total Expense: <span className="font-semibold text-foreground">Rs. {Number(camp.totalExpense).toLocaleString()}</span>
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
              </Link>
            ))}
          </div>
        )}

        <PaginationBar
          page={page}
          pageSize={PAGINATION_PAGE_SIZE}
          total={total}
          onPageChange={setActivePage}
          resourceName="camps"
        />
      </div>
    </AppLayout>
  );
}
