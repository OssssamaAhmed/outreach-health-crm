import AppLayout from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Power, PowerOff, Shield, Trash2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { IS_DEMO_MODE } from "@/lib/demoMode";

function roleBadgeClasses(role: string) {
  if (role === "super_admin") return "bg-brand-primary-hover text-white";
  return "bg-gray-100 text-gray-600";
}

type UserRow = {
  id: number;
  name: string | null;
  email: string | null;
  fullName: string | null;
  nicNumber: string | null;
  phoneNumber: string | null;
};

function UserProfileDrawer({
  user,
  open,
  onClose,
}: {
  user: UserRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ fullName: "", nicNumber: "", phoneNumber: "" });
  const [nicError, setNicError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName ?? "",
        nicNumber: user.nicNumber ?? "",
        phoneNumber: user.phoneNumber ?? "",
      });
      setNicError(null);
    }
  }, [user]);

  const updateProfile = trpc.users.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated");
      utils.users.list.invalidate();
      onClose();
    },
    onError: (e) => {
      if (e.data?.code === "CONFLICT") {
        setNicError(e.message);
      } else {
        toast.error(e.message);
      }
    },
  });

  if (!user) return null;

  const onSave = () => {
    setNicError(null);
    updateProfile.mutate({
      userId: user.id,
      fullName: form.fullName,
      nicNumber: form.nicNumber,
      phoneNumber: form.phoneNumber,
    });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Edit User</SheetTitle>
          <SheetDescription>
            {user.name ?? "Unknown"}{user.email ? ` · ${user.email}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 space-y-4 flex-1 overflow-y-auto">
          <div>
            <Label>Full name</Label>
            <Input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="Full legal name"
            />
          </div>
          <div>
            <Label>NIC number</Label>
            <Input
              value={form.nicNumber}
              onChange={(e) => { setForm({ ...form, nicNumber: e.target.value }); setNicError(null); }}
              placeholder="e.g. 42101-1234567-8"
              aria-invalid={nicError ? true : undefined}
              className={nicError ? "border-destructive focus-visible:ring-destructive/40" : undefined}
            />
            {nicError && <p className="mt-1 text-[12px] text-destructive">{nicError}</p>}
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={form.phoneNumber}
              onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              placeholder="e.g. +92 300 1234567"
            />
          </div>

          <p className="text-[12px] text-text-muted pt-2">
            Role is changed from the table dropdown — this drawer manages profile fields only.
          </p>
        </div>

        <div className="border-t border-border p-4 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button className="flex-1" onClick={onSave} disabled={updateProfile.isPending}>
            {updateProfile.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const [, navigate] = useLocation();
  const { data: users, isLoading } = trpc.users.list.useQuery();
  const { data: invites, isLoading: invitesLoading } = trpc.invites.list.useQuery(undefined, {
    enabled: currentUser?.role === "super_admin",
  });
  const utils = trpc.useUtils();

  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: () => { toast.success("Role updated"); utils.users.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const setActive = trpc.users.setActive.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(variables.isActive ? "User reactivated" : "User deactivated");
      utils.users.list.invalidate();
      setStatusTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ id: number; name: string; nextActive: boolean } | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "receptionist">("receptionist");

  const createInvite = trpc.invites.create.useMutation({
    onSuccess: () => {
      toast.success("Invite added to allowlist");
      setInviteEmail("");
      setInviteRole("receptionist");
      utils.invites.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeInvite = trpc.invites.revoke.useMutation({
    onSuccess: () => { toast.success("Invite revoked"); utils.invites.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const onSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    createInvite.mutate({ email: inviteEmail, role: inviteRole });
  };

  if (currentUser?.role !== "super_admin") {
    return (
      <AppLayout>
        <div className="p-6 text-center py-20">
          <Shield className="h-12 w-12 text-text-muted/40 mx-auto mb-4" />
          <p className="text-text-primary font-medium">Access Restricted</p>
          <p className="text-[13px] text-text-secondary mt-1">Only Super Admins can manage users.</p>
          <Button variant="ghost" onClick={() => navigate("/")} className="mt-4">Go to Dashboard</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <PageHeader
          title="Users & Invites"
          description="Pre-authorize new staff and manage existing roles"
        />

        {/* Role Legend */}
        <Card className="bg-muted/40">
          <CardContent className="px-6">
            <p className="text-[12px] font-medium text-text-secondary mb-3 uppercase tracking-wide">Role Permissions</p>
            <div className="grid sm:grid-cols-3 gap-3 text-[13px]">
              <div className="bg-card rounded-md p-3 border border-border">
                <span className="font-medium text-brand-primary-hover">Super Admin</span>
                <p className="text-text-secondary mt-1">Full system access, user management, all records</p>
              </div>
              <div className="bg-card rounded-md p-3 border border-border">
                <span className="font-medium text-text-primary">Admin</span>
                <p className="text-text-secondary mt-1">View and edit all records, camps, inventory — no user management</p>
              </div>
              <div className="bg-card rounded-md p-3 border border-border">
                <span className="font-medium text-text-primary">Receptionist</span>
                <p className="text-text-secondary mt-1">Register patients and view patient records only</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Invites */}
        <section className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-[18px] font-medium text-text-primary">Pending Invites</h2>
            <span className="text-[13px] text-text-secondary">({invites?.length ?? 0})</span>
          </div>

          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Role</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Invited By</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">When</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invitesLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-xs">Loading invites…</td>
                    </tr>
                  ) : !invites || invites.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-xs">No pending invites</td>
                    </tr>
                  ) : (
                    invites.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{inv.email}</td>
                        <td className="px-4 py-3">
                          <span className="text-[12px] px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-600">
                            {inv.assignedRole === "admin" ? "Admin" : "Receptionist"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{inv.invitedByName ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {formatDistanceToNow(new Date(inv.invitedAt), { addSuffix: true })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            disabled={revokeInvite.isPending}
                            onClick={() => {
                              if (confirm(`Revoke invite for ${inv.email}?`)) revokeInvite.mutate({ id: inv.id });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <form onSubmit={onSendInvite} className="border-t border-border p-4 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[220px]">
                <Label className="text-[12px]">Email</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="person@hospital.org"
                  required
                />
              </div>
              <div className="w-44">
                <Label className="text-[12px]">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "receptionist")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receptionist">Receptionist</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={createInvite.isPending} className="gap-2">
                <Mail className="h-4 w-4" />
                Send Invite
              </Button>
            </form>
            <p className="px-4 pb-3 text-[12px] text-text-muted">
              No email is sent. The invite applies automatically on their first Google sign-in.
            </p>
          </Card>
        </section>

        {/* Existing Users */}
        <section className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-[18px] font-medium text-text-primary">Users</h2>
            <span className="text-[13px] text-text-secondary">({users?.length ?? 0})</span>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Current Role</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Last Sign In</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Change Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded" /></td>
                        ))}
                      </tr>
                    ))
                  ) : !users || users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No users found</td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isSelf = u.id === currentUser?.id;
                      const deactivated = u.isActive === false;
                      return (
                        <tr
                          key={u.id}
                          className={`hover:bg-muted/30 transition-colors cursor-pointer ${deactivated ? "opacity-60" : ""}`}
                          onClick={() => setEditingUser({
                            id: u.id,
                            name: u.name ?? null,
                            email: u.email ?? null,
                            fullName: u.fullName ?? null,
                            nicNumber: u.nicNumber ?? null,
                            phoneNumber: u.phoneNumber ?? null,
                          })}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-brand-primary-soft flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-semibold text-brand-primary">
                                  {(u.fullName ?? u.name ?? "U").charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-foreground">{u.fullName ?? u.name ?? "Unknown"}</p>
                                  {deactivated && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-50 text-red-700 border border-red-200">
                                      Deactivated
                                    </span>
                                  )}
                                </div>
                                {u.fullName && u.name && u.fullName !== u.name && (
                                  <p className="text-[11px] text-muted-foreground">Google: {u.name}</p>
                                )}
                                {isSelf && (
                                  <span className="text-[10px] text-muted-foreground">(You)</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{u.email ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[12px] px-2 py-0.5 rounded font-medium ${roleBadgeClasses(u.role)}`}>
                              {u.role === "super_admin" ? "Super Admin" : u.role === "admin" ? "Admin" : u.role === "receptionist" ? "Receptionist" : u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {u.lastSignedIn ? format(new Date(u.lastSignedIn), "dd MMM yyyy, HH:mm") : "—"}
                          </td>
                          <td
                            className="px-4 py-3 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isSelf ? (
                              <span className="text-xs text-muted-foreground italic">Cannot change own role or status</span>
                            ) : IS_DEMO_MODE ? (
                              <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                Demo: read-only
                              </span>
                            ) : (
                              <div className="flex flex-col items-end gap-2">
                                <Select
                                  value={u.role}
                                  onValueChange={(v) => updateRole.mutate({ userId: u.id, role: v as "user" | "admin" | "receptionist" | "super_admin" })}
                                >
                                  <SelectTrigger className="w-36 h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="receptionist">Receptionist</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="super_admin">Super Admin</SelectItem>
                                    <SelectItem value="user">User (no access)</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`h-7 text-xs gap-1.5 ${deactivated ? "" : "text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"}`}
                                  onClick={() => setStatusTarget({
                                    id: u.id,
                                    name: u.fullName ?? u.name ?? "this user",
                                    nextActive: deactivated,
                                  })}
                                >
                                  {deactivated ? (
                                    <>
                                      <Power className="h-3 w-3" />
                                      Reactivate
                                    </>
                                  ) : (
                                    <>
                                      <PowerOff className="h-3 w-3" />
                                      Deactivate
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>

      <UserProfileDrawer
        user={editingUser}
        open={editingUser !== null}
        onClose={() => setEditingUser(null)}
      />

      <Dialog open={statusTarget !== null} onOpenChange={(v) => { if (!v) setStatusTarget(null); }}>
        <DialogContent className="max-w-md">
          {statusTarget && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {statusTarget.nextActive ? "Reactivate" : "Deactivate"} {statusTarget.name}?
                </DialogTitle>
              </DialogHeader>
              <div className="pt-2 space-y-3">
                {statusTarget.nextActive ? (
                  <p className="text-[13px] text-text-secondary">
                    This user will be able to sign in again on their next visit. Their existing role and profile are preserved.
                  </p>
                ) : (
                  <>
                    <p className="text-[13px] text-text-secondary">This will:</p>
                    <ul className="text-[13px] text-text-secondary space-y-1 ml-4">
                      <li className="flex items-start gap-2">
                        <span className="text-text-muted">•</span>
                        <span>Sign them out immediately if they have an open session</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-text-muted">•</span>
                        <span>Block any future sign-in attempt until reactivated</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-text-muted">•</span>
                        <span>Leave their pending requests visible to super admins</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-text-muted">•</span>
                        <span>Leave their activity history intact</span>
                      </li>
                    </ul>
                  </>
                )}
                <div className="flex gap-3 pt-3 border-t border-border">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStatusTarget(null)}
                    disabled={setActive.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    className={`flex-1 ${statusTarget.nextActive ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}`}
                    onClick={() => setActive.mutate({ userId: statusTarget.id, isActive: statusTarget.nextActive })}
                    disabled={setActive.isPending}
                  >
                    {setActive.isPending
                      ? "Saving…"
                      : statusTarget.nextActive ? "Reactivate" : "Deactivate"}
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
