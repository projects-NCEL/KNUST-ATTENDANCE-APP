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
        {/* Profile & Account Banner - Navy, Gold, and Crisp Contrast */}
        <section
          className="relative overflow-hidden rounded-3xl bg-[#0A1F44] text-white p-5 sm:p-8 shadow-xl border-2 border-[#D4AF37]/50"
          style={{ background: "linear-gradient(135deg, #0A1F44 0%, #0E2858 50%, #0A1F44 100%)" }}
        >
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-[#D4AF37]/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 size-40 rounded-full bg-[#D4AF37]/10 blur-2xl" />

          <div className="relative flex flex-col gap-5">
            {/* Top row: Avatar, Verified Badge, Account Title & User Email */}
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
              <div className="size-14 sm:size-20 rounded-2xl bg-[#061226] border-2 border-[#D4AF37]/60 p-1 flex items-center justify-center shrink-0 shadow-lg text-white">
                <UserCheck className="size-7 sm:size-10 text-[#D4AF37]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#061226]/80 px-2.5 sm:px-3 py-0.5 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-[#D4AF37] border border-[#D4AF37]/50 shadow-2xs">
                  <ShieldCheck className="size-3 sm:size-3.5 shrink-0 text-[#D4AF37]" />
                  <span className="truncate">Verified Academic Account</span>
                </div>
                <h1 className="mt-1 sm:mt-2 text-xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-xs truncate">
                  My Account
                </h1>
                <p className="mt-0.5 text-xs sm:text-sm text-[#F5E5A3] font-mono font-medium truncate">
                  {user?.email || "Academic User"}
                </p>
              </div>
            </div>

            {/* Bottom/Secondary row: Role, Access Level & Settings button */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/20 sm:border-t-0 sm:pt-0">
              <div className="flex-1 min-w-[130px] px-3.5 py-2.5 rounded-xl bg-[#061226]/85 border border-[#D4AF37]/40 shadow-xs text-left">
                <div className="text-[10px] uppercase font-bold text-[#D4AF37] tracking-wider">
                  Assigned Role
                </div>
                <div className="text-xs sm:text-sm font-bold text-white capitalize truncate mt-0.5">
                  {primaryRole}
                </div>
              </div>
              <div className="flex-1 min-w-[130px] px-3.5 py-2.5 rounded-xl bg-[#061226]/85 border border-[#D4AF37]/40 shadow-xs text-left">
                <div className="text-[10px] uppercase font-bold text-[#D4AF37] tracking-wider">
                  Access Level
                </div>
                <div className="text-xs sm:text-sm font-bold text-white truncate mt-0.5">
                  {isAdmin ? "Full Admin" : "Faculty Tutor"}
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={scrollToSettings}
                className="w-full sm:w-auto bg-[#D4AF37] text-[#0A1F44] hover:bg-[#D4AF37]/90 border-0 font-bold shadow-xs cursor-pointer h-9 px-3.5 text-xs sm:text-sm"
              >
                <Settings className="size-4 mr-1.5 text-[#0A1F44] shrink-0" /> Account Settings
              </Button>
            </div>
          </div>
        </section>

        {/* View Selection Filter Tabs — Horizontally Scrollable & Movable */}
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-[#D4AF37]/20 pb-2">
          <div className="flex items-center gap-2 min-w-max">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab("all")}
              className={`rounded-lg text-xs font-semibold px-3 py-1.5 shrink-0 whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === "all"
                  ? "bg-[#D4AF37] text-[#0A1F44] font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
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
                  ? "bg-[#D4AF37] text-[#0A1F44] font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
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
                  ? "bg-[#D4AF37] text-[#0A1F44] font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
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
                    <span className="size-2 rounded-full bg-[#D4AF37] dark:bg-[#D4AF37]" />
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
        {(activeTab === "all" || activeTab === "settings") && (
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
