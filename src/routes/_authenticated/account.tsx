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
  Sparkles,
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
      { title: "My Account & Academic Directory — KNUST ATTENDANCE APP" },
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
    category: "Students Directory",
    description: "Student rosters, biometric identification, and student QR ID cards.",
    items: [
      {
        to: "/students",
        label: "Students Directory",
        desc: "Enrolled student rosters, index numbers, and printable scannable QR cards.",
        icon: Users,
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
    description: "Billing plans, documentation, and user compliance agreements.",
    items: [
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
  const settingsSectionRef = useRef<HTMLDivElement>(null);

  // Settings state embedded in My Account
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "directory" | "settings">("all");
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
        await firebaseAuth.signOut();
        window.location.href = "/auth";
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
    setActiveTab("all");
    settingsSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <AppShell>
      <div className="space-y-8 animate-in fade-in duration-400">
        {/* Profile & Account Banner - Strictly Green, White, and Black, Optimized for Mobile & Desktop */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#00381c] via-[#00552b] to-[#007a3d] text-white p-5 sm:p-8 shadow-md border border-[#00381c]">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 size-40 rounded-full bg-white/5 blur-2xl" />

          <div className="relative flex flex-col gap-5">
            {/* Top row: Avatar, Verified Badge, Account Title & User Email */}
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
              <div className="size-14 sm:size-20 rounded-2xl bg-white/10 border-2 border-white/20 p-1 flex items-center justify-center shrink-0 shadow-lg text-white">
                <UserCheck className="size-7 sm:size-10 text-emerald-200" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 sm:px-3 py-0.5 text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-emerald-100 border border-white/20">
                  <ShieldCheck className="size-3 sm:size-3.5 shrink-0" />
                  <span className="truncate">Verified Academic Account</span>
                </div>
                <h1 className="mt-1 sm:mt-2 text-xl sm:text-3xl font-bold tracking-tight text-white truncate">
                  My Account
                </h1>
                <p className="mt-0.5 text-xs sm:text-sm text-emerald-100/90 font-mono truncate">
                  {user?.email || "Academic User"}
                </p>
              </div>
            </div>

            {/* Bottom/Secondary row: Role, Access Level & Settings button nicely arranged for mobile & desktop */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/15 sm:border-t-0 sm:pt-0">
              <div className="flex-1 min-w-[130px] px-3 py-2 rounded-xl bg-black/25 border border-white/15 backdrop-blur-xs text-left">
                <div className="text-[10px] uppercase font-semibold text-emerald-200 tracking-wider">
                  Assigned Role
                </div>
                <div className="text-xs sm:text-sm font-bold text-white capitalize truncate">
                  {primaryRole}
                </div>
              </div>
              <div className="flex-1 min-w-[130px] px-3 py-2 rounded-xl bg-black/25 border border-white/15 backdrop-blur-xs text-left">
                <div className="text-[10px] uppercase font-semibold text-emerald-200 tracking-wider">
                  Access Level
                </div>
                <div className="text-xs sm:text-sm font-bold text-white truncate">
                  {isAdmin ? "Full Admin" : "Faculty Tutor"}
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={scrollToSettings}
                className="w-full sm:w-auto bg-white text-[#00381c] hover:bg-emerald-50 border-0 font-semibold shadow-xs cursor-pointer h-9 px-3.5 text-xs sm:text-sm"
              >
                <Settings className="size-4 mr-1.5 text-[#00552b] shrink-0" /> Account Settings
              </Button>
            </div>
          </div>
        </section>

        {/* View Selection Filter Tabs — Horizontally Scrollable & Movable */}
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-black/10 dark:border-white/10 pb-2">
          <div className="flex items-center gap-2 min-w-max">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab("all")}
              className={`rounded-lg text-xs font-semibold px-3 py-1.5 shrink-0 whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === "all"
                  ? "bg-[#00552b] text-white hover:bg-[#00381c]"
                  : "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              All Tools & Settings
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab("directory")}
              className={`rounded-lg text-xs font-semibold px-3 py-1.5 shrink-0 whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === "directory"
                  ? "bg-[#00552b] text-white hover:bg-[#00381c]"
                  : "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              Academic Directory
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab("settings")}
              className={`rounded-lg text-xs font-semibold px-3 py-1.5 shrink-0 whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === "settings"
                  ? "bg-[#00552b] text-white hover:bg-[#00381c]"
                  : "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              Settings & Security
            </Button>
          </div>
        </div>

        {/* Academic Directory Sections */}
        {(activeTab === "all" || activeTab === "directory") && (
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
        )}

        {/* Embedded Settings & Security Section */}
        {(activeTab === "all" || activeTab === "settings") && (
          <div ref={settingsSectionRef} id="settings" className="space-y-6 pt-4">
            <div className="border-b border-black/10 dark:border-white/10 pb-2">
              <h2 className="text-xl font-bold tracking-tight text-black dark:text-white flex items-center gap-2">
                <Settings className="size-5 text-[#00552b] dark:text-emerald-400" />
                Account Settings & Security
              </h2>
              <p className="text-xs text-black/65 dark:text-white/65 mt-0.5">
                Manage your credentials, push notifications, and device sessions directly from your account.
              </p>
            </div>

            {/* Connected Sign-In Methods */}
            <Card className="border-black/10 dark:border-white/10 bg-white dark:bg-black shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-black dark:text-white">
                  <Link2 className="size-4.5 text-[#00552b] dark:text-emerald-400" /> Connected Sign-in Methods
                </CardTitle>
                <CardDescription className="text-xs text-black/60 dark:text-white/60">
                  Manage authentication methods linked to your KNUST ATTENDANCE APP academic account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-black/10 dark:border-white/10 bg-[#00552b]/5 dark:bg-emerald-950/20 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-white dark:bg-black border border-black/15 dark:border-white/15 grid place-items-center shrink-0">
                      <span className="font-bold text-sm text-[#00552b] dark:text-emerald-400">G</span>
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-black dark:text-white">Google Account</div>
                      <div className="text-xs text-black/60 dark:text-white/60">
                        {hasGoogle
                          ? "Connected to Google Sign-In"
                          : "Link your official Google account for fast authentication"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {hasGoogle ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1 border-[#00552b]/30 bg-[#00552b]/10 text-[#00552b] dark:text-emerald-400">
                          <CheckCircle2 className="size-3" /> Linked
                        </Badge>
                        {hasPassword && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={unlinkGoogle}
                            disabled={busy}
                            className="text-xs text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white"
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
                        className="bg-[#00552b] text-white hover:bg-[#00381c] text-xs font-semibold"
                      >
                        Link Google
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-black/60 dark:text-white/60 pt-1">
                  💡 <b>Security Note:</b> Linking requires active authentication with your university email to prevent unauthorized account takeover.
                </p>
              </CardContent>
            </Card>

            {/* Push Notifications Manager */}
            {user?.id && (
              <div className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden bg-white dark:bg-black p-1">
                <PushNotificationManager
                  userContext={{
                    userId: user.id,
                    userRole: (user.role as any) || "lecturer",
                  }}
                />
              </div>
            )}

            {/* Logged-In Devices */}
            <Card className="border-black/10 dark:border-white/10 bg-white dark:bg-black shadow-xs">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-bold text-black dark:text-white">
                    <Laptop className="size-4.5 text-[#00552b] dark:text-emerald-400" /> Active Logged-in Devices
                  </CardTitle>
                  <CardDescription className="text-xs text-black/60 dark:text-white/60">
                    Maximum <b>{MAX_DEVICES_PER_ACCOUNT} simultaneous devices</b> permitted per account.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-[#00552b]/30 bg-[#00552b]/10 text-[#00552b] dark:text-emerald-400 text-xs font-semibold"
                  >
                    {devices.length} of {MAX_DEVICES_PER_ACCOUNT} used
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-[#00552b] dark:text-emerald-400 hover:bg-[#00552b]/10"
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
                  <p className="text-xs text-black/60 dark:text-white/60 py-2">
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
                              ? "bg-[#00552b]/5 dark:bg-emerald-950/20 border-[#00552b]/30 dark:border-emerald-700/40"
                              : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="size-9 rounded-lg bg-white dark:bg-black border border-black/10 dark:border-white/10 grid place-items-center shrink-0">
                              {d.device_type === "mobile" ? (
                                <Smartphone className="size-4 text-[#00552b] dark:text-emerald-400" />
                              ) : d.device_type === "tablet" ? (
                                <Tablet className="size-4 text-[#00552b] dark:text-emerald-400" />
                              ) : (
                                <Laptop className="size-4 text-[#00552b] dark:text-emerald-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs sm:text-sm text-black dark:text-white truncate">
                                  {d.device_name}
                                </span>
                                {isCurrent && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 bg-[#00552b]/15 text-[#00552b] dark:text-emerald-400 border-[#00552b]/30"
                                  >
                                    This device
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-black/60 dark:text-white/60 truncate">
                                Last Active: {new Date(d.last_active).toLocaleString()}
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 shrink-0 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10"
                            disabled={revokingId === d.id}
                            onClick={() => void handleRevokeDevice(d)}
                          >
                            <Trash2 className="size-3.5 mr-1 text-[#00552b] dark:text-emerald-400" />
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
                      className="text-xs border-black/20 dark:border-white/20 text-black dark:text-white hover:bg-[#00552b]/10 hover:text-[#00552b] dark:hover:text-emerald-400"
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
            <Card className="border-black/10 dark:border-white/10 bg-white dark:bg-black shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-black dark:text-white">
                  <Info className="size-4.5 text-[#00552b] dark:text-emerald-400" /> Institutional Information
                </CardTitle>
                <CardDescription className="text-xs text-black/60 dark:text-white/60">
                  Kwame Nkrumah University of Science and Technology Attendance Platform.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-black/60 dark:text-white/60 space-y-1">
                <p>
                  Official deployment by <b className="text-black dark:text-white">Bern Studio Labs</b>
                </p>
                <p className="text-xs pt-2 flex items-center gap-3">
                  <Link to={"/manual" as string} className="underline hover:text-[#00552b] dark:hover:text-emerald-400">
                    User Manual
                  </Link>
                  <span>·</span>
                  <Link to={"/terms" as string} className="underline hover:text-[#00552b] dark:hover:text-emerald-400">
                    Terms of Service
                  </Link>
                  <span>·</span>
                  <Link to={"/privacy" as string} className="underline hover:text-[#00552b] dark:hover:text-emerald-400">
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
