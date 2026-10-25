import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Download,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { QmarkLogo } from "@/components/QmarkLogo";
import { StudentQrPassCard } from "@/components/StudentQrPassCard";

export const Route = createFileRoute("/portal/$token/register")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Student Registration — Qmark" },
      {
        name: "description",
        content:
          "New students register themselves and instantly receive their personal Qmark attendance QR pass.",
      },
      { property: "og:title", content: "Student Registration — Qmark" },
      {
        property: "og:description",
        content: "Register once and get your personal digital attendance pass on Qmark.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterPage,
});

type Created = {
  full_name: string;
  index_number: string;
  level: string;
  department: string;
  qr_uuid: string;
  pin: string;
  existed: boolean;
};

function RegisterPage() {
  const { token } = Route.useParams();
  const [levels, setLevels] = useState<string[]>(["100", "200", "300", "400", "500", "600"]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [fullName, setFullName] = useState("");
  const [index, setIndex] = useState("");
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [program, setProgram] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmedAccurate, setConfirmedAccurate] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/public/portal-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "info", token }),
        });
        const data = await res.json();
        if (data.departments) {
          const depts = data.departments;
          depts.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
          setDepartments(depts);
        }
        if (data.levels && Array.isArray(data.levels) && data.levels.length > 0) {
          setLevels(data.levels);
          if (data.levels.length === 1) {
            setLevel(data.levels[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load departments", err);
      }
    })();
  }, [token]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIndex = index.trim().toUpperCase();
    const cleanName = fullName.trim();

    if (!cleanIndex || !cleanName) {
      return toast.error("Full name and index number are required");
    }
    if (!level) {
      return toast.error("Please select your class level");
    }
    // Prompt student to cross-check info in modal
    setConfirmedAccurate(false);
    setShowConfirmModal(true);
  };

  const performRegistration = async () => {
    const cleanIndex = index.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    setLoading(true);
    try {
      const res = await fetch("/api/public/portal-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          token,
          full_name: cleanName,
          index: cleanIndex,
          email: cleanEmail,
          level,
          department_id: departmentId,
          program: program.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed. Please try again.");
      }

      const row: Created = {
        full_name: data.student.full_name,
        index_number: data.student.index_number,
        level: data.student.level || level || "100",
        department: data.student.department,
        qr_uuid: data.student.qr_uuid,
        pin: data.student.pin || "",
        existed: Boolean(data.existed),
      };

      setCreated(row);
      setShowConfirmModal(false);
      setQrDataUrl(
        await QRCode.toDataURL(row.qr_uuid, {
          width: 360,
          margin: 2,
          color: { dark: "#0A1F44", light: "#ffffff" },
        }),
      );
      toast.success(
        row.existed
          ? "You were already in this lecturer's system — here is your QR."
          : "Registration complete! You are now added to your lecturer's class.",
      );
    } catch (err: any) {
      toast.error(err?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPng = () => {
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${created!.index_number}-qr.png`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col justify-between">
      <div className="flex-1 flex flex-col items-center justify-center px-3 py-4 sm:py-6 w-full max-w-sm sm:max-w-md mx-auto min-w-0">
        <div className="w-full max-w-sm sm:max-w-md mt-2 mb-3">
          <Link to="/portal/$token" params={{ token }}>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
              <ArrowLeft className="size-3.5 mr-1" />
              Back to portal
            </Button>
          </Link>
        </div>

        {!created ? (
          <Card className="w-full max-w-sm sm:max-w-md glass-card rounded-2xl border border-[#D4AF37]/35 shadow-card">
            <CardHeader className="text-center p-4 sm:p-5 pb-2">
              <div className="flex justify-center mb-1.5">
                <QmarkLogo size="sm" variant="full" />
              </div>
              <CardTitle className="flex items-center justify-center gap-1.5 text-base sm:text-lg font-bold">
                <UserPlus className="size-4 text-primary" /> New Student Registration
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Register once on Qmark to receive your personal digital QR attendance pass.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-2">
              <form onSubmit={handleFormSubmit} className="flex flex-col gap-3 w-full">
                <div className="flex flex-col gap-1 text-left">
                  <Label className="text-xs font-semibold">Full name</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    required
                    className="h-10 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1 text-left">
                  <Label className="text-xs font-semibold">Index number</Label>
                  <Input
                    value={index}
                    onChange={(e) => setIndex(e.target.value)}
                    placeholder="e.g. 20700000"
                    required
                    className="h-10 font-mono text-sm uppercase"
                  />
                </div>
                <div className="flex flex-col gap-1 text-left">
                  <Label className="text-xs font-semibold">Email address</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@example.com"
                    required
                    className="h-10 text-sm"
                  />
                </div>
                {/* Stacked Vertically for Portrait Mobile */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1 text-left">
                    <Label className="text-xs font-semibold">Level</Label>
                    <Select value={level} onValueChange={setLevel} required>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {levels.map((l) => (
                          <SelectItem key={l} value={l}>
                            Level {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1 text-left">
                    <Label className="text-xs font-semibold">Department</Label>
                    <Select value={departmentId} onValueChange={setDepartmentId}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-left">
                  <Label className="text-xs font-semibold">Program / Major (optional)</Label>
                  <Input
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    placeholder="e.g. BSc Computer Science"
                    className="h-10 text-sm"
                  />
                </div>

                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-semibold">⚠️ Attention:</span> Please cross-check all your
                    information carefully before submitting. Your details will be registered
                    strictly into the account of the lecturer who shared this link.
                  </div>
                </div>

                <Button type="submit" className="w-full h-10 text-xs sm:text-sm font-semibold mt-1 cursor-pointer" disabled={loading}>
                  {loading ? "Checking details..." : "Review & Register"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="w-full max-w-sm sm:max-w-md space-y-4">
            <StudentQrPassCard
              student={{
                indexNumber: created.index_number,
                fullName: created.full_name,
                level: created.level,
                department: created.department,
                token: created.qr_uuid,
              }}
            />
            <p className="text-[11px] text-muted-foreground text-center">
              Your Qmark pass is active. You can present this screen or download the QR to verify attendance in any class session.
            </p>
          </div>
        )}

        <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                Cross-Check Your Information
              </DialogTitle>
              <DialogDescription>
                Please review your details carefully. This information will be saved directly into
                your lecturer's attendance roster and cannot be changed after submission.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Full Name:</span>
                <span className="font-semibold">{fullName.trim()}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Index Number:</span>
                <span className="font-mono font-bold text-primary">
                  {index.trim().toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Class Level:</span>
                <span className="font-semibold">Level {level}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Department:</span>
                <span>{departments.find((d) => d.id === departmentId)?.name || "General"}</span>
              </div>
              {program.trim() && (
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Program:</span>
                  <span>{program.trim()}</span>
                </div>
              )}
              {email.trim() && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Email:</span>
                  <span>{email.trim()}</span>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                Please verify that your <strong>Index Number ({index.trim().toUpperCase()})</strong>{" "}
                and <strong>Level ({level})</strong> are completely accurate.
              </span>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
              >
                Edit Information
              </Button>
              <Button type="button" onClick={performRegistration} disabled={loading}>
                <CheckCircle2 className="size-4 mr-1.5" />
                {loading ? "Registering..." : "Confirm & Submit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
