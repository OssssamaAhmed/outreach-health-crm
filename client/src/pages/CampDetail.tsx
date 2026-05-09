import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, Download, Edit, FlaskConical,
  Loader2, Mail, MapPin, Phone, Plus, Printer, Stethoscope, Trash2, Users,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { downloadCsv, toCsv, type CsvColumn } from "@/lib/csv";
import { useAuth } from "@/_core/hooks/useAuth";

const statusColor: Record<string, string> = {
  planned: "bg-blue-50 text-blue-700 border-blue-200",
  ongoing: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

type DoctorFormState = {
  doctorName: string;
  specialty: string;
  qualification: string;
  phone: string;
  email: string;
};

const emptyDoctorForm: DoctorFormState = {
  doctorName: "",
  specialty: "",
  qualification: "",
  phone: "",
  email: "",
};

function DoctorFormFields({
  form,
  setForm,
}: {
  form: DoctorFormState;
  setForm: (f: DoctorFormState) => void;
}) {
  return (
    <>
      <div>
        <Label>Doctor Name <span className="text-destructive">*</span></Label>
        <Input placeholder="e.g. Dr. Ahmed Khan" value={form.doctorName}
          onChange={(e) => setForm({ ...form, doctorName: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Specialty</Label>
          <Input placeholder="e.g. General Medicine" value={form.specialty}
            onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
        </div>
        <div>
          <Label>Qualification</Label>
          <Input placeholder="e.g. MBBS, FCPS" value={form.qualification}
            onChange={(e) => setForm({ ...form, qualification: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Phone</Label>
          <Input placeholder="0300-1234567" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" placeholder="doctor@example.com" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>
    </>
  );
}

function AddDoctorDialog({ campId, open, onClose }: { campId: number; open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<DoctorFormState>(emptyDoctorForm);
  const add = trpc.camps.addDoctor.useMutation({
    onSuccess: () => {
      toast.success("Doctor added");
      utils.camps.detail.invalidate({ id: campId });
      onClose();
      setForm(emptyDoctorForm);
    },
    onError: (e) => toast.error(e.message),
  });
  const onSave = () => {
    if (!form.doctorName.trim()) { toast.error("Doctor name is required"); return; }
    add.mutate({ campId, ...form });
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Doctor</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <DoctorFormFields form={form} setForm={setForm} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button className="flex-1" disabled={add.isPending} onClick={onSave}>Add</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type DoctorRow = {
  id: number;
  doctorName: string;
  specialty: string | null;
  qualification: string | null;
  phone: string | null;
  email: string | null;
};

function EditDoctorDialog({
  doctor,
  campId,
  open,
  onClose,
}: {
  doctor: DoctorRow;
  campId: number;
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<DoctorFormState>({
    doctorName: doctor.doctorName,
    specialty: doctor.specialty ?? "",
    qualification: doctor.qualification ?? "",
    phone: doctor.phone ?? "",
    email: doctor.email ?? "",
  });
  const update = trpc.camps.updateDoctor.useMutation({
    onSuccess: () => {
      toast.success("Doctor updated");
      utils.camps.detail.invalidate({ id: campId });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const onSave = () => {
    if (!form.doctorName.trim()) { toast.error("Doctor name is required"); return; }
    update.mutate({ id: doctor.id, ...form });
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Doctor</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <DoctorFormFields form={form} setForm={setForm} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button className="flex-1" disabled={update.isPending} onClick={onSave}>Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddTestDialog({ campId, open, onClose }: { campId: number; open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ testName: "" });
  const add = trpc.camps.addTest.useMutation({
    onSuccess: () => { toast.success("Test/service added"); utils.camps.detail.invalidate({ id: campId }); onClose(); setForm({ testName: "" }); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add Test / Service</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Test / Service Name <span className="text-destructive">*</span></Label>
            <Input placeholder="e.g. Blood Sugar Test" value={form.testName} onChange={(e) => setForm({ ...form, testName: e.target.value })} />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button className="flex-1" disabled={add.isPending} onClick={() => add.mutate({ campId, ...form })}>Add</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type PatientCandidate = {
  patient: {
    id: number;
    patientId: string;
    name: string;
    age: number | null;
    gender: "Male" | "Female" | "Other" | null;
    phone: string | null;
    area: string | null;
  };
  lastVisit: { visitDate: Date | string; complaint: string | null; diagnosis: string | null } | null;
  totalVisits: number;
};

const emptyAddPatientForm = {
  patientName: "",
  age: "",
  gender: "" as "" | "Male" | "Female" | "Other",
  phone: "",
  fatherHusbandName: "",
  area: "",
  doctor: "",
  complaint: "",
  diagnosis: "",
  tests: "",
  medicines: "",
};

function AddPatientDialog({ campId, open, onClose }: { campId: number; open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState(emptyAddPatientForm);
  const [candidate, setCandidate] = useState<PatientCandidate | null>(null);
  const [usingExisting, setUsingExisting] = useState(false);
  const [forceNew, setForceNew] = useState(false);
  const [searching, setSearching] = useState(false);

  const reset = () => {
    setForm(emptyAddPatientForm);
    setCandidate(null);
    setUsingExisting(false);
    setForceNew(false);
    setSearching(false);
  };

  const add = trpc.camps.addPatient.useMutation({
    onSuccess: (data) => {
      const verb = data.isNew ? "registered and added" : "linked from existing";
      toast.success(`Patient ${verb} (serial #${data.serialNo})`);
      utils.camps.detail.invalidate({ id: campId });
      utils.patients.list.invalidate();
      onClose();
      reset();
    },
    onError: (e) => toast.error(e.message),
  });

  const onPhoneBlur = async () => {
    const phone = form.phone.trim();
    if (!phone || forceNew || usingExisting) {
      setCandidate(null);
      return;
    }
    setSearching(true);
    try {
      const result = await utils.patients.findCandidate.fetch({ phone });
      setCandidate(result as PatientCandidate | null);
    } catch {
      // Fail-silent — banner just doesn't appear, submit still works
      setCandidate(null);
    } finally {
      setSearching(false);
    }
  };

  const useExisting = () => {
    if (!candidate) return;
    setUsingExisting(true);
    setForceNew(false);
    setForm({
      ...form,
      patientName: candidate.patient.name,
      age: candidate.patient.age != null ? String(candidate.patient.age) : "",
      gender: candidate.patient.gender ?? "",
      phone: candidate.patient.phone ?? form.phone,
      area: candidate.patient.area ?? form.area,
    });
  };

  const addAsNew = () => {
    setCandidate(null);
    setForceNew(true);
    setUsingExisting(false);
  };

  const clearMatch = () => {
    setUsingExisting(false);
    setCandidate(null);
  };

  const onSubmit = () => {
    if (!form.patientName.trim()) { toast.error("Patient name is required"); return; }
    if (!form.gender) { toast.error("Gender is required"); return; }
    add.mutate({
      campId,
      patientName: form.patientName,
      age: form.age || undefined,
      gender: form.gender as "Male" | "Female" | "Other",
      phone: form.phone || undefined,
      fatherHusbandName: form.fatherHusbandName || undefined,
      area: form.area || undefined,
      doctor: form.doctor || undefined,
      complaint: form.complaint || undefined,
      diagnosis: form.diagnosis || undefined,
      tests: form.tests || undefined,
      medicines: form.medicines || undefined,
      forceNew,
    });
  };

  const masterFieldsLocked = usingExisting;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Patient to Camp Log</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Mode banners */}
          {usingExisting && candidate && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-[12px] text-emerald-900">
                Linking to existing beneficiary <span className="font-semibold">{candidate.patient.name}</span> ({candidate.patient.patientId}).
                Name, age, gender locked from the master record.
                <button type="button" onClick={clearMatch} className="ml-2 underline text-emerald-800 hover:text-emerald-900">Clear</button>
              </div>
            </div>
          )}
          {forceNew && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex items-start gap-2 text-[12px] text-amber-900">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                Creating a new patient record (existing match was overridden).
                <button type="button" onClick={() => setForceNew(false)} className="ml-2 underline">Undo</button>
              </div>
            </div>
          )}

          <div>
            <Label>Patient Name <span className="text-destructive">*</span></Label>
            <Input
              placeholder="Full name"
              value={form.patientName}
              disabled={masterFieldsLocked}
              onChange={(e) => setForm({ ...form, patientName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Age</Label>
              <Input
                placeholder="e.g. 35"
                value={form.age}
                disabled={masterFieldsLocked}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
              />
            </div>
            <div>
              <Label>Gender <span className="text-destructive">*</span></Label>
              <Select
                value={form.gender}
                disabled={masterFieldsLocked}
                onValueChange={(v) => setForm({ ...form, gender: v as "Male" | "Female" | "Other" })}
              >
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                placeholder="0300-1234567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                onBlur={onPhoneBlur}
              />
            </div>
          </div>

          {/* Existing-patient banner — only shows when not already in a mode */}
          {!usingExisting && !forceNew && candidate && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-[12px] text-amber-900">
                  <p>
                    <span className="font-semibold">Existing beneficiary:</span> {candidate.patient.name}
                    {" · "}{candidate.patient.patientId}
                    {candidate.lastVisit && (
                      <>
                        {" · last visited "}
                        {formatDistanceToNow(new Date(candidate.lastVisit.visitDate), { addSuffix: true })}
                        {candidate.lastVisit.complaint && ` for "${candidate.lastVisit.complaint}"`}
                      </>
                    )}
                    {" · "}{candidate.totalVisits} prior visit{candidate.totalVisits === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 ml-6">
                <Button size="sm" type="button" onClick={useExisting} className="h-7 text-xs">Use this record</Button>
                <Button size="sm" type="button" variant="outline" onClick={addAsNew} className="h-7 text-xs">Add as new person anyway</Button>
              </div>
            </div>
          )}

          {searching && (
            <p className="text-[12px] text-text-muted flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Checking for existing record…
            </p>
          )}

          <div>
            <Label>Father / Husband Name</Label>
            <Input
              placeholder="Father or husband name"
              value={form.fatherHusbandName}
              onChange={(e) => setForm({ ...form, fatherHusbandName: e.target.value })}
            />
          </div>
          <div>
            <Label>Area</Label>
            <Input
              placeholder="e.g. Shah Faisal No. 1"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
            />
          </div>

          {/* Clinical section */}
          <div className="pt-2 border-t border-border">
            <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-3">Clinical</p>
            <div className="space-y-3">
              <div>
                <Label>Doctor</Label>
                <Input
                  placeholder="e.g. Dr. Ahmed"
                  value={form.doctor}
                  onChange={(e) => setForm({ ...form, doctor: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Complaint</Label>
                  <Input
                    placeholder="Fever, body pain"
                    value={form.complaint}
                    onChange={(e) => setForm({ ...form, complaint: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Diagnosis</Label>
                  <Input
                    placeholder="Viral fever"
                    value={form.diagnosis}
                    onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Tests <span className="text-text-muted text-[11px] font-normal">(one per line)</span></Label>
                <Textarea
                  rows={3}
                  placeholder={"blood pressure\nblood sugar\neyesight"}
                  value={form.tests}
                  onChange={(e) => setForm({ ...form, tests: e.target.value })}
                />
              </div>
              <div>
                <Label>Medicines <span className="text-text-muted text-[11px] font-normal">(one per line)</span></Label>
                <Textarea
                  rows={3}
                  placeholder={"Tab Paracetamol 500mg — 1 tab 3x daily\nTab Diclo — 1 tab 2x daily"}
                  value={form.medicines}
                  onChange={(e) => setForm({ ...form, medicines: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => { onClose(); reset(); }} className="flex-1">Cancel</Button>
            <Button
              className="flex-1"
              disabled={add.isPending || !form.patientName.trim() || !form.gender}
              onClick={onSubmit}
            >
              {add.isPending ? "Saving…" : "Add Patient"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditCampDialog({ camp, open, onClose }: { camp: any; open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    title: camp.title,
    campDate: format(new Date(camp.campDate), "yyyy-MM-dd"),
    location: camp.location ?? "",
    notes: camp.notes ?? "",
    totalVolunteers: String(camp.totalVolunteers ?? 0),
    totalExpense: String(camp.totalExpense ?? "0"),
    status: camp.status,
  });
  const update = trpc.camps.update.useMutation({
    onSuccess: () => { toast.success("Camp updated"); utils.camps.detail.invalidate({ id: camp.id }); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Camp</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.campDate} onChange={(e) => setForm({ ...form, campDate: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="planned">Planned</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Volunteers</Label>
              <Input type="number" value={form.totalVolunteers} onChange={(e) => setForm({ ...form, totalVolunteers: e.target.value })} />
            </div>
            <div>
              <Label>Total Expense (Rs.)</Label>
              <Input type="number" value={form.totalExpense} onChange={(e) => setForm({ ...form, totalExpense: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button className="flex-1" disabled={update.isPending}
              onClick={() => update.mutate({ id: camp.id, ...form, totalVolunteers: Number(form.totalVolunteers) })}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CampDetail() {
  const { id } = useParams<{ id: string }>();
  const campId = Number(id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const role = user?.role ?? "receptionist";
  const canEdit = role === "admin" || role === "super_admin";
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [editDoctor, setEditDoctor] = useState<DoctorRow | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [patientOpen, setPatientOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { data, isLoading } = trpc.camps.detail.useQuery({ id: campId });
  const utils = trpc.useUtils();

  const removeDoctor = trpc.camps.removeDoctor.useMutation({
    onSuccess: () => { toast.success("Doctor removed"); utils.camps.detail.invalidate({ id: campId }); },
  });
  const removeTest = trpc.camps.removeTest.useMutation({
    onSuccess: () => { toast.success("Test removed"); utils.camps.detail.invalidate({ id: campId }); },
  });
  const removePatient = trpc.camps.removePatient.useMutation({
    onSuccess: () => { toast.success("Patient removed"); utils.camps.detail.invalidate({ id: campId }); },
  });

  const onExportDoctors = () => {
    if (!data?.doctors.length) {
      toast.message("No doctors to export");
      return;
    }
    const columns: CsvColumn<DoctorRow>[] = [
      { header: "Name",          value: (d) => d.doctorName },
      { header: "Specialty",     value: (d) => d.specialty ?? "" },
      { header: "Qualification", value: (d) => d.qualification ?? "" },
      { header: "Phone",         value: (d) => d.phone ?? "" },
      { header: "Email",         value: (d) => d.email ?? "" },
    ];
    downloadCsv(`camp_${campId}_doctors.csv`, toCsv(data.doctors, columns));
  };

  const onExportPatients = () => {
    if (!data?.campPatients.length) {
      toast.message("No patients to export");
      return;
    }
    type CampPatientRow = (typeof data.campPatients)[number];
    const columns: CsvColumn<CampPatientRow>[] = [
      { header: "S.No",                value: (p) => p.serialNo },
      { header: "Patient Name",        value: (p) => p.patientName },
      { header: "Age",                 value: (p) => p.age ?? "" },
      { header: "Gender",              value: (p) => p.masterGender ?? "" },
      { header: "Phone",               value: (p) => p.phone ?? "" },
      { header: "Father / Husband",    value: (p) => p.fatherHusbandName ?? "" },
      { header: "Area",                value: (p) => p.area ?? "" },
      { header: "Doctor",              value: (p) => p.doctor ?? "" },
      { header: "Complaint",           value: (p) => p.complaint ?? "" },
      { header: "Diagnosis",           value: (p) => p.diagnosis ?? "" },
      { header: "Tests",               value: (p) => p.tests ?? "" },
      { header: "Medicines",           value: (p) => p.medicines ?? "" },
      { header: "Beneficiary Status",  value: (p) => Number(p.totalVisits ?? 0) > 1 ? "Returning" : Number(p.totalVisits ?? 0) === 1 ? "First time" : "Unlinked" },
      { header: "Master Patient ID",   value: (p) => p.masterPatientCode ?? "" },
    ];
    downloadCsv(`camp_${campId}_patients.csv`, toCsv(data.campPatients, columns));
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 max-w-5xl mx-auto animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Camp not found</p>
          <Button variant="ghost" onClick={() => navigate("/camps")} className="mt-4">Back to Camps</Button>
        </div>
      </AppLayout>
    );
  }

  const { camp, doctors, tests, campPatients: patients } = data;

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate("/camps")} className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Camps
        </Button>

        {/* Camp Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="font-display text-[20px] font-medium text-text-primary">{camp.title}</h1>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusColor[camp.status ?? 'upcoming'] ?? statusColor.upcoming}`}>
                    {(camp.status ?? 'upcoming').charAt(0).toUpperCase() + (camp.status ?? 'upcoming').slice(1)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {format(new Date(camp.campDate), "dd MMMM yyyy")}
                  </span>
                  {camp.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary" />
                      {camp.location}
                    </span>
                  )}
                </div>
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
                  <Edit className="h-4 w-4" />
                  Edit Camp
                </Button>
              )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-border">
              <div className="text-center">
                <p className="font-display text-[24px] font-medium text-text-primary leading-none">{patients.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Beneficiaries</p>
              </div>
              <div className="text-center">
                <p className="font-display text-[24px] font-medium text-text-primary leading-none">{doctors.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Doctors</p>
              </div>
              <div className="text-center">
                <p className="font-display text-[24px] font-medium text-text-primary leading-none">{camp.totalVolunteers ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Volunteers</p>
              </div>
              <div className="text-center">
                <p className="font-display text-[24px] font-medium text-text-primary leading-none">
                  {camp.totalExpense && Number(camp.totalExpense) > 0
                    ? `Rs. ${Number(camp.totalExpense).toLocaleString()}`
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Total Expense</p>
              </div>
            </div>

            {camp.notes && (
              <p className="mt-4 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
                {camp.notes}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Two-column: Doctors + Tests */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Doctors */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  Doctors ({doctors.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs"
                    onClick={onExportDoctors} disabled={!doctors.length}>
                    <Download className="h-3 w-3" />
                    Export CSV
                  </Button>
                  {canEdit && (
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setDoctorOpen(true)}>
                      <Plus className="h-3 w-3" />
                      Add
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {doctors.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No doctors added yet</p>
              ) : (
                <div className="space-y-2">
                  {doctors.map((doc) => (
                    <div key={doc.id} className="p-3 rounded-lg bg-muted/40">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{doc.doctorName}</p>
                          {(doc.specialty || doc.qualification) && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {[doc.specialty, doc.qualification].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {(doc.phone || doc.email) && (
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                              {doc.phone && (
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {doc.phone}
                                </span>
                              )}
                              {doc.email && (
                                <span className="inline-flex items-center gap-1 truncate">
                                  <Mail className="h-3 w-3" /> {doc.email}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={() => setEditDoctor(doc)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => removeDoctor.mutate({ id: doc.id })}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tests */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-primary" />
                  Tests / Services ({tests.length})
                </CardTitle>
                {canEdit && (
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setTestOpen(true)}>
                    <Plus className="h-3 w-3" />
                    Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {tests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No tests added yet</p>
              ) : (
                <div className="space-y-2">
                  {tests.map((test) => (
                    <div key={test.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                      <div>
                        <p className="text-sm font-medium text-foreground">{test.testName}</p>
                      </div>
                      {canEdit && (
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeTest.mutate({ id: test.id })}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Patient Log */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Patient Log ({patients.length} beneficiaries)
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs no-print"
                  onClick={onExportPatients} disabled={!patients.length}>
                  <Download className="h-3 w-3" />
                  Export CSV
                </Button>
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs no-print" onClick={() => window.print()}>
                  <Printer className="h-3 w-3" />
                  Print
                </Button>
                {canEdit && (
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setPatientOpen(true)}>
                    <Plus className="h-3 w-3" />
                    Add Patient
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
            {patients.length === 0 ? (
              <div className="py-10 text-center">
                <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No patients in log yet</p>
                {canEdit && (
                  <Button size="sm" className="mt-3 gap-2" onClick={() => setPatientOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Add First Patient
                  </Button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-xs">S.No</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-xs">Patient Name</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-xs">Beneficiary</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-xs">Age</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-xs">Phone</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-xs">Father / Husband</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-xs">Area</th>
                    {canEdit && (
                      <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-xs no-print">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {patients.map((p, idx) => {
                    const visitCount = Number(p.totalVisits ?? 0);
                    const linked = p.patientId != null;
                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-muted/30 transition-colors ${linked ? "cursor-pointer" : ""}`}
                        onClick={linked ? () => navigate(`/patients/${p.patientId}`) : undefined}
                        title={linked ? `Open ${p.masterPatientCode ?? "patient"} record` : undefined}
                      >
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">{p.serialNo ?? idx + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-foreground">
                          {p.patientName}
                          {linked && p.masterPatientCode && (
                            <span className="text-[11px] text-muted-foreground ml-2 font-normal">
                              {p.masterPatientCode}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {linked ? (
                            <Badge
                              variant={visitCount > 1 ? "default" : "secondary"}
                              className="text-[10px] font-medium"
                            >
                              Visit #{visitCount > 0 ? visitCount : 1}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{p.age || "—"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{p.phone || "—"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{p.fatherHusbandName || "—"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{p.area || "—"}</td>
                        {canEdit && (
                          <td className="px-3 py-2.5 text-right no-print" onClick={(e) => e.stopPropagation()}>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => removePatient.mutate({ id: p.id })}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <AddDoctorDialog campId={campId} open={doctorOpen} onClose={() => setDoctorOpen(false)} />
      {editDoctor && (
        <EditDoctorDialog
          doctor={editDoctor}
          campId={campId}
          open={true}
          onClose={() => setEditDoctor(null)}
        />
      )}
      <AddTestDialog campId={campId} open={testOpen} onClose={() => setTestOpen(false)} />
      <AddPatientDialog campId={campId} open={patientOpen} onClose={() => setPatientOpen(false)} />
      {editOpen && <EditCampDialog camp={camp} open={editOpen} onClose={() => setEditOpen(false)} />}
    </AppLayout>
  );
}
