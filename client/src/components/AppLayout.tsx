import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";
import {
  Activity,
  ClipboardCheck,
  ClipboardList,
  CloudUpload,
  FlaskConical,
  Home,
  LogOut,
  Menu,
  Package,
  Stethoscope,
  Tent,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { NotificationBell } from "./NotificationBell";

const LOGO_URL = "/logo.png";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: Home, roles: ["receptionist", "admin", "super_admin"] },
  { label: "Patients", href: "/patients", icon: Stethoscope, roles: ["receptionist", "admin", "super_admin"] },
  { label: "Medical Camps", href: "/camps", icon: Tent, roles: ["admin", "super_admin"] },
  { label: "Inventory", href: "/inventory", icon: Package, roles: ["admin", "super_admin"] },
  { label: "Medicines", href: "/medicines", icon: FlaskConical, roles: ["admin", "super_admin"] },
  { label: "Offline Import", href: "/import-offline", icon: CloudUpload, roles: ["receptionist", "admin", "super_admin"] },
  { label: "Staff Activity", href: "/staff-activity", icon: Activity, roles: ["admin", "super_admin"] },
  { label: "My Requests", href: "/my-requests", icon: ClipboardList, roles: ["admin", "super_admin"] },
  { label: "Pending Approvals", href: "/pending-approvals", icon: ClipboardCheck, roles: ["super_admin"] },
  { label: "User Management", href: "/users", icon: Users, roles: ["super_admin"] },
];

function roleBadge(role: string) {
  if (role === "super_admin") {
    return { label: "Super Admin", className: "bg-brand-primary-hover text-white" };
  }
  const labels: Record<string, string> = {
    admin: "Admin",
    receptionist: "Receptionist",
    user: "User",
  };
  return { label: labels[role] ?? role, className: "bg-gray-100 text-gray-600" };
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/logged-out"; },
    onError: () => toast.error("Logout failed"),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img src={LOGO_URL} alt="Outreach Health" className="h-12 w-12 object-contain animate-pulse" />
          <p className="text-text-secondary text-[13px]">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const userRole = user?.role ?? "receptionist";
  const visibleNav = navItems.filter(item => item.roles.includes(userRole));
  const badge = roleBadge(userRole);
  const userName = user?.name ?? "User";
  const userEmail = user?.email ?? "";
  const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-border",
        mobile ? "w-full" : "w-60",
      )}
    >
      {/* Logo block — compact, branded */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <img
          src={LOGO_URL}
          alt="Outreach Health"
          className="h-10 w-10 object-contain flex-shrink-0"
        />
        <div className="min-w-0">
          <p className="font-display text-[14px] font-medium text-text-primary leading-tight truncate">
            Outreach Health
          </p>
          <p className="text-[12px] text-text-secondary leading-tight mt-0.5">CRM</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {visibleNav.map(item => {
          const Icon = item.icon;
          const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => mobile && setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 py-2 pl-4 pr-3 text-[14px] transition-colors border-l-2",
                isActive
                  ? "border-l-brand-primary text-brand-primary font-medium"
                  : "border-l-transparent text-text-secondary hover:bg-gray-50 hover:text-text-primary",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="h-9 w-9 rounded-full bg-brand-primary-soft flex items-center justify-center flex-shrink-0">
            <span className="text-[12px] font-semibold text-brand-primary">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-text-primary truncate">{userName}</p>
            {userEmail && (
              <p className="text-[12px] text-text-muted truncate">{userEmail}</p>
            )}
            <span className={cn("inline-block mt-1 text-[11px] px-1.5 py-0.5 rounded font-medium", badge.className)}>
              {badge.label}
            </span>
          </div>
          <NotificationBell />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-text-secondary hover:text-text-primary flex-shrink-0"
            onClick={() => logout.mutate(undefined)}
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col flex-shrink-0 h-full" style={{ width: 240 }}>
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-sidebar">
            <div className="absolute top-3 right-3 z-10">
              <Button size="icon" variant="ghost" onClick={() => setSidebarOpen(false)} className="text-text-secondary">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile only) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
          <Button size="icon" variant="ghost" onClick={() => setSidebarOpen(true)} className="text-text-secondary">
            <Menu className="h-5 w-5" />
          </Button>
          <img src={LOGO_URL} alt="Outreach Health" className="h-7 w-7 object-contain" />
          <span className="font-display text-[14px] font-medium text-text-primary">Hospital CRM</span>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
