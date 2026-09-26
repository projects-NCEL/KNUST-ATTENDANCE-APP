import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { firebaseAuth, firestoreDb } from "@/integrations/firebase/config";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  BookOpen,
  CalendarClock,
  Clock,
  QrCode,
  FileSpreadsheet,
  ArrowRight,
  GraduationCap,
  HelpCircle,
  CheckCircle2,
  Settings,
  Building2,
  CalendarRange,
  History,
  Megaphone,
  ClipboardList,
  CreditCard,
  FileText,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Faculty Dashboard — Qmark" },
      {
        name: "description",
        content: "Live Qmark dashboard: students, courses, sessions and scan activity at a glance.",
      },
      { property: "og:title", content: "Dashboard — Qmark" },
      {
        property: "og:description",
        content: "Live Qmark dashboard: students, courses, sessions and scan activity at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Stat({
  icon: Icon,
  label,
  value,
  tint,
  delay,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  tint: string;
  delay: number;
}) {
  return (
    <div
      className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-gold rounded-3xl glass-card border border-[#D4AF37]/30 animate-in fade-in slide-in-from-bottom-3"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-[#D4AF37]/10 transition-transform duration-500 group-hover:scale-150" />
      <div className="p-4 sm:p-5 flex items-center gap-3.5 relative z-10">
        <div
          className={`size-12 shrink-0 rounded-2xl grid place-items-center transition-transform duration-300 group-hover:scale-110 shadow-sm ${tint}`}
        >
          <Icon className="size-5.5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold tabular-nums text-foreground tracking-tight">{value}</div>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user, roles } = useAuth();
  const currentUid = user?.id || firebaseAuth.currentUser?.uid;

  const [stats, setStats] = useState({
    students: 0,
    courses: 0,
    sessions: 0,
    semesters: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentUid) {
      setIsLoading(false);
      return;
    }

    let loadedParts = 0;
    const markLoaded = () => {
      loadedParts++;
      if (loadedParts >= 2) setIsLoading(false);
    };

    // Real-time listener for students
    const unsubStudents = onSnapshot(
      query(collection(firestoreDb, "students"), where("owner_id", "==", currentUid)),
      (snap) => {
        setStats((prev) => ({ ...prev, students: snap.size }));
        markLoaded();
      },
      (err) => {
        console.warn("Students stats listener error:", err);
        markLoaded();
      },
    );

    // Real-time listener for courses (active only)
    const unsubCourses = onSnapshot(
      query(collection(firestoreDb, "courses"), where("owner_id", "==", currentUid)),
      (snap) => {
        const active = snap.docs.filter((d) => !(d.data() as any).archived).length;
        setStats((prev) => ({ ...prev, courses: active }));
        markLoaded();
      },
      (err) => {
        console.warn("Courses stats listener error:", err);
        markLoaded();
      },
    );

    // Real-time listener for attendance sessions
    const unsubSessions = onSnapshot(
      query(collection(firestoreDb, "attendance_sessions"), where("owner_id", "==", currentUid)),
      (snap) => {
        setStats((prev) => ({ ...prev, sessions: snap.size }));
        markLoaded();
      },
      (err) => {
        console.warn("Sessions stats listener error:", err);
        markLoaded();
      },
    );

    // Real-time listener for academic terms (current only)
    const unsubTerms = onSnapshot(
      query(collection(firestoreDb, "academic_terms"), where("owner_id", "==", currentUid)),
      (snap) => {
        const currentTerms = snap.docs.filter((d) => (d.data() as any).is_current).length;
        setStats((prev) => ({ ...prev, semesters: currentTerms }));
        markLoaded();
      },
      (err) => {
        console.warn("Terms stats listener error:", err);
        markLoaded();
      },
    );

    return () => {
      unsubStudents();
      unsubCourses();
      unsubSessions();
      unsubTerms();
    };
  }, [currentUid]);

  const data = stats;

  return (
    <AppShell>
      {/* Hero Header Card - Glassmorphism & Gold Glow */}
      <section className="relative overflow-hidden rounded-3xl glass-card border border-[#D4AF37]/35 p-5 sm:p-7 md:p-8 mb-6 animate-in fade-in slide-in-from-top-2 duration-500 shadow-card">
        <div className="pointer-events-none absolute -right-16 -top-16 size-60 rounded-full bg-[#D4AF37]/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 size-48 rounded-full bg-[#0A1F44]/10 dark:bg-[#0A1F44]/40 blur-2xl" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#D4AF37]/15 text-[#0A1F44] dark:text-[#D4AF37] border border-[#D4AF37]/30 px-3 py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider max-w-full">
              <GraduationCap className="size-3.5 shrink-0 text-[#D4AF37]" />{" "}
              <span className="truncate">Qmark Attendance Engine</span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground break-words">
              {user?.email} · <span className="font-semibold text-[#D4AF37]">{roles.join(", ") || "Faculty Lecturer"}</span>
            </p>
          </div>
          <div className="flex items-stretch sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto shrink-0">
            <Link
              to={"/account" as string}
              className="w-full sm:w-auto shrink-0"
            >
              <Button
                className="w-full sm:w-auto justify-center bg-[#0A1F44] dark:bg-[#D4AF37] text-white dark:text-[#0A1F44] hover:opacity-95 font-bold h-10 sm:h-9 text-xs sm:text-sm shadow-md px-5 rounded-full border border-[#D4AF37]/40"
              >
                <UserCheck className="size-4 mr-1.5 text-[#D4AF37] dark:text-[#0A1F44]" /> My Account & Settings
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats - Strictly White, Black & Shades of Green */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          icon={Users}
          label="Total Students"
          value={data?.students ?? 0}
          tint="bg-[#D4AF37]/10 text-[#D4AF37] dark:text-[#D4AF37]"
          delay={0}
        />
        <Stat
          icon={BookOpen}
          label="Active Courses"
          value={data?.courses ?? 0}
          tint="bg-[#D4AF37]/15 text-[#0A1F44] dark:text-[#D4AF37]"
          delay={80}
        />
        <Stat
          icon={CalendarClock}
          label="Total Sessions"
          value={data?.sessions ?? 0}
          tint="bg-[#0A1F44]/10 text-[#0A1F44] dark:text-[#D4AF37]"
          delay={160}
        />
        <Stat
          icon={Clock}
          label="Active Semesters"
          value={data?.semesters ?? 1}
          tint="bg-[#D4AF37]/15 text-[#AA820A] dark:text-[#D4AF37]"
          delay={240}
        />
      </div>

      {/* Quick Access: Students, Courses & My Account Hub */}
      <div className="mt-6 space-y-3">
        {/* Quick Access: Students & Courses Primary Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to={"/students" as string}
            className="group relative flex items-center justify-between p-5 rounded-3xl glass-card border border-[#D4AF37]/30 hover:border-[#D4AF37] hover:shadow-gold transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: "280ms", animationFillMode: "backwards" }}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#D4AF37]/15 text-[#D4AF37] transition-all group-hover:bg-[#D4AF37] group-hover:text-[#0A1F44] shadow-sm">
                <Users className="size-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base text-foreground">Students</span>
                  <span className="text-[10px] font-bold text-[#D4AF37] px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30">
                    Directory
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-1">
                  Manage roster, search index numbers & QR attendance passes
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-bold text-[#D4AF37] shrink-0 ml-2">
              Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            to={"/courses" as string}
            className="group relative flex items-center justify-between p-5 rounded-3xl glass-card border border-[#D4AF37]/30 hover:border-[#D4AF37] hover:shadow-gold transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: "300ms", animationFillMode: "backwards" }}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#0A1F44]/15 dark:bg-[#D4AF37]/15 text-[#0A1F44] dark:text-[#D4AF37] transition-all group-hover:bg-[#D4AF37] group-hover:text-[#0A1F44] shadow-sm">
                <BookOpen className="size-6 text-[#D4AF37]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base text-foreground">Courses</span>
                  <span className="text-[10px] font-bold text-[#D4AF37] px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30">
                    Classes
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-1">
                  Manage course codes, class enrollments & lecture schedules
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-bold text-[#D4AF37] shrink-0 ml-2">
              Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>

        {/* Quick Access: My Account Hub */}
        <Link
          to={"/account" as string}
          className="group block rounded-3xl glass-card border border-[#D4AF37]/30 hover:border-[#D4AF37] hover:shadow-gold p-6 transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-3"
          style={{ animationDelay: "320ms", animationFillMode: "backwards" }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="grid size-13 shrink-0 place-items-center rounded-2xl bg-[#D4AF37]/15 text-[#D4AF37] transition-all group-hover:bg-[#D4AF37] group-hover:text-[#0A1F44] shadow-sm">
                <UserCheck className="size-6.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-extrabold text-base sm:text-lg text-foreground">My Account & Academic Directory</div>
                  <span className="text-[11px] font-bold text-[#D4AF37] px-3 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30">
                    Faculty Hub
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                  Click here to access your academic tools: Semesters, Departments, Courses, Academic History, Students Directory, and embedded Account Settings.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#D4AF37] group-hover:underline self-end sm:self-center shrink-0">
              Open My Account <ArrowRight className="size-4.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </Link>
      </div>

      {/* Faculty Readiness Progress Bar (Inspired by Gemini iOS 46) */}
      <div className="mt-8 rounded-3xl glass-card border border-[#D4AF37]/30 p-5 sm:p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30">
                Setup Progress
              </span>
              <span className="text-xs font-semibold text-muted-foreground">Step 2 of 3 Ready</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-foreground mt-1">
              Faculty Readiness Checklist
            </h3>
          </div>
          <Link to={"/sessions" as string}>
            <Button size="sm" className="bg-[#0A1F44] dark:bg-[#D4AF37] text-white dark:text-[#0A1F44] font-bold rounded-full text-xs border border-[#D4AF37]/30 shadow-sm">
              Launch Live Session
            </Button>
          </Link>
        </div>

        <div className="h-2 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden mb-5">
          <div className="h-full bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#D4AF37] rounded-full w-2/3" />
        </div>

        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="size-6 rounded-full bg-[#D4AF37] text-[#0A1F44] grid place-items-center font-bold text-xs">
                ✓
              </div>
              <span className="font-semibold text-foreground">Faculty Account Active</span>
            </div>
            <span className="text-[10px] font-bold text-[#D4AF37]">Verified</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="size-6 rounded-full bg-[#D4AF37] text-[#0A1F44] grid place-items-center font-bold text-xs">
                ✓
              </div>
              <span className="font-semibold text-foreground">{data.courses} Active Courses</span>
            </div>
            <span className="text-[10px] font-bold text-[#D4AF37]">Enrolled</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="size-6 rounded-full bg-black/20 dark:bg-white/20 text-muted-foreground grid place-items-center font-bold text-xs">
                3
              </div>
              <span className="font-semibold text-foreground">Start Live Roll-Call</span>
            </div>
            <Link to={"/sessions" as string} className="text-[10px] font-bold text-[#D4AF37] hover:underline">
              Start &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* 4-Step Attendance Workflow Guide in Glass Card */}
      <div className="mt-6 rounded-3xl glass-card border border-[#D4AF37]/30 shadow-card overflow-hidden">
        <div className="p-5 sm:p-6 pb-4 border-b border-border/60 flex flex-row items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold flex items-center gap-2 text-foreground">
              <CheckCircle2 className="size-5 text-[#D4AF37]" />
              Quick 4-Step Attendance Workflow Guide
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Simple walkthrough to manage your classroom attendance seamlessly.
            </p>
          </div>
          <Link to={"/manual" as string}>
            <Button variant="outline" size="sm" className="text-xs rounded-full border-[#D4AF37]/30 hover:border-[#D4AF37]">
              <HelpCircle className="size-3.5 mr-1 text-[#D4AF37]" /> Full Manual
            </Button>
          </Link>
        </div>
        <div className="p-5 sm:p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div className="rounded-2xl p-4 bg-black/5 dark:bg-white/5 border border-border/50 space-y-1.5 transition-all hover:border-[#D4AF37]/50">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <span className="grid size-6 place-items-center rounded-full bg-[#0A1F44] dark:bg-[#D4AF37] text-white dark:text-[#0A1F44] text-xs font-bold">
                1
              </span>
              Courses & Terms
            </div>
            <p className="text-xs text-muted-foreground">
              Define academic departments and course codes under <b>Courses</b>. Set up active semester.
            </p>
            <Link
              to={"/courses" as string}
              className="text-xs text-[#D4AF37] hover:underline font-bold inline-block pt-1"
            >
              Go to Courses &rarr;
            </Link>
          </div>

          <div className="rounded-2xl p-4 bg-black/5 dark:bg-white/5 border border-border/50 space-y-1.5 transition-all hover:border-[#D4AF37]/50">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <span className="grid size-6 place-items-center rounded-full bg-[#0A1F44] dark:bg-[#D4AF37] text-white dark:text-[#0A1F44] text-xs font-bold">
                2
              </span>
              Add Students & QRs
            </div>
            <p className="text-xs text-muted-foreground">
              Import student rosters via Excel or add individually. Every student receives a printable QR card.
            </p>
            <Link
              to={"/students" as string}
              className="text-xs text-[#D4AF37] hover:underline font-bold inline-block pt-1"
            >
              Go to Students &rarr;
            </Link>
          </div>

          <div className="rounded-2xl p-4 bg-black/5 dark:bg-white/5 border border-border/50 space-y-1.5 transition-all hover:border-[#D4AF37]/50">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <span className="grid size-6 place-items-center rounded-full bg-[#0A1F44] dark:bg-[#D4AF37] text-white dark:text-[#0A1F44] text-xs font-bold">
                3
              </span>
              Launch & Scan
            </div>
            <p className="text-xs text-muted-foreground">
              Open a session: Project the session QR for student check-in, or scan student ID QR cards with camera.
            </p>
            <Link
              to={"/sessions" as string}
              className="text-xs text-[#D4AF37] hover:underline font-bold inline-block pt-1"
            >
              Go to Sessions &rarr;
            </Link>
          </div>

          <div className="rounded-2xl p-4 bg-black/5 dark:bg-white/5 border border-border/50 space-y-1.5 transition-all hover:border-[#D4AF37]/50">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <span className="grid size-6 place-items-center rounded-full bg-[#0A1F44] dark:bg-[#D4AF37] text-white dark:text-[#0A1F44] text-xs font-bold">
                4
              </span>
              Export Reports
            </div>
            <p className="text-xs text-muted-foreground">
              View attendance rates, 10-mark continuous assessment grades, and export clean Excel or PDF records.
            </p>
            <Link
              to={"/reports" as string}
              className="text-xs text-[#D4AF37] hover:underline font-bold inline-block pt-1"
            >
              Go to Reports &rarr;
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
