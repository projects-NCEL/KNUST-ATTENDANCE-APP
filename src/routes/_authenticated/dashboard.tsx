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
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — KNUST-ATTENDANCE-APP" },
      {
        name: "description",
        content: "Live KNUST-ATTENDANCE-APP dashboard: students, courses, sessions and scan activity at a glance.",
      },
      { property: "og:title", content: "Dashboard — KNUST-ATTENDANCE-APP" },
      {
        property: "og:description",
        content: "Live KNUST-ATTENDANCE-APP dashboard: students, courses, sessions and scan activity at a glance.",
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
    <Card
      className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-in fade-in slide-in-from-bottom-3"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/5 transition-transform duration-500 group-hover:scale-150" />
      <CardContent className="p-5 flex items-center gap-4">
        <div
          className={`size-11 shrink-0 rounded-xl grid place-items-center transition-transform duration-300 group-hover:scale-110 ${tint}`}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
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
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-knust-gradient text-primary-foreground p-4 sm:p-6 md:p-8 mb-6 animate-in fade-in slide-in-from-top-2 duration-500 shadow-md">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 size-40 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider sm:tracking-widest max-w-full">
              <GraduationCap className="size-3.5 shrink-0" />{" "}
              <span className="truncate">University Classroom Management</span>
            </div>
            <h1 className="mt-2.5 sm:mt-3 text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-primary-foreground/85 break-words">
              {user?.email} · {roles.join(", ") || "Tutor"}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto shrink-0">
            <Link to={"/settings" as string} className="w-full sm:w-auto flex-1 sm:flex-initial">
              <Button
                variant="outline"
                className="w-full sm:w-auto justify-center bg-white/10 hover:bg-white/20 text-white border-white/20 font-medium h-10 sm:h-9 text-xs sm:text-sm"
              >
                <Settings className="size-4 mr-1.5" /> Settings
              </Button>
            </Link>
            <Link
              to={"/account" as string}
              className="w-full sm:w-auto flex-1 sm:flex-initial shrink-0"
            >
              <Button
                className="w-full sm:w-auto justify-center bg-white text-[#00381c] hover:bg-emerald-50 font-bold h-10 sm:h-9 text-xs sm:text-sm shadow-md"
              >
                <UserCheck className="size-4 mr-1.5 text-[#00552b]" /> My Account
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
          tint="bg-[#00552b]/10 text-[#00552b] dark:text-emerald-400"
          delay={0}
        />
        <Stat
          icon={BookOpen}
          label="Active Courses"
          value={data?.courses ?? 0}
          tint="bg-emerald-600/15 text-emerald-800 dark:text-emerald-300"
          delay={80}
        />
        <Stat
          icon={CalendarClock}
          label="Total Sessions"
          value={data?.sessions ?? 0}
          tint="bg-[#00381c]/10 text-[#00381c] dark:text-emerald-400"
          delay={160}
        />
        <Stat
          icon={Clock}
          label="Active Semesters"
          value={data?.semesters ?? 1}
          tint="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          delay={240}
        />
      </div>

      {/* Quick Access Actions: Settings & My Account (No other tools shown directly on dashboard) */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {/* Settings Card */}
        <Link
          to={"/settings" as string}
          className="group rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-black p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#00552b] dark:hover:border-emerald-500 hover:shadow-lg animate-in fade-in slide-in-from-bottom-3"
          style={{ animationDelay: "320ms", animationFillMode: "backwards" }}
        >
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#00552b]/10 text-[#00552b] dark:text-emerald-400 transition-colors group-hover:bg-[#00552b] group-hover:text-white">
              <Settings className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-base text-black dark:text-white">Settings</div>
                <span className="text-[11px] font-semibold text-[#00552b] dark:text-emerald-400 px-2.5 py-0.5 rounded-full bg-[#00552b]/10 border border-[#00552b]/20">
                  System
                </span>
              </div>
              <p className="text-xs text-black/60 dark:text-white/60 mt-1 line-clamp-2 leading-relaxed">
                Device limit control, push notification channels, active security sessions, and account options.
              </p>
              <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#00552b] dark:text-emerald-400 group-hover:underline">
                Open Settings <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </div>
        </Link>

        {/* My Account Card - Takes User to My Account Page */}
        <Link
          to={"/account" as string}
          className="group rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-black p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#00552b] dark:hover:border-emerald-500 hover:shadow-lg animate-in fade-in slide-in-from-bottom-3"
          style={{ animationDelay: "380ms", animationFillMode: "backwards" }}
        >
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#00552b]/10 text-[#00552b] dark:text-emerald-400 transition-colors group-hover:bg-[#00552b] group-hover:text-white">
              <UserCheck className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-base text-black dark:text-white">My Account</div>
                <span className="text-[11px] font-semibold text-[#00552b] dark:text-emerald-400 px-2.5 py-0.5 rounded-full bg-[#00552b]/10 border border-[#00552b]/20">
                  Academic Directory
                </span>
              </div>
              <p className="text-xs text-black/60 dark:text-white/60 mt-1 line-clamp-2 leading-relaxed">
                Click here to view your academic tools: Semesters, Departments, Courses, Academic History, Students & more.
              </p>
              <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#00552b] dark:text-emerald-400 group-hover:underline">
                Open My Account <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </div>
        </Link>
      </div>

      <Card className="mt-8 border-primary/20 bg-card shadow-sm animate-in fade-in duration-700">
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <CheckCircle2 className="size-5 text-primary" />
              Quick 4-Step QRoll Workflow Guide
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Follow these simple steps to manage your classroom attendance from start to finish.
            </p>
          </div>
          <Link to={"/manual" as string}>
            <Button variant="outline" size="sm" className="text-xs shrink-0">
              <HelpCircle className="size-3.5 mr-1" /> Full Manual
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div className="rounded-lg border bg-muted/30 p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </span>
              Courses & Terms
            </div>
            <p className="text-xs text-muted-foreground">
              Define your academic departments and course codes under <b>Courses</b>. Set up the
              current semester.
            </p>
            <Link
              to={"/courses" as string}
              className="text-xs text-primary hover:underline font-medium inline-block pt-1"
            >
              Go to Courses &rarr;
            </Link>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                2
              </span>
              Add Students & QRs
            </div>
            <p className="text-xs text-muted-foreground">
              Import student rosters via Excel or add individually. Every student receives a
              printable, scannable QR card.
            </p>
            <Link
              to={"/students" as string}
              className="text-xs text-primary hover:underline font-medium inline-block pt-1"
            >
              Go to Students &rarr;
            </Link>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                3
              </span>
              Launch & Scan
            </div>
            <p className="text-xs text-muted-foreground">
              Open a session: Project the session QR for student check-in, or scan student ID QR
              cards with the camera scanner.
            </p>
            <Link
              to={"/sessions" as string}
              className="text-xs text-primary hover:underline font-medium inline-block pt-1"
            >
              Go to Sessions &rarr;
            </Link>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                4
              </span>
              Export Reports
            </div>
            <p className="text-xs text-muted-foreground">
              View attendance rates, 10-mark grades, and at-risk students. Download clean Excel
              sheets or formatted PDF reports.
            </p>
            <Link
              to={"/reports" as string}
              className="text-xs text-primary hover:underline font-medium inline-block pt-1"
            >
              Go to Reports &rarr;
            </Link>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
