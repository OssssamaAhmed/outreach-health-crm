import AppLayout from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Tent } from "lucide-react";
import { toast } from "sonner";

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[16px] font-medium text-text-primary pb-2 border-b border-border mb-5">
      {children}
    </h2>
  );
}

function NextStepsTip() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide">
        After creation
      </p>
      <ul className="mt-2 space-y-1.5 text-[13px] text-text-primary">
        <li className="flex items-start gap-2">
          <span className="text-brand-primary mt-0.5">•</span>
          <span>Add doctors and their specialties</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-brand-primary mt-0.5">•</span>
          <span>List tests and services offered</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-brand-primary mt-0.5">•</span>
          <span>Build the patient log on camp day</span>
        </li>
      </ul>
    </div>
  );
}

function RequiredFieldsTip() {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide">
        Required fields
      </p>
      <ul className="mt-2 space-y-1 text-[13px] text-text-primary">
        <li className="flex items-start gap-2">
          <span className="text-brand-primary mt-0.5">•</span>
          <span>Camp Title</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-brand-primary mt-0.5">•</span>
          <span>Camp Date</span>
        </li>
      </ul>
    </div>
  );
}

export default function NewCamp() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    title: "",
    campDate: "",
    location: "",
    notes: "",
    totalVolunteers: "",
    totalExpense: "",
    status: "upcoming" as "upcoming" | "completed" | "cancelled",
  });

  const createCamp = trpc.camps.create.useMutation({
    onSuccess: (data) => {
      toast.success("Medical camp created successfully");
      navigate(`/camps/${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Camp title is required"); return; }
    if (!form.campDate) { toast.error("Camp date is required"); return; }
    createCamp.mutate({
      ...form,
      totalVolunteers: form.totalVolunteers ? Number(form.totalVolunteers) : 0,
      totalExpense: form.totalExpense || "0",
    });
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-[1100px] mx-auto space-y-6">
        <PageHeader
          title="Create Medical Camp"
          description="Set up a new camp record. You can add doctors, tests, and patient logs after creation."
          back={
            <Button variant="ghost" size="sm" onClick={() => navigate("/camps")} className="gap-2 -ml-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Camps
            </Button>
          }
        />

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,720px)_300px] gap-8">
            {/* Form column */}
            <div className="space-y-10">
              <section>
                <SectionHeader>Camp Details</SectionHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                  <div className="sm:col-span-2">
                    <Label>Camp Title <span className="text-danger">*</span></Label>
                    <Input
                      placeholder="e.g. Sector G-9 Community Camp — Outreach Health"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      required
                                         />
                  </div>

                  <div>
                    <Label>Camp Date <span className="text-danger">*</span></Label>
                    <Input
                      type="date"
                      value={form.campDate}
                      onChange={(e) => setForm({ ...form, campDate: e.target.value })}
                      required
                                         />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-2">
                    <Label>Location</Label>
                    <Input
                      placeholder="e.g. Shah Faisal Colony No. 1, Karachi"
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                                         />
                  </div>

                  <div>
                    <Label>Number of Volunteers</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={form.totalVolunteers}
                      onChange={(e) => setForm({ ...form, totalVolunteers: e.target.value })}
                                         />
                  </div>
                  <div>
                    <Label>Total Expense (Rs.)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={form.totalExpense}
                      onChange={(e) => setForm({ ...form, totalExpense: e.target.value })}
                                         />
                  </div>

                  <div className="sm:col-span-2">
                    <Label>Notes / Description</Label>
                    <Textarea
                      placeholder="Any additional notes about this camp..."
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={3}
                                         />
                  </div>
                </div>
              </section>
            </div>

            {/* Context panel */}
            <aside className="hidden lg:block">
              <div className="space-y-4 sticky top-6">
                <NextStepsTip />
                <RequiredFieldsTip />
              </div>
            </aside>
          </div>

          {/* Action row */}
          <div className="flex justify-end gap-3 mt-10 pt-6 border-t border-border-strong">
            <Button type="button" variant="outline" onClick={() => navigate("/camps")}>
              Cancel
            </Button>
            <Button type="submit" className="gap-2" disabled={createCamp.isPending}>
              <Tent className="h-4 w-4" />
              {createCamp.isPending ? "Creating..." : "Create Camp"}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
