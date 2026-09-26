import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Gift,
  Home as HomeIcon,
  Check,
  GraduationCap,
  ScanLine,
  FileBarChart,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Free Academic Access — Qmark" },
      {
        name: "description",
        content:
          "Qmark is completely free for all lecturers, faculty, and students with no subscriptions or fees.",
      },
      { property: "og:title", content: "Free Academic Access — Qmark" },
      {
        property: "og:description",
        content: "100% free university attendance system with unlimited courses, sessions, and exports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FreeAccessPage,
});

function FreeAccessPage() {
  const { user } = useAuth();

  const perks = [
    {
      title: "Unlimited Class Sessions & Courses",
      desc: "Create and manage as many courses, class groups, and lecture sessions as needed across all semesters.",
      icon: GraduationCap,
    },
    {
      title: "Unlimited Students & Unique QR Passes",
      desc: "Import complete student rosters via Excel or CSV with instant generation of universal attendance QR codes.",
      icon: Users,
    },
    {
      title: "Instant Multi-Camera Scanner & Live Projector",
      desc: "High-speed camera scanning on laptops, tablets, and smartphones, plus dynamic rotating projector QR codes.",
      icon: ScanLine,
    },
    {
      title: "Automated Continuous Assessment & Analytics",
      desc: "Real-time attendance rates, 10-mark continuous assessment calculation, at-risk flags, and one-click PDF/Excel export.",
      icon: FileBarChart,
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto w-full">
        {/* Header banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
              <Gift className="size-3.5" />
              100% Free & Open Academic Platform
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">University Access & Plan</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Qmark is completely free for all university faculty, lecturers, and students.
            </p>
          </div>
          <Link to={"/dashboard" as string} className="w-full sm:w-auto">
            <Button className="w-full">
              <HomeIcon className="size-4 mr-1.5" />
              Dashboard
            </Button>
          </Link>
        </div>

        {/* Free Plan Status Card */}
        <Card className="border-primary/30 bg-card shadow-sm overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-[#0A1F44] via-[#D4AF37] to-[#0A1F44]" />
          <CardHeader className="p-5 sm:p-6 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-[#D4AF37] shrink-0" />
                  All Features Fully Unlocked
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Account: <span className="font-semibold text-foreground">{user?.email || "Lecturer"}</span>
                </CardDescription>
              </div>
              <Badge className="bg-[#D4AF37] text-white hover:bg-[#AA820A] px-3 py-1 text-xs self-start sm:self-auto">
                <Check className="size-3 mr-1" /> Completely Free Forever
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-0 space-y-6">
            <div className="p-4 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#0A1F44] dark:text-[#D4AF37]/30 text-xs sm:text-sm leading-relaxed">
              <strong>Zero Subscriptions, Zero Fees:</strong> There are no paywalls, recurring charges,
              or trial expiration dates. You have unrestricted access to all current and future attendance
              features for teaching and continuous assessment.
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {perks.map((p, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl border bg-muted/20 flex items-start gap-3"
                >
                  <div className="size-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0 mt-0.5">
                    <p.icon className="size-4" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-semibold text-xs sm:text-sm text-foreground">{p.title}</div>
                    <div className="text-[11px] sm:text-xs text-muted-foreground leading-normal">
                      {p.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3 border-t">
              <Link to={"/sessions" as string} className="w-full sm:w-auto">
                <Button variant="outline" className="w-full text-xs">
                  View Class Sessions
                </Button>
              </Link>
              <Link to={"/scan" as string} className="w-full sm:w-auto">
                <Button className="w-full text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                  <ScanLine className="size-4 mr-1.5" /> Launch Attendance Scanner
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

