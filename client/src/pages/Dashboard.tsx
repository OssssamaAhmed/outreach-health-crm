import AppLayout from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CloudOff,
  Download,
  FlaskConical,
  Package,
  Stethoscope,
  Tent,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

function useOnlineStatus() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-2 text-text-secondary">
          <Icon className="h-4 w-4" />
          <p className="text-[13px] font-medium">{title}</p>
        </div>
        <p className="font-display text-[24px] font-medium text-text-primary mt-2 leading-none">
          {value}
        </p>
        {sub && <p className="text-[12px] text-text-muted mt-2">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: recentVisits } = trpc.dashboard.recentVisits.useQuery();
  const { data: upcomingCamps } = trpc.dashboard.upcomingCamps.useQuery();
  const { data: lowStock } = trpc.dashboard.lowStockItems.useQuery();
  const online = useOnlineStatus();

  const role = user?.role ?? "receptionist";
  const isAdminOrAbove = role === "admin" || role === "super_admin";

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Dashboard"
          description="Outreach Community Clinic · Outreach Health CRM"
          action={
            <div className="flex gap-2">
              <Link href="/patients/new">
                <Button size="sm" className="gap-2">
                  <Stethoscope className="h-4 w-4" />
                  New Patient
                </Button>
              </Link>
              {isAdminOrAbove && (
                <Link href="/camps/new">
                  <Button size="sm" variant="outline" className="gap-2">
                    <Tent className="h-4 w-4" />
                    New Camp
                  </Button>
                </Link>
              )}
            </div>
          }
        />

        <div className="space-y-6 mt-6">
          {/* Offline notice */}
          {!online && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center gap-3">
              <CloudOff className="h-5 w-5 text-amber-700 flex-shrink-0" />
              <div className="flex-1 min-w-[200px]">
                <p className="text-[13px] font-medium text-amber-900">Network unavailable</p>
                <p className="text-[12px] text-amber-800">
                  Capture patients on the offline template. Import them once you're back online.
                </p>
              </div>
              <div className="flex gap-2">
                <a href="/api/templates/patient-intake.xlsx" download>
                  <Button size="sm" variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Download template
                  </Button>
                </a>
                <Link href="/import-offline">
                  <Button size="sm" className="gap-2">Open Offline Import</Button>
                </Link>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Patients" value={stats?.totalPatients ?? 0} icon={Users} sub="Registered in system" />
            <StatCard title="Total Visits" value={stats?.totalVisits ?? 0} icon={Activity} sub="All time" />
            <StatCard title="Visits Today" value={stats?.visitsToday ?? 0} icon={TrendingUp} sub="Today's OPD" />
            {isAdminOrAbove && (
              <StatCard title="Medical Camps" value={stats?.totalCamps ?? 0} icon={Tent} sub="Total organized" />
            )}
          </div>

          {/* Worth (admin+) */}
          {isAdminOrAbove && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard
                title="Inventory Worth"
                value={`Rs. ${Number(stats?.inventoryWorth ?? 0).toLocaleString()}`}
                icon={Package}
                sub="Total stock value (qty × unit price)"
              />
              <StatCard
                title="Medicines Worth"
                value={`Rs. ${Number(stats?.medicinesWorth ?? 0).toLocaleString()}`}
                icon={FlaskConical}
                sub="Total medicine stock value"
              />
            </div>
          )}

          {/* Main grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Recent Visits */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-display text-[16px] font-medium text-text-primary">
                      Recent Patient Visits
                    </CardTitle>
                    <Link href="/patients">
                      <Button variant="ghost" size="sm" className="text-[12px] text-brand-primary">
                        View all
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {!recentVisits || recentVisits.length === 0 ? (
                    <div className="px-6 py-10 text-center">
                      <Activity className="h-8 w-8 text-text-muted/40 mx-auto mb-3" />
                      <p className="text-[13px] text-text-secondary mb-4">No visits recorded yet</p>
                      <Link href="/patients/new">
                        <Button size="sm" className="gap-2">
                          <Stethoscope className="h-4 w-4" />
                          Register first patient
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {recentVisits.slice(0, 10).map((row) => (
                        <Link
                          key={row.visit.id}
                          href={`/patients/${row.patient.id}`}
                          className="flex items-center gap-4 px-6 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                        >
                          <div className="h-9 w-9 rounded-full bg-brand-primary-soft flex items-center justify-center flex-shrink-0">
                            <span className="text-[13px] font-semibold text-brand-primary">
                              {row.patient.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium text-text-primary truncate">
                              {row.patient.name}
                            </p>
                            <p className="text-[12px] text-text-secondary truncate">
                              {row.visit.complaint || "General visit"} · {row.patient.patientId}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[12px] text-text-muted">
                              {format(new Date(row.visit.visitDate), "dd MMM")}
                            </p>
                            <Badge variant="secondary" className="text-[11px] mt-0.5">
                              Visit #{row.visit.visitNumber}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* Upcoming Camps */}
              {isAdminOrAbove && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-display text-[16px] font-medium text-text-primary">
                        Upcoming Camps
                      </CardTitle>
                      <Link href="/camps">
                        <Button variant="ghost" size="sm" className="text-[12px] text-brand-primary">
                          View all
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {!upcomingCamps || upcomingCamps.length === 0 ? (
                      <p className="text-[13px] text-text-secondary text-center py-4">
                        No upcoming camps
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {upcomingCamps.map((camp) => (
                          <Link
                            key={camp.id}
                            href={`/camps/${camp.id}`}
                            className="block p-3 rounded-md border border-border hover:border-border-strong transition-colors"
                          >
                            <p className="text-[14px] font-medium text-text-primary truncate">
                              {camp.title}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <CalendarDays className="h-3 w-3 text-text-secondary" />
                              <p className="text-[12px] text-text-secondary">
                                {format(new Date(camp.campDate), "dd MMM yyyy")}
                              </p>
                            </div>
                            {camp.location && (
                              <p className="text-[12px] text-text-muted mt-0.5 truncate">
                                {camp.location}
                              </p>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Low Stock */}
              {isAdminOrAbove && lowStock && lowStock.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="font-display text-[16px] font-medium text-danger flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Low Stock
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {lowStock.slice(0, 5).map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-[13px]">
                          <p className="text-text-primary truncate flex-1">{item.name}</p>
                          <Badge variant="destructive" className="text-[11px] ml-2">
                            Qty: {item.quantity}
                          </Badge>
                        </div>
                      ))}
                      {lowStock.length > 5 && (
                        <Link href="/inventory">
                          <Button variant="ghost" size="sm" className="w-full text-[12px] text-danger mt-1">
                            +{lowStock.length - 5} more items
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
