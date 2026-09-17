import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  UserCheck,
  CalendarRange,
  Building2,
  BookOpen,
  History,
  Users,
  QrCode,
  Megaphone,
  ClipboardList,
  CalendarClock,
  ScanLine,
  FileBarChart,
  Settings,
  CreditCard,
  HelpCircle,
  FileText,
  Shield,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My Account & Academic Directory — KNUST-ATTENDANCE-APP" },
      {
        name: "description",
        content: "Access academic tools, semesters, departments, courses, student records and system settings.",
      },
    ],
  }),
  component: AccountPage,
});

// Grouped sections for clean hierarchy, strictly styled in white, black, and different shades of green
const ACCOUNT_SECTIONS = [
  {
    category: "Academic Structure & Terms",
    description: "Manage university faculties, course curricula, and semester schedules.",
    items: [
      {
        to: "/semesters",
        label: "Semesters",
        desc: "Configure academic terms, examination periods & active semester status.",
        icon: CalendarRange,
      },
      {
        to: "/departments",
        label: "Departments",
        desc: "Academic faculties, departmental units, and institutional programme codes.",
        icon: Building2,
      },
      {
        to: "/courses",
        label: "Courses",
        desc: "Course syllabi, credit weighting, class cohorts, and assigned lecturers.",
        icon: BookOpen,
      },
      {
        to: "/history",
        label: "Academic History",
        desc: "Past semester attendance archives, audit logs, and historical student records.",
        icon: History,
      },
    ],
  },
  {
    category: "Students & Self-Registration",
    description: "Student rosters, biometric identification, and token registration links.",
    items: [
      {
        to: "/students",
        label: "Students Directory",
        desc: "Enrolled student rosters, index numbers, and printable scannable QR cards.",
        icon: Users,
      },
      {
        to: "/portal-links",
        label: "Student Registration",
        desc: "Generate self-service registration tokens and links for students.",
        icon: QrCode,
      },
    ],
  },
  {
    category: "Classroom Operations & Attendance",
    description: "Live classroom sessions, camera scanning, and mark compilation.",
    items: [
      {
        to: "/sessions",
        label: "Class Sessions",
        desc: "Launch attendance windows, live check-in QR codes, and roster verification.",
        icon: CalendarClock,
      },
      {
        to: "/scan",
        label: "QR Scanner",
        desc: "Camera-based ID card scanner for instant lecture hall check-ins.",
        icon: ScanLine,
      },
      {
        to: "/reports",
        label: "Attendance Reports",
        desc: "Export 10-mark attendance records, PDF grade sheets, and Excel analytics.",
        icon: FileBarChart,
      },
    ],
  },
  {
    category: "Class Announcements & Coursework",
    description: "Broadcast messaging channels and task distribution.",
    items: [
      {
        to: "/announcements",
        label: "Announcements & Tasks",
        desc: "Broadcast classroom notices, schedule changes, and priority alerts.",
        icon: Megaphone,
      },
      {
        to: "/assignments",
        label: "Assignments",
        desc: "Publish homework deadlines, project guidelines, and track submissions.",
        icon: ClipboardList,
      },
    ],
  },
  {
    category: "System Settings & Institutional Info",
    description: "Account configuration, security limits, billing plans, and documentation.",
    items: [
      {
        to: "/settings",
        label: "System Settings",
        desc: "Device limit controls, push notification channels, and active login sessions.",
        icon: Settings,
      },
      {
        to: "/billing",
        label: "Billing & Plans",
        desc: "Subscription status, SMS credit balance, and official payment receipts.",
        icon: CreditCard,
      },
      {
        to: "/manual",
        label: "User Manual",
        desc: "Complete step-by-step documentation, scanner guides, and tutor FAQs.",
        icon: HelpCircle,
      },
      {
        to: "/terms",
        label: "Terms of Service",
        desc: "Institutional usage terms, academic compliance, and user agreements.",
        icon: FileText,
      },
      {
        to: "/privacy",
        label: "Privacy Policy",
        desc: "Data protection standards and student biometric privacy compliance.",
        icon: Shield,
      },
    ],
  },
];

