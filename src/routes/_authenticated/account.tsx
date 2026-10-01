import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { linkWithPopup, unlink } from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/integrations/firebase/config";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
  Link2,
  CheckCircle2,
  Laptop,
  Smartphone,
  Tablet,
  Trash2,
  RefreshCw,
  Info,
} from "lucide-react";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import {
  getUserDevices,
  revokeDevice,
  revokeOtherDevices,
  getDeviceId,
  type UserDevice,
  MAX_DEVICES_PER_ACCOUNT,
} from "@/lib/device-manager";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My Account & Academic Directory — Qmark" },
      {
        name: "description",
        content: "Access academic tools, semesters, departments, courses, student records, and embedded account settings.",
      },
    ],
  }),
  component: AccountPage,
});

type Identity = { provider: string; email?: string };

// Grouped sections for clean hierarchy, strictly styled in white, black, and shades of green
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
    category: "Students Directory & Enrollment",
    description: "Student rosters, promotion roll-overs, and student portal access links.",
    items: [
      {
        to: "/students",
        label: "Students Directory",
        desc: "Enrolled student rosters, index numbers, and printable scannable QR cards.",
        icon: Users,
      },
      {
        to: "/promotion",
        label: "Student Promotion",
        desc: "Batch advance classes to next levels with student repeater retention.",
        icon: GraduationCap,
      },
      {
        to: "/portal-links",
        label: "Student Portal & Links",
        desc: "Shareable portal URLs and QR codes for student attendance cards and lecture check-ins.",
        icon: Link2,
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
        desc: "Broadcast classroom notices, schedule changes, coursework tasks, and priority alerts.",
        icon: Megaphone,
      },
    ],
  },
  {
    category: "Institutional Info & Documentation",
    description: "Documentation and compliance agreements.",
    items: [
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
  const settingsSectionRef = useRef<HTMLDivElement>(null);

  // Settings state embedded in My Account
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "academic" | "students" | "classroom" | "institution" | "settings"
  >("academic");
  const currentDeviceId = getDeviceId();

  const fetchDevices = async () => {
    if (!user?.id) return;
    setLoadingDevices(true);
    try {
      const list = await getUserDevices(user.id);
      setDevices(list);
    } catch (err) {
      console.error("Error fetching devices:", err);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleRevokeDevice = async (d: UserDevice) => {
    if (d.device_id === currentDeviceId) {
      if (!confirm("Are you sure you want to sign out this device?")) return;
    }
    setRevokingId(d.id);
    try {
      await revokeDevice(d.id);
      toast.success(`Revoked ${d.device_name}`);
      await fetchDevices();
      if (d.device_id === currentDeviceId) {
        localStorage.removeItem("qroll_active_gateway");
        localStorage.removeItem("qroll_lecturer_logged_in");
        localStorage.setItem("qroll_logged_out", "true");
        await firebaseAuth.signOut();
        window.location.href = "/";
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to revoke device");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    if (!user?.id) return;
    if (
      !confirm("Revoke all other logged-in sessions? You will stay logged in only on this device.")
    )
      return;
    setLoadingDevices(true);
    try {
      await revokeOtherDevices(user.id, currentDeviceId);
      toast.success("All other device sessions revoked.");
      await fetchDevices();
    } catch (err: any) {
      toast.error(err?.message || "Failed to revoke other devices");
    } finally {
      setLoadingDevices(false);
    }
  };

  const refreshIdentities = () => {
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser) return;
    const ids: Identity[] = (fbUser.providerData || []).map((p) => ({
      provider:
        p.providerId === "google.com"
          ? "google"
          : p.providerId === "password"
            ? "email"
            : p.providerId,
      email: p.email || undefined,
    }));
    setIdentities(ids);
  };

  useEffect(() => {
    refreshIdentities();
    void fetchDevices();

    // Check if hash has #settings
    if (typeof window !== "undefined" && window.location.hash === "#settings") {
      setTimeout(() => {
        settingsSectionRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [user?.id]);

  const hasGoogle =
    user?.provider === "google" ||
    identities.some((i) => i.provider === "google" || i.provider === "google.com");

  const hasPassword = identities.some((i) => i.provider === "email" || i.provider === "password");

  const linkGoogle = async () => {
    const current = firebaseAuth.currentUser;
    if (!current) return;
    setBusy(true);
    try {
      await linkWithPopup(current, googleProvider);
      toast.success("Google account linked successfully!");
      refreshIdentities();
    } catch (e: any) {
      toast.error(e?.message || "Could not link Google account");
    } finally {
      setBusy(false);
    }
  };

  const unlinkGoogle = async () => {
    const current = firebaseAuth.currentUser;
    if (!current) return;
    setBusy(true);
    try {
      await unlink(current, "google.com");
      toast.success("Google unlinked");
      refreshIdentities();
    } catch (e: any) {
      toast.error(e?.message || "Could not unlink Google");
    } finally {
      setBusy(false);
    }
  };

  const scrollToSettings = () => {
    setActiveTab("settings");
    settingsSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <AppShell>
      <div className="space-y-8 animate-in fade-in duration-400">
        {/* Profile & Account Banner - High-End Professional Glassmorphism & Gold Brilliance */}
        <section
          className="relative overflow-hidden rounded-[32px] p-6 sm:p-8 backdrop-blur-2xl bg-white/70 dark:bg-[#0A1F44]/75 border-2 border-[#D4AF37]/50 shadow-[0_20px_50px_-10px_rgba(10,31,68,0.15),0_0_0_1px_rgba(212,175,55,0.25)] transition-all duration-300"
        >
          {/* Subtle multi-layer ambient glows and reflection highlights */}
          <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-[#D4AF37]/20 dark:bg-[#D4AF37]/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-12 -bottom-12 size-52 rounded-full bg-[#0A1F44]/10 dark:bg-[#0B1D3A]/60 blur-2xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/80 to-transparent" />

          <div className="relative flex flex-col gap-6">
            {/* Top row: Avatar (Gmail profile photo or gold-ringed user emblem), Verified Badge, Account Title & User Email */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
              <div className="flex items-center gap-4 sm:gap-5 min-w-0">
                {/* Circular Gold-Ringed Avatar with Real Glass Backing */}
                <div className="relative size-16 sm:size-20 rounded-full p-1 ring-2 ring-[#D4AF37] bg-white/90 dark:bg-[#0B1D3A]/90 backdrop-blur-md flex items-center justify-center shrink-0 shadow-[0_8px_20px_rgba(212,175,55,0.25)]">
                  {user?.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url as string}
                      alt={user.user_metadata.full_name || user.email || "Account avatar"}
                      className="size-full rounded-full object-cover shadow-inner"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="size-full rounded-full bg-gradient-to-br from-[#0A1F44] to-[#112A59] dark:from-[#061226] dark:to-[#0A1F44] flex items-center justify-center text-[#D4AF37] font-extrabold text-xl sm:text-2xl shadow-inner uppercase tracking-wider">
                      {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || "P"}
                    </div>
                  )}
                  {/* Active online status badge */}
                  <span className="absolute bottom-0 right-0 size-4 sm:size-4.5 rounded-full bg-[#10B981] ring-2 ring-white dark:ring-[#0A1F44] shadow-xs" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#D4AF37]/15 dark:bg-[#D4AF37]/20 px-3 py-0.5 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-[#854d0e] dark:text-[#D4AF37] border border-[#D4AF37]/40 shadow-2xs">
                    <ShieldCheck className="size-3.5 shrink-0 text-[#D4AF37]" />
                    <span className="truncate">Verified Faculty Account</span>
                  </div>
                  <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0A1F44] dark:text-white truncate">
                    {user?.user_metadata?.full_name || "Faculty Account"}
                  </h1>
                  <p className="mt-0.5 text-xs sm:text-sm text-neutral-600 dark:text-[#F5E5A3] font-mono font-medium truncate">
                    {user?.email || "Academic User"}
                  </p>
                </div>
              </div>

              {/* Quick Settings Shortcut button */}
              <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                <Button
                  variant="secondary"
                  onClick={scrollToSettings}
                  className="rounded-full bg-[#0A1F44] dark:bg-[#D4AF37] text-white dark:text-[#0A1F44] hover:bg-[#112A59] dark:hover:bg-[#F3E5AB] font-bold shadow-md cursor-pointer h-10 px-5 text-xs sm:text-sm transition-all hover:scale-105"
                >
                  <Settings className="size-4 mr-2 shrink-0" /> Manage Security
                </Button>
              </div>
            </div>

            {/* Bottom/Secondary row: Role, Access Level & Institutional Standing Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3.5 pt-3 border-t border-[#D4AF37]/25">
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-md border border-[#D4AF37]/30 shadow-xs text-left">
                <div className="text-[10px] uppercase font-bold text-[#854d0e] dark:text-[#D4AF37] tracking-wider">
                  Assigned Role
                </div>
                <div className="text-xs sm:text-sm font-bold text-[#0A1F44] dark:text-white capitalize truncate mt-0.5">
                  {primaryRole}
                </div>
              </div>
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-md border border-[#D4AF37]/30 shadow-xs text-left">
                <div className="text-[10px] uppercase font-bold text-[#854d0e] dark:text-[#D4AF37] tracking-wider">
                  Access Level
                </div>
                <div className="text-xs sm:text-sm font-bold text-[#0A1F44] dark:text-white truncate mt-0.5">
                  {isAdmin ? "Full Administrator" : "Academic Lecturer"}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1 p-3 sm:p-3.5 rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-md border border-[#D4AF37]/30 shadow-xs text-left">
                <div className="text-[10px] uppercase font-bold text-[#854d0e] dark:text-[#D4AF37] tracking-wider">
                  Device Sessions
                </div>
                <div className="text-xs sm:text-sm font-bold text-[#0A1F44] dark:text-white truncate mt-0.5">
                  {devices.length} / {MAX_DEVICES_PER_ACCOUNT} Connected
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* View Selection Filter Tabs — Grouped Cleanly (No long "All Tools" scroll) */}
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-[#D4AF37]/20 pb-2">
          <div className="flex items-center gap-2 min-w-max">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab("academic")}
              className={`rounded-full text-xs font-semibold px-4 py-2 shrink-0 whitespace-nowrap cursor-pointer transition-all ${
                activeTab === "academic"
                  ? "bg-[#0A1F44] dark:bg-[#D4AF37] text-white dark:text-[#0A1F44] font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <CalendarRange className="size-3.5 mr-1.5" /> Academic Structure
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab("students")}
              className={`rounded-full text-xs font-semibold px-4 py-2 shrink-0 whitespace-nowrap cursor-pointer transition-all ${
                activeTab === "students"
                  ? "bg-[#0A1F44] dark:bg-[#D4AF37] text-white dark:text-[#0A1F44] font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Users className="size-3.5 mr-1.5" /> Students & Enrollment
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab("classroom")}
              className={`rounded-full text-xs font-semibold px-4 py-2 shrink-0 whitespace-nowrap cursor-pointer transition-all ${
                activeTab === "classroom"
                  ? "bg-[#0A1F44] dark:bg-[#D4AF37] text-white dark:text-[#0A1F44] font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <CalendarClock className="size-3.5 mr-1.5" /> Classroom Operations
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab("institution")}
              className={`rounded-full text-xs font-semibold px-4 py-2 shrink-0 whitespace-nowrap cursor-pointer transition-all ${
                activeTab === "institution"
                  ? "bg-[#0A1F44] dark:bg-[#D4AF37] text-white dark:text-[#0A1F44] font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Building2 className="size-3.5 mr-1.5" /> Institutional & Docs
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab("settings")}
              className={`rounded-full text-xs font-semibold px-4 py-2 shrink-0 whitespace-nowrap cursor-pointer transition-all ${
                activeTab === "settings"
                  ? "bg-[#0A1F44] dark:bg-[#D4AF37] text-white dark:text-[#0A1F44] font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Settings className="size-3.5 mr-1.5" /> Settings & Security
            </Button>
          </div>
        </div>

        {/* Grouped Academic Directory Sections by selected category */}
        {activeTab !== "settings" && (
          <div className="space-y-6">
            {ACCOUNT_SECTIONS.filter((section) => {
              if (activeTab === "academic") return section.category.includes("Academic");
              if (activeTab === "students") return section.category.includes("Students");
              if (activeTab === "classroom")
                return (
                  section.category.includes("Classroom") ||
                  section.category.includes("Announcements")
                );
              if (activeTab === "institution")
                return section.category.includes("Institutional");
              return true;
            }).map((section, sIndex) => (
              <div key={section.category} className="space-y-3.5">
                <div className="border-b border-[#D4AF37]/20 pb-2">
                  <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                    <span className="size-2 rounded-full bg-[#D4AF37]" />
                    {section.category}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {section.description}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {section.items.map((item, iIndex) => (
                    <Link
                      key={item.to}
                      to={item.to as string}
                      className="group rounded-2xl border border-[#D4AF37]/25 glass-card p-4 transition-all duration-200 hover:-translate-y-1 hover:border-[#D4AF37] hover:shadow-gold relative overflow-hidden"
                      style={{
                        animationDelay: `${(sIndex * 4 + iIndex) * 30}ms`,
                      }}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="size-11 shrink-0 rounded-xl bg-[#D4AF37]/10 dark:bg-[#0A1F44]/70 text-[#D4AF37] border border-[#D4AF37]/30 grid place-items-center transition-all duration-300 group-hover:bg-[#D4AF37] group-hover:text-[#0A1F44] group-hover:scale-105">
                          <item.icon className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-sm text-foreground truncate group-hover:text-[#D4AF37] transition-colors">
                              {item.label}
                            </span>
                            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-[#D4AF37]" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
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
        )}

        {/* Embedded Settings & Security Section */}
        {activeTab === "settings" && (
          <div ref={settingsSectionRef} id="settings" className="space-y-6 pt-4">
            <div className="border-b border-black/10 dark:border-white/10 pb-2">
              <h2 className="text-xl font-bold tracking-tight text-black dark:text-white flex items-center gap-2">
                <Settings className="size-5 text-[#D4AF37] dark:text-[#D4AF37]" />
                Account Settings & Security
              </h2>
              <p className="text-xs text-black/65 dark:text-white/65 mt-0.5">
                Manage your credentials, push notifications, and device sessions directly from your account.
              </p>
            </div>

            {/* Connected Sign-In Methods */}
            <Card className="glass-card border border-[#D4AF37]/30 shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                  <Link2 className="size-4.5 text-[#D4AF37]" /> Connected Sign-in Methods
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Manage authentication methods linked to your Qmark academic account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 dark:bg-[#0A1F44]/40 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-card border border-[#D4AF37]/30 grid place-items-center shrink-0">
                      <span className="font-bold text-sm text-[#D4AF37]">G</span>
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-foreground">Google Account</div>
                      <div className="text-xs text-muted-foreground">
                        {hasGoogle
                          ? "Connected to Google Sign-In"
                          : "Link your official Google account for fast authentication"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {hasGoogle ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1 border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37]">
                          <CheckCircle2 className="size-3" /> Linked
                        </Badge>
                        {hasPassword && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={unlinkGoogle}
                            disabled={busy}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Unlink
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={linkGoogle}
                        disabled={busy}
                        className="bg-[#D4AF37] text-[#0A1F44] hover:bg-[#D4AF37]/90 text-xs font-bold"
                      >
                        Link Google
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground pt-1">
                  💡 <b>Security Note:</b> Linking requires active authentication with your university email to prevent unauthorized account takeover.
                </p>
              </CardContent>
            </Card>

            {/* Push Notifications Manager */}
            {user?.id && (
              <div className="rounded-2xl border border-[#D4AF37]/30 overflow-hidden glass-card p-1">
                <PushNotificationManager
                  userContext={{
                    userId: user.id,
                    userRole: (user.role as any) || "lecturer",
                  }}
                />
              </div>
            )}

            {/* Logged-In Devices */}
            <Card className="glass-card border border-[#D4AF37]/30 shadow-card">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                    <Laptop className="size-4.5 text-[#D4AF37]" /> Active Logged-in Devices
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Maximum <b>{MAX_DEVICES_PER_ACCOUNT} simultaneous devices</b> permitted per account.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37] text-xs font-semibold"
                  >
                    {devices.length} of {MAX_DEVICES_PER_ACCOUNT} used
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                    onClick={fetchDevices}
                    disabled={loadingDevices}
                    aria-label="Refresh devices"
                  >
                    <RefreshCw className={`size-3.5 ${loadingDevices ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {devices.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    {loadingDevices ? "Loading devices..." : "No active devices recorded."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {devices.map((d) => {
                      const isCurrent = d.device_id === currentDeviceId;
                      return (
                        <div
                          key={d.id}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border text-sm gap-2 transition-all ${
                            isCurrent
                              ? "bg-[#D4AF37]/10 border-[#D4AF37]/40 shadow-xs"
                              : "bg-muted/40 border-border/60"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="size-9 rounded-lg bg-card border border-border/80 grid place-items-center shrink-0">
                              {d.device_type === "mobile" ? (
                                <Smartphone className="size-4 text-[#D4AF37]" />
                              ) : d.device_type === "tablet" ? (
                                <Tablet className="size-4 text-[#D4AF37]" />
                              ) : (
                                <Laptop className="size-4 text-[#D4AF37]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                                  {d.device_name}
                                </span>
                                {isCurrent && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30"
                                  >
                                    This device
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                Last Active: {new Date(d.last_active).toLocaleString()}
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                            disabled={revokingId === d.id}
                            onClick={() => void handleRevokeDevice(d)}
                          >
                            <Trash2 className="size-3.5 mr-1 text-[#D4AF37]" />
                            {revokingId === d.id
                              ? "Revoking..."
                              : isCurrent
                                ? "Sign out device"
                                : "Revoke Session"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {devices.length > 1 && (
                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-[#D4AF37]/30 hover:border-[#D4AF37] hover:bg-[#D4AF37]/10"
                      onClick={handleRevokeOthers}
                      disabled={loadingDevices}
                    >
                      Revoke All Other Devices
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* About & System Compliance */}
            <Card className="glass-card border border-[#D4AF37]/30 shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                  <Info className="size-4.5 text-[#D4AF37]" /> Institutional Information
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Kwame Nkrumah University of Science and Technology Attendance Platform.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p>
                  Official deployment by <b className="text-foreground">Bern Studio Labs</b>
                </p>
                <p className="text-xs pt-2 flex items-center gap-3">
                  <Link to={"/manual" as string} className="underline hover:text-[#D4AF37] dark:hover:text-[#D4AF37]">
                    User Manual
                  </Link>
                  <span>·</span>
                  <Link to={"/terms" as string} className="underline hover:text-[#D4AF37] dark:hover:text-[#D4AF37]">
                    Terms of Service
                  </Link>
                  <span>·</span>
                  <Link to={"/privacy" as string} className="underline hover:text-[#D4AF37] dark:hover:text-[#D4AF37]">
                    Biometric Privacy
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
