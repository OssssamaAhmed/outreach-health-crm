import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  FlaskConical,
  MapPin,
  Phone,
  Pill,
  Plus,
  Stethoscope,
  Tent,
  User,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

function EligibilityBadge({ medicineEndDate }: { medicineEndDate: string | null }) {
  if (!medicineEndDate) return null;
  const end = new Date(medicineEndDate);
  const today = new Date();
  const daysLeft = differenceInDays(end, today);

  if (daysLeft > 0) {
    return (
      <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-medium">
        <AlertTriangle className="h-3.5 w-3.5" />
        Medicine active — ends {format(end, "dd MMM yyyy")} ({daysLeft} days left)
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-medium">
      <CheckCircle className="h-3.5 w-3.5" />
      Eligible for new prescription
    </div>
  );
}

function AddVisitDialog({
  patientId,
  nextVisitNumber,
  open,
  onClose,
}: {
  patientId: number;
  nextVisitNumber: number;
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const emptyForm = {
    doctor: "",
    complaint: "",
    diagnosis: "",
    medicineGiven: "",
    bottleSize: "",
    dosage: "",
    medicineEndDate: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  const addVisit = trpc.patients.addVisit.useMutation({
    onSuccess: () => {
      toast.success("Visit recorded successfully");
      utils.patients.detail.invalidate({ id: patientId });
      onClose();
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record New Visit — Visit #{nextVisitNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
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
          <div>
            <Label>Medicine Given</Label>
            <Input
              placeholder="e.g. Tab Paracetamol, Syp Cough"
              value={form.medicineGiven}
              onChange={(e) => setForm({ ...form, medicineGiven: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <div>
            <Label>Medicine End Date</Label>
            <Input
              type="date"
              value={form.medicineEndDate}
              onChange={(e) => setForm({ ...form, medicineEndDate: e.target.value })}
            />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Any additional notes..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button
              className="flex-1"
              onClick={() =>
                addVisit.mutate({
                  patientId,
                  visitNumber: nextVisitNumber,
                  visitDate: new Date().toISOString(),
                  ...form,
                })
              }
              disabled={addVisit.isPending}
            >
              {addVisit.isPending ? "Saving..." : "Save Visit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [addVisitOpen, setAddVisitOpen] = useState(false);
  const { data, isLoading } = trpc.patients.detail.useQuery({ id: Number(id) });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-32 bg-muted rounded" />
            <div className="h-48 bg-muted rounded" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Patient not found</p>
          <Button variant="ghost" onClick={() => navigate("/patients")} className="mt-4">
            Back to Patients
          </Button>
        </div>
      </AppLayout>
    );
  }

  const { patient, visits } = data;
  const lastVisit = visits[0];
  const nextVisitNumber = (lastVisit?.visitNumber ?? 0) + 1;

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={() => navigate("/patients")} className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Patients
        </Button>

        {/* Patient Info Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-md bg-brand-primary-soft flex items-center justify-center">
                  <span className="text-[18px] font-semibold text-brand-primary">
                    {patient.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h1 className="font-display text-[20px] font-medium text-text-primary">{patient.name}</h1>
                  <p className="text-sm text-muted-foreground">{patient.patientId}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary">{patient.gender}</Badge>
                    {patient.age && <Badge variant="outline">Age: {patient.age}</Badge>}
                  </div>
                </div>
              </div>
              <Button onClick={() => setAddVisitOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Visit
              </Button>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-border">
              {patient.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 text-primary" />
                  <span>{patient.phone}</span>
                </div>
              )}
              {patient.area && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>{patient.area}</span>
                </div>
              )}
              {patient.fatherName && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4 text-primary" />
                  <span>S/O or D/O: {patient.fatherName}</span>
                </div>
              )}
            </div>

            {/* Medicine Eligibility */}
            {lastVisit?.medicineEndDate && (
              <div className="mt-4">
                <EligibilityBadge medicineEndDate={lastVisit.medicineEndDate ? String(lastVisit.medicineEndDate) : null} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Visit History */}
        <div>
          <h2 className="font-display text-[16px] font-medium text-text-primary mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-text-secondary" />
            Visit History ({visits.length} visits)
          </h2>

          {visits.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No visits recorded yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {visits.map((visit, idx) => (
                <Card key={visit.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-xs font-semibold text-white">{visit.visitNumber}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Visit #{visit.visitNumber}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(visit.visitDate), "dd MMMM yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {visit.campId != null && (
                          <Link href={`/camps/${visit.campId}`}>
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 cursor-pointer hover:bg-muted bg-amber-50 text-amber-800 border-amber-200"
                              title={visit.campTitle ? `View camp: ${visit.campTitle}` : "View camp"}
                            >
                              <Tent className="h-3 w-3" />
                              Camp{visit.campTitle ? ` · ${visit.campTitle}` : ""}
                            </Badge>
                          </Link>
                        )}
                        {idx === 0 && (
                          <Badge className="text-[10px]">Latest</Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      {visit.doctor && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Doctor</p>
                          <div className="flex items-center gap-1.5">
                            <Stethoscope className="h-3.5 w-3.5 text-primary" />
                            <p className="text-foreground">{visit.doctor}</p>
                          </div>
                        </div>
                      )}
                      {visit.complaint && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Complaint</p>
                          <p className="text-foreground">{visit.complaint}</p>
                        </div>
                      )}
                      {visit.diagnosis && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Diagnosis</p>
                          <p className="text-foreground">{visit.diagnosis}</p>
                        </div>
                      )}
                      {visit.medicineGiven && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Medicine Given</p>
                          <div className="flex items-center gap-1.5">
                            <Pill className="h-3.5 w-3.5 text-primary" />
                            <p className="text-foreground">{visit.medicineGiven}</p>
                          </div>
                        </div>
                      )}
                      {visit.dosage && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Dosage</p>
                          <p className="text-foreground">{visit.dosage}</p>
                        </div>
                      )}
                      {visit.bottleSize && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Bottle Size</p>
                          <p className="text-foreground">{visit.bottleSize} ml</p>
                        </div>
                      )}
                      {visit.medicineEndDate && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Medicine End Date</p>
                          <p className="text-foreground">{format(new Date(visit.medicineEndDate), "dd MMM yyyy")}</p>
                        </div>
                      )}
                    </div>

                    {visit.notes && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground">{visit.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <AddVisitDialog
        patientId={patient.id}
        nextVisitNumber={nextVisitNumber}
        open={addVisitOpen}
        onClose={() => setAddVisitOpen(false)}
      />
    </AppLayout>
  );
}
