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
import { ArrowLeft, UserPlus } from "lucide-react";
import { toast } from "sonner";

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[16px] font-medium text-text-primary pb-2 border-b border-border mb-5">
      {children}
    </h2>
  );
}

function PatientIdPreview() {
  const { data, isLoading } = trpc.patients.nextId.useQuery();
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide">
        Patient ID Preview
      </p>
      <p className="font-display text-[24px] font-medium text-brand-primary mt-2">
        {isLoading ? "—" : data?.patientId ?? "P-XXXX"}
      </p>
      <p className="text-[12px] text-text-muted mt-1">Auto-assigned on save</p>
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
          <span>Patient Name</span>
        </li>
      </ul>
      <p className="text-[12px] text-text-muted mt-3 leading-relaxed">
        All other fields are optional and can be filled in later from the patient detail page.
      </p>
    </div>
  );
}

export default function NewPatient() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    name: "",
    fatherName: "",
    age: "",
    gender: "Male" as "Male" | "Female" | "Other",
    phone: "",
    area: "",
    doctor: "",
    complaint: "",
    diagnosis: "",
    medicineGiven: "",
    bottleSize: "",
    dosage: "",
    medicineEndDate: "",
    notes: "",
  });

  const createPatient = trpc.patients.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Patient registered. ID: ${data.patientId}`);
      navigate(`/patients/${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Patient name is required");
      return;
    }
    createPatient.mutate(form);
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-[1100px] mx-auto space-y-6">
        <PageHeader
          title="Register New Patient"
          description="A unique Patient ID will be automatically assigned"
          back={
            <Button variant="ghost" size="sm" onClick={() => navigate("/patients")} className="gap-2 -ml-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Patients
            </Button>
          }
        />

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,720px)_300px] gap-8">
            {/* Form column */}
            <div className="space-y-10">
              <section>
                <SectionHeader>Personal Information</SectionHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                  <div>
                    <Label>Patient Name <span className="text-danger">*</span></Label>
                    <Input
                      placeholder="Full name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                                         />
                  </div>
                  <div>
                    <Label>Father / Husband Name</Label>
                    <Input
                      placeholder="Father or husband name"
                      value={form.fatherName}
                      onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
                                         />
                  </div>

                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-5">
                    <div>
                      <Label>Age</Label>
                      <Input
                        placeholder="e.g. 35"
                        value={form.age}
                        onChange={(e) => setForm({ ...form, age: e.target.value })}
                                             />
                    </div>
                    <div>
                      <Label>Gender</Label>
                      <Select
                        value={form.gender}
                        onValueChange={(v) => setForm({ ...form, gender: v as "Male" | "Female" | "Other" })}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Phone Number</Label>
                      <Input
                        placeholder="e.g. 0300-1234567"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                             />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <Label>Area / Address</Label>
                    <Input
                      placeholder="e.g. Shah Faisal Colony No. 1"
                      value={form.area}
                      onChange={(e) => setForm({ ...form, area: e.target.value })}
                                         />
                  </div>
                </div>
              </section>

              <section>
                <SectionHeader>First Visit Details</SectionHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                  <div className="sm:col-span-2">
                    <Label>Doctor</Label>
                    <Input
                      placeholder="e.g. Dr. Ahmed Khan"
                      value={form.doctor}
                      onChange={(e) => setForm({ ...form, doctor: e.target.value })}
                                         />
                  </div>
                  <div>
                    <Label>Complaint</Label>
                    <Input
                      placeholder="e.g. Fever, Cough, Body pain"
                      value={form.complaint}
                      onChange={(e) => setForm({ ...form, complaint: e.target.value })}
                                         />
                  </div>
                  <div>
                    <Label>Diagnosis</Label>
                    <Input
                      placeholder="e.g. RTI, GE, Viral fever"
                      value={form.diagnosis}
                      onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                                         />
                  </div>

                  <div className="sm:col-span-2">
                    <Label>Medicine Given</Label>
                    <Input
                      placeholder="e.g. Tab Paracetamol, Syp Cough"
                      value={form.medicineGiven}
                      onChange={(e) => setForm({ ...form, medicineGiven: e.target.value })}
                                         />
                  </div>

                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-5">
                    <div>
                      <Label>Bottle Size (ml)</Label>
                      <Input
                        placeholder="e.g. 30, 60, 100"
                        value={form.bottleSize}
                        onChange={(e) => setForm({ ...form, bottleSize: e.target.value })}
                                             />
                    </div>
                    <div>
                      <Label>Dosage</Label>
                      <Input
                        placeholder="e.g. 1 Tab x 3 Daily"
                        value={form.dosage}
                        onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                                             />
                    </div>
                    <div>
                      <Label>Medicine End Date</Label>
                      <Input
                        type="date"
                        value={form.medicineEndDate}
                        onChange={(e) => setForm({ ...form, medicineEndDate: e.target.value })}
                                             />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <Label>Notes (optional)</Label>
                    <Textarea
                      placeholder="Any additional notes or observations..."
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
                <PatientIdPreview />
                <RequiredFieldsTip />
              </div>
            </aside>
          </div>

          {/* Action row */}
          <div className="flex justify-end gap-3 mt-10 pt-6 border-t border-border-strong">
            <Button type="button" variant="outline" onClick={() => navigate("/patients")}>
              Cancel
            </Button>
            <Button type="submit" className="gap-2" disabled={createPatient.isPending}>
              <UserPlus className="h-4 w-4" />
              {createPatient.isPending ? "Registering..." : "Register Patient"}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
