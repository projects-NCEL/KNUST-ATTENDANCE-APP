import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ExternalLink,
  Copy,
  Check,
  QrCode,
  Smartphone,
  Share2,
  ShieldCheck,
  GraduationCap,
  Users,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portal-links")({
  head: () => ({ meta: [{ title: "Student Access Links — Qmark" }] }),
  component: StudentPortalLinksPage,
});

function StudentPortalLinksPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [studentPortalQr, setStudentPortalQr] = useState<string>("");
  const [checkInQr, setCheckInQr] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.origin;
      setOrigin(host);

      QRCode.toDataURL(`${host}/student`, { width: 260, margin: 2 }).then(setStudentPortalQr);
      QRCode.toDataURL(`${host}/check-in`, { width: 260, margin: 2 }).then(setCheckInQr);
    }
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const studentPortalUrl = `${origin}/student`;
  const checkInUrl = `${origin}/check-in`;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-4 pb-12">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Student Portal & Links</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Share these links with your students to access their digital attendance cards, course records, and session check-ins.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Universal Student Portal Card */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Smartphone className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Student Portal</CardTitle>
                  <CardDescription className="text-xs">
                    Persistent student account, attendance %, & QR pass
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p className="text-muted-foreground">
                Students log in once with their Index Number and remain logged in for up to 14 days.
              </p>

              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={studentPortalUrl}
                  className="h-8 text-xs font-mono bg-muted/40"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 shrink-0"
                  onClick={() => copyToClipboard(studentPortalUrl, "portal")}
                >
                  {copiedKey === "portal" ? (
                    <Check className="size-3.5 text-[#D4AF37]" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
                <a href={studentPortalUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="ghost" className="h-8 px-2 shrink-0">
                    <ExternalLink className="size-3.5" />
                  </Button>
                </a>
              </div>

              {studentPortalQr && (
                <div className="pt-2 flex flex-col items-center justify-center p-3 rounded-lg bg-muted/20 border">
                  <img
                    src={studentPortalQr}
                    alt="Student Portal QR"
                    className="size-36 rounded-md bg-white p-1 border shadow-xs"
                  />
                  <span className="text-[11px] text-muted-foreground mt-2 font-medium">
                    Project or print this QR code in class
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* In-Class Self Check-In Card */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#D4AF37]/10 text-[#AA820A] dark:text-[#D4AF37]">
                  <QrCode className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Self Check-In Portal</CardTitle>
                  <CardDescription className="text-xs">
                    Direct session code / token entry for lectures
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p className="text-muted-foreground">
                Direct URL for students to enter the active session passcode displayed on the lecture screen.
              </p>

              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={checkInUrl}
                  className="h-8 text-xs font-mono bg-muted/40"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 shrink-0"
                  onClick={() => copyToClipboard(checkInUrl, "checkin")}
                >
                  {copiedKey === "checkin" ? (
                    <Check className="size-3.5 text-[#D4AF37]" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
                <a href={checkInUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="ghost" className="h-8 px-2 shrink-0">
                    <ExternalLink className="size-3.5" />
                  </Button>
                </a>
              </div>

              {checkInQr && (
                <div className="pt-2 flex flex-col items-center justify-center p-3 rounded-lg bg-muted/20 border">
                  <img
                    src={checkInQr}
                    alt="Check-in QR"
                    className="size-36 rounded-md bg-white p-1 border shadow-xs"
                  />
                  <span className="text-[11px] text-muted-foreground mt-2 font-medium">
                    Instant scan to open check-in page
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Tips */}
        <Card className="border shadow-xs bg-muted/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-primary" />
              Lecturer Information & Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1.5">
            <p>
              • <b>Student Index Number:</b> Students only need their registered KNUST Index Number to log into the Student Portal.
            </p>
            <p>
              • <b>Offline QR Cards:</b> You can also print batch ID cards with embedded QR codes directly from the{" "}
              <Link to="/students" className="text-primary font-medium underline">
                Students Directory
              </Link>.
            </p>
            <p>
              • <b>Scanning in Class:</b> Use the built-in{" "}
              <Link to="/scan" className="text-primary font-medium underline">
                Attendance Scanner
              </Link>{" "}
              to scan student cards via camera or an external barcode reader.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