function AccountPage() {
  const { user, roles, isAdmin } = useAuth();
  const primaryRole = roles[0] || (isAdmin ? "Administrator" : "Lecturer");

  return (
    <AppShell>
      <div className="space-y-8 animate-in fade-in duration-400">
        {/* Profile & Account Banner - Strictly Green, White, and Black */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#00381c] via-[#00552b] to-[#007a3d] text-white p-6 sm:p-8 shadow-md border border-[#00381c]">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 size-40 rounded-full bg-white/5 blur-2xl" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4 min-w-0">
              <div className="size-16 sm:size-20 rounded-2xl bg-white/10 border-2 border-white/20 p-1 flex items-center justify-center shrink-0 shadow-lg text-white">
                <UserCheck className="size-8 sm:size-10 text-emerald-200" />
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-0.5 text-[11px] font-semibold tracking-wider uppercase text-emerald-100 border border-white/20">
                  <ShieldCheck className="size-3.5" />
                  <span>Verified Academic Account</span>
                </div>
                <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white truncate">
                  My Account
                </h1>
                <p className="mt-1 text-sm text-emerald-100/90 font-mono truncate">
                  {user?.email || "Academic User"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 md:pt-0">
              <div className="px-3.5 py-2 rounded-xl bg-black/25 border border-white/15 backdrop-blur-xs text-left">
                <div className="text-[10px] uppercase font-semibold text-emerald-200 tracking-wider">
                  Assigned Role
                </div>
                <div className="text-sm font-bold text-white capitalize">{primaryRole}</div>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-black/25 border border-white/15 backdrop-blur-xs text-left">
                <div className="text-[10px] uppercase font-semibold text-emerald-200 tracking-wider">
                  Access Level
                </div>
                <div className="text-sm font-bold text-white">
                  {isAdmin ? "Full Admin" : "Faculty Tutor"}
                </div>
              </div>
              <Link to={"/settings" as string}>
                <Button
                  variant="secondary"
                  className="bg-white text-[#00381c] hover:bg-emerald-50 border-0 font-semibold shadow-xs"
                >
                  <Settings className="size-4 mr-1.5 text-[#00552b]" /> Security & Settings
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Directory Sections */}
        <div className="space-y-8">
          {ACCOUNT_SECTIONS.map((section, sIndex) => (
            <div key={section.category} className="space-y-3.5">
              <div className="border-b border-black/10 dark:border-white/10 pb-2">
                <h2 className="text-lg font-bold tracking-tight text-black dark:text-white flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[#00552b] dark:bg-emerald-400" />
                  {section.category}
                </h2>
                <p className="text-xs text-black/65 dark:text-white/65 mt-0.5">
                  {section.description}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {section.items.map((item, iIndex) => (
                  <Link
                    key={item.to}
                    to={item.to as string}
                    className="group rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-black p-4 transition-all duration-200 hover:-translate-y-1 hover:border-[#00552b] dark:hover:border-emerald-500 hover:shadow-lg hover:shadow-[#00552b]/5 relative overflow-hidden"
                    style={{
                      animationDelay: `${(sIndex * 4 + iIndex) * 30}ms`,
                    }}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="size-11 shrink-0 rounded-xl bg-[#00552b]/10 dark:bg-emerald-950/50 text-[#00552b] dark:text-emerald-400 border border-[#00552b]/20 dark:border-emerald-800/40 grid place-items-center transition-all duration-300 group-hover:bg-[#00552b] group-hover:text-white group-hover:scale-105">
                        <item.icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-sm text-black dark:text-white truncate group-hover:text-[#00552b] dark:group-hover:text-emerald-400 transition-colors">
                            {item.label}
                          </span>
                          <ArrowRight className="size-4 shrink-0 text-black/40 dark:text-white/40 transition-transform group-hover:translate-x-1 group-hover:text-[#00552b] dark:group-hover:text-emerald-400" />
                        </div>
                        <p className="text-xs text-black/60 dark:text-white/60 mt-1 line-clamp-2 leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
