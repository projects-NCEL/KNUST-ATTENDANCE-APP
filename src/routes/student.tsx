import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Lock,
  LogOut,
  Megaphone,
  QrCode,
  User,
  ExternalLink,
  ClipboardList,
  BellRing,
  Settings,
  Radio,
  ArrowRight,
  ShieldCheck,
  UserPlus,
  Key,
  Shield,
  ArrowLeft,
  Check,
  Trash2,
  RefreshCw,
  Inbox,
  Bell,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { StudentQrPassCard } from "@/components/StudentQrPassCard";
import { QmarkTitleBar } from "@/components/QmarkTitleBar";
import { PushNotificationManager } from "@/components/PushNotificationManager";

export const Route = createFileRoute("/student")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Student Portal & Pass — Qmark" },
      {
        name: "description",
        content: "Access your Qmark digital attendance pass, courses, attendance, and assignments.",
      },
    ],
  }),
  component: StudentPortalPage,
});

const STORE = "qmark.student.session.v1";

interface StoredStudentSession {
  i: string;
  p: string;
  lastActive: number;
}

function saveStudentSession(index: string, pass: string) {
  try {
    const payload: StoredStudentSession = {
      i: index.trim().toUpperCase(),
      p: pass,
      lastActive: Date.now(),
    };
    localStorage.setItem(STORE, JSON.stringify(payload));
  } catch (err) {
    console.warn("Failed to persist student session:", err);
  }
}

function clearStudentSession() {
  try {
    localStorage.removeItem(STORE);
    sessionStorage.removeItem(STORE);
    localStorage.removeItem("qroll_student_session");
  } catch (e) {
    console.debug("Session clear error", e);
  }
}

interface StudentMe {
  id: string;
  full_name: string;
  index_number: string;
  level: string;
  program?: string;
  department?: string;
  email?: string;
  qr_uuid?: string;
}

interface CourseAttendanceRow {
  course_id: string;
  code: string;
  title: string;
  level?: string;
  department?: string;
  credit_hours: number;
  semester: string;
  lecturer_name?: string;
  lecturer_email?: string | null;
  sessions_total: number;
  attended: number;
  missed: number;
  late: number;
  percentage: number;
  risk_level: "safe" | "warning" | "critical";
}

interface HistoryItem {
  id: string;
  session_id: string;
  session_title: string;
  course_code: string;
  course_title: string;
  session_date: string;
  check_in_at: string;
  status: string;
}

interface NoticeItem {
  id: string;
  title: string;
  body: string;
  course_code: string | null;
  course_title?: string | null;
  lecturer_name?: string;
  created_at: string;
}

interface AssignmentItem {
  id: string;
  title: string;
  details: string;
  course_id: string;
  course_code: string | null;
  course_title?: string | null;
  due_at: string | null;
  submission_url: string | null;
  created_at: string;
}

type StudentAuthTab = "signin" | "activate" | "reset" | "register";
type PortalTabType = "qr" | "attendance" | "courses" | "notices" | "notifications" | "settings";

const ACADEMIC_LEVELS = [
  { value: "100", label: "Level 100 (Freshman)" },
  { value: "200", label: "Level 200 (Sophomore)" },
  { value: "300", label: "Level 300 (Junior)" },
  { value: "400", label: "Level 400 (Senior)" },
];

const FACULTY_DEPARTMENTS = [
  "Petroleum Engineering",
  "Department of Computer Science",
  "Department of Electrical & Electronic Engineering",
  "Department of Computer Engineering",
  "Department of Mechanical Engineering",
  "Department of Civil Engineering",
  "Department of Chemical Engineering",
  "Department of Materials Engineering",
  "Department of Mathematics",
  "Department of Physics",
  "Department of Business Administration",
  "Faculty of Law",
  "Department of Architecture",
  "General Studies",
];

function StudentPortalPage() {
  // Unauthenticated Auth States matching the 4 screenshots
  const [activeAuthTab, setActiveAuthTab] = useState<StudentAuthTab>("signin");

  // Sign In Form State
  const [signInIndex, setSignInIndex] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [signInBusy, setSignInBusy] = useState(false);

  // Register Form State
  const [regFullName, setRegFullName] = useState("");
  const [regIndex, setRegIndex] = useState("");
  const [regLevel, setRegLevel] = useState("100");
  const [regDepartment, setRegDepartment] = useState("Petroleum Engineering");
  const [regProgram, setRegProgram] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regBusy, setRegBusy] = useState(false);

  // Activate Form State
  const [actIndex, setActIndex] = useState("");
  const [actEmail, setActEmail] = useState("");
  const [actPassword, setActPassword] = useState("");
  const [actConfirmPassword, setActConfirmPassword] = useState("");
  const [showActPassword, setShowActPassword] = useState(false);
  const [actBusy, setActBusy] = useState(false);

  // Reset Form State
  const [resetIndex, setResetIndex] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  // Authenticated State
  const [me, setMe] = useState<StudentMe | null>(null);
  const [portalTab, setPortalTab] = useState<PortalTabType>("qr");
  const [courses, setCourses] = useState<CourseAttendanceRow[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [announcements, setAnnouncements] = useState<NoticeItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [feedFilter, setFeedFilter] = useState<"all" | "announcements" | "assignments">("all");
  const [activeSession, setActiveSession] = useState<{ id: string; courseCode?: string; title?: string } | null>(null);

  // Settings State
  const [oldPassword, setOldPassword] = useState("");
  const [newSettingsPassword, setNewSettingsPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  // Dedicated Notification Center State
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifFilter, setNotifFilter] = useState<string>("all");

  const loadNotifications = useCallback(async (studentId?: string, studentIdx?: string) => {
    const sId = studentId || me?.id;
    const sIdx = studentIdx || me?.index_number;
    if (!sId && !sIdx) return;
    setNotifLoading(true);
    try {
      const res = await fetch(
        `/api/push/notifications?userId=${encodeURIComponent(sId || "")}&altId=${encodeURIComponent(sIdx || "")}`,
      );
      if (res.ok) {
        const json = await res.json();
        setNotificationsList(json.notifications || []);
      }
    } catch {
      // non-blocking
    } finally {
      setNotifLoading(false);
    }
  }, [me?.id, me?.index_number]);

  const deleteSingleNotification = async (notifId: string) => {
    setNotificationsList((prev) => prev.filter((n) => n.id !== notifId));
    try {
      await fetch("/api/push/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: notifId }),
      });
      toast.success("Notification removed");
    } catch {
      toast.error("Failed to delete notification");
    }
  };

  const clearAllNotifications = async () => {
    if (!confirm("Are you sure you want to clear all notification records?")) return;
    setNotificationsList([]);
    try {
      await fetch("/api/push/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clearAll: true,
          userId: me?.id,
          altId: me?.index_number,
        }),
      });
      toast.success("All notification records cleared");
    } catch {
      toast.error("Failed to clear notifications");
    }
  };

  const loadStudentData = useCallback(async (userIndex: string, userPass?: string) => {
    try {
      const dataRes = await fetch("/api/public/student-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "data", index: userIndex, password: userPass }),
      });
      const data = await dataRes.json();
      if (data.student) {
        setMe(data.student);
        loadNotifications(data.student.id, data.student.index_number);
      }
      if (Array.isArray(data.courses)) setCourses(data.courses);
      if (Array.isArray(data.history)) setHistory(data.history);
      if (Array.isArray(data.announcements)) setAnnouncements(data.announcements);
      if (Array.isArray(data.assignments)) setAssignments(data.assignments);

      const sessRes = await fetch("/api/public/student-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_active_sessions" }),
      });
      const sessData = await sessRes.json();
      if (Array.isArray(sessData.sessions) && sessData.sessions.length > 0) {
        setActiveSession(sessData.sessions[0]);
      }
    } catch (err) {
      console.error("Error loading student portal data:", err);
    }
  }, [loadNotifications]);

  const handleLogin = useCallback(
    async (loginIndex = signInIndex, loginPass = signInPassword) => {
      const cleanIdx = loginIndex.trim().toUpperCase();
      if (!cleanIdx || !loginPass) {
        toast.error("Please enter student index number and password");
        return;
      }
      setSignInBusy(true);
      try {
        const res = await fetch("/api/public/student-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "login",
            index: cleanIdx,
            password: loginPass,
          }),
        });
        const data = await res.json();

        if (data.needs_password_setup) {
          toast.info("No password set yet. Please activate your account first.");
          setActIndex(cleanIdx);
          setActiveAuthTab("activate");
          return;
        }

        if (!res.ok || !data.ok || !data.student) {
          toast.error(data.error || "Invalid index number or password");
          return;
        }

        saveStudentSession(cleanIdx, loginPass);
        localStorage.setItem("qroll_student_session", "true");
        localStorage.setItem("qroll_active_gateway", "student");
        setMe(data.student);
        toast.success(`Signed in as ${data.student.full_name || cleanIdx}`);
        void loadStudentData(cleanIdx, loginPass);
      } catch {
        toast.error("Network error. Please try again.");
      } finally {
        setSignInBusy(false);
      }
    },
    [signInIndex, signInPassword, loadStudentData],
  );

  // Restore stored session
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const parsed: StoredStudentSession = JSON.parse(raw);
        if (parsed.i && parsed.p) {
          setSignInIndex(parsed.i);
          setSignInPassword(parsed.p);
          void handleLogin(parsed.i, parsed.p);
        }
      }
    } catch {
      // ignore
    }
  }, [handleLogin]);

  // Handle Self Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim() || !regIndex.trim() || !regPassword) {
      toast.error("Please fill in legal name, index number, and password");
      return;
    }
    if (regPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setRegBusy(true);
    const upperIdx = regIndex.trim().toUpperCase();
    try {
      const res = await fetch("/api/public/student-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register_new_student",
          full_name: regFullName.trim(),
          index: upperIdx,
          level: regLevel,
          program: regProgram.trim() || regDepartment,
          email: regEmail.trim(),
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error || "Registration failed");
        return;
      }

      toast.success("Account registered successfully! Entering portal...");
      saveStudentSession(upperIdx, regPassword);
      localStorage.setItem("qroll_student_session", "true");
      localStorage.setItem("qroll_active_gateway", "student");
      setMe(data.student);
      void loadStudentData(upperIdx, regPassword);
    } catch {
      toast.error("Failed to connect. Please try again.");
    } finally {
      setRegBusy(false);
    }
  };

  // Handle Account Activation (For pre-enrolled students)
  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actIndex.trim() || !actPassword) {
      toast.error("Index number and password are required");
      return;
    }
    if (actPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (actPassword !== actConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setActBusy(true);
    const upperIdx = actIndex.trim().toUpperCase();
    try {
      const res = await fetch("/api/public/student-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_password",
          index: upperIdx,
          email: actEmail.trim(),
          password: actPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error || "Account activation failed");
        return;
      }

      toast.success("Account activated successfully! Entering portal...");
      saveStudentSession(upperIdx, actPassword);
      localStorage.setItem("qroll_student_session", "true");
      localStorage.setItem("qroll_active_gateway", "student");
      setMe(data.student);
      void loadStudentData(upperIdx, actPassword);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setActBusy(false);
    }
  };

  // Handle Password Reset
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetIndex.trim() || !resetEmail.trim() || !resetNewPassword) {
      toast.error("Please fill in index number, registered email, and new password");
      return;
    }
    if (resetNewPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setResetBusy(true);
    const upperIdx = resetIndex.trim().toUpperCase();
    try {
      const res = await fetch("/api/public/student-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          index: upperIdx,
          email: resetEmail.trim(),
          password: resetNewPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error || "Password reset failed");
        return;
      }

      toast.success("Password reset successfully! Logging you in...");
      saveStudentSession(upperIdx, resetNewPassword);
      localStorage.setItem("qroll_student_session", "true");
      localStorage.setItem("qroll_active_gateway", "student");
      setMe(data.student);
      void loadStudentData(upperIdx, resetNewPassword);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setResetBusy(false);
    }
  };

  const handleSignOut = () => {
    clearStudentSession();
    setMe(null);
    setCourses([]);
    setHistory([]);
    setAnnouncements([]);
    setAssignments([]);
    toast.success("Signed out of Student Portal");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || !oldPassword || !newSettingsPassword) {
      toast.error("Enter current and new password");
      return;
    }
    if (newSettingsPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    setChangingPass(true);
    try {
      const res = await fetch("/api/public/student-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_password",
          index: me.index_number,
          oldPassword,
          newPassword: newSettingsPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to update password");
        return;
      }
      toast.success("Password updated successfully");
      saveStudentSession(me.index_number, newSettingsPassword);
      setSignInPassword(newSettingsPassword);
      setOldPassword("");
      setNewSettingsPassword("");
    } catch {
      toast.error("Network error while updating password");
    } finally {
      setChangingPass(false);
    }
  };

  const overallRate = useMemo(() => {
    if (!courses.length) return 0;
    const total = courses.reduce((acc, c) => acc + (c.sessions_total || 0), 0);
    const attended = courses.reduce((acc, c) => acc + (c.attended || 0), 0);
    if (total === 0) return 100;
    return Math.round((attended / total) * 100);
  }, [courses]);

  const combinedFeed = useMemo(() => {
    const list: Array<{
      id: string;
      type: "announcement" | "assignment";
      title: string;
      body: string;
      courseCode: string | null;
      date: string;
      dueDate?: string | null;
      link?: string | null;
    }> = [];

    announcements.forEach((a) => {
      list.push({
        id: `ann-${a.id}`,
        type: "announcement",
        title: a.title,
        body: a.body,
        courseCode: a.course_code,
        date: a.created_at,
      });
    });

    assignments.forEach((asg) => {
      list.push({
        id: `asg-${asg.id}`,
        type: "assignment",
        title: asg.title,
        body: asg.details,
        courseCode: asg.course_code,
        date: asg.created_at,
        dueDate: asg.due_at,
        link: asg.submission_url,
      });
    });

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (feedFilter === "announcements") return list.filter((i) => i.type === "announcement");
    if (feedFilter === "assignments") return list.filter((i) => i.type === "assignment");
    return list;
  }, [announcements, assignments, feedFilter]);

  // =========================================================================
  // UNAUTHENTICATED STATE: EXACT REPRODUCTION OF THE 4 ATTACHED SCREENSHOTS
  // =========================================================================
  if (!me) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-[#F7F9FC] dark:bg-[#07152A] text-foreground">
        {/* Top Minimal Navigation Bar */}
        <header className="w-full px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-border/60 bg-white/80 dark:bg-[#0A1F44]/80 backdrop-blur-md">
          <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition text-xs font-semibold">
            <ArrowLeft className="size-4" />
            <span>Back to Portal Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider hidden sm:inline">
              KNUST / University Attendance Gateway
            </span>
          </div>
        </header>

        {/* Main Split-Card Container (Matching Attached Screenshots) */}
        <div className="flex-1 flex items-center justify-center p-3 sm:p-6 lg:p-10 my-auto w-full">
          <div className="w-full max-w-5xl lg:max-w-[94vw] xl:max-w-[1550px] 2xl:max-w-[1750px] rounded-[28px] sm:rounded-[32px] border border-[#D4AF37]/35 shadow-2xl bg-card overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[640px]">
            {/* ------------------------------------------------------------- */}
            {/* LEFT COLUMN: Deep Navy #0A1F44 with Black Students Hero Image */}
            {/* ------------------------------------------------------------- */}
            <div className="md:col-span-5 bg-[#0A1F44] text-white p-7 sm:p-10 flex flex-col justify-between relative overflow-hidden select-none">
              {/* Strategic Black Students Campus Hero Image Background - Vibrant and clearly visible */}
              <img
                src="/knust-students-hero.jpg"
                alt="University Students on Campus"
                className="absolute inset-0 size-full object-cover object-center filter brightness-95 contrast-105"
              />
              {/* Very transparent subtle gradient overlay so the photo is brightly visible */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/15 backdrop-blur-[0.5px]" />

              {/* Top Logo & Status Capsule */}
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-xl bg-black/40 border border-white/30 flex items-center justify-center p-1.5 shadow-sm backdrop-blur-md">
                    <img src="/qmark_icon_standalone.png" alt="Qmark" className="size-full object-contain" />
                  </div>
                  <div>
                    <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-0.5 leading-none drop-shadow-md">
                      Q<span className="text-[#D4AF37]">mark</span>
                    </h1>
                    <p className="text-[10px] font-bold tracking-widest text-white/90 uppercase mt-1 drop-shadow-sm">
                      Student Pass
                    </p>
                  </div>
                </div>

                <div className="inline-block">
                  <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-white bg-black/40 border border-white/30 px-3 py-1 rounded-full backdrop-blur-md shadow-xs">
                    Official Student Pass
                  </span>
                </div>
              </div>

              {/* Bottom Feature Highlights */}
              <div className="relative z-10 pt-10 md:pt-0 space-y-4 drop-shadow-md">
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-tight">
                    Your Personal Digital QR Pass
                  </h2>
                  <p className="text-xs text-white/95 mt-2 leading-relaxed">
                    Instant classroom check-ins, Apple Wallet-style dynamic QR badges, assignments, and real-time push alerts on your phone.
                  </p>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-white/25 text-xs">
                  <div className="flex items-center gap-2.5 text-white">
                    <div className="size-4.5 rounded-full border border-white/60 flex items-center justify-center shrink-0 bg-black/30">
                      <Check className="size-2.5 text-white stroke-[3]" />
                    </div>
                    <span>Apple Wallet style digital QR pass</span>
                  </div>

                  <div className="flex items-center gap-2.5 text-white">
                    <div className="size-4.5 rounded-full border border-white/60 flex items-center justify-center shrink-0 bg-black/30">
                      <Check className="size-2.5 text-white stroke-[3]" />
                    </div>
                    <span>Instant geofenced lecture check-in</span>
                  </div>

                  <div className="flex items-center gap-2.5 text-white">
                    <div className="size-4.5 rounded-full border border-white/60 flex items-center justify-center shrink-0 bg-black/30">
                      <Check className="size-2.5 text-white stroke-[3]" />
                    </div>
                    <span>Real-time attendance & 75% exam cutoff monitor</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* RIGHT COLUMN: Form Panel with the 4 Top Tabs                */}
            {/* ------------------------------------------------------------- */}
            <div className="md:col-span-7 bg-[#FAF8F5] dark:bg-[#0A1F44]/90 p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
              <div>
                {/* 4 Tabs Segmented Capsule in requested order: Sign In -> Activate -> Reset -> Register */}
                <div className="p-1 bg-[#ECEAE4] dark:bg-muted/80 rounded-full flex items-center justify-between text-xs font-semibold select-none border border-border/50">
                  <button
                    type="button"
                    onClick={() => setActiveAuthTab("signin")}
                    className={`flex-1 py-2 rounded-full transition-all text-center cursor-pointer ${
                      activeAuthTab === "signin"
                        ? "bg-white dark:bg-card text-foreground font-bold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sign In
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveAuthTab("activate")}
                    className={`flex-1 py-2 rounded-full transition-all text-center cursor-pointer ${
                      activeAuthTab === "activate"
                        ? "bg-white dark:bg-card text-foreground font-bold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Activate
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveAuthTab("reset")}
                    className={`flex-1 py-2 rounded-full transition-all text-center cursor-pointer ${
                      activeAuthTab === "reset"
                        ? "bg-white dark:bg-card text-foreground font-bold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Reset
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveAuthTab("register")}
                    className={`flex-1 py-2 rounded-full transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                      activeAuthTab === "register"
                        ? "bg-white dark:bg-card text-foreground font-bold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <UserPlus className="size-3.5" />
                    <span>Register</span>
                  </button>
                </div>

                {/* --------------------------------------------------------- */}
                {/* SCREENSHOT 1: SIGN IN VIEW                                */}
                {/* --------------------------------------------------------- */}
                {activeAuthTab === "signin" && (
                  <div className="mt-6 space-y-5">
                    {/* Header */}
                    <div className="text-center space-y-1.5">
                      <div className="size-11 rounded-2xl bg-[#0A1F44] text-[#D4AF37] border border-[#D4AF37]/40 flex items-center justify-center mx-auto shadow-xs">
                        <img src="/qmark_icon_standalone.png" alt="Qmark" className="size-5 object-contain" />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                        Student Portal Sign In
                      </h3>
                      <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                        Enter your student index number and portal password to view your pass.
                      </p>
                    </div>

                    {/* First Time Student Banner */}
                    <div className="p-3.5 rounded-2xl border border-[#D4AF37]/45 bg-[#D4AF37]/10 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-9 rounded-full bg-[#0A1F44] text-[#D4AF37] flex items-center justify-center shrink-0">
                          <UserPlus className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground">First time student?</p>
                          <p className="text-[11px] text-muted-foreground truncate">Register to get your digital QR pass</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveAuthTab("register")}
                        className="px-3.5 py-1.5 rounded-full border border-border bg-white dark:bg-card text-foreground font-bold text-xs shadow-xs hover:bg-muted transition flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <span>Register</span>
                        <ArrowRight className="size-3.5" />
                      </button>
                    </div>

                    {/* Sign In Form */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleLogin();
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                          Student Index Number
                        </Label>
                        <Input
                          placeholder="E.G. 2084931"
                          value={signInIndex}
                          onChange={(e) => setSignInIndex(e.target.value.toUpperCase())}
                          className="h-11 rounded-xl border-2 border-[#D4AF37]/60 bg-white dark:bg-background font-mono text-sm tracking-wider uppercase focus:border-[#D4AF37]"
                          required
                          autoFocus
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                            Password
                          </Label>
                          <button
                            type="button"
                            onClick={() => {
                              setResetIndex(signInIndex);
                              setActiveAuthTab("reset");
                            }}
                            className="text-xs font-semibold text-foreground hover:underline cursor-pointer"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative">
                          <Input
                            type={showSignInPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            value={signInPassword}
                            onChange={(e) => setSignInPassword(e.target.value)}
                            className="h-11 rounded-xl border border-border bg-white dark:bg-background text-sm pr-10"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignInPassword(!showSignInPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {showSignInPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={signInBusy}
                        className="w-full h-12 rounded-2xl bg-[#B8861B] hover:bg-[#A37415] text-white font-bold text-sm shadow-md cursor-pointer transition-all mt-2"
                      >
                        {signInBusy ? "Signing In..." : "Sign In to Portal"}
                      </Button>

                      <div className="text-center pt-2">
                        <p className="text-xs text-muted-foreground">
                          Pre-enrolled by lecturer?{" "}
                          <button
                            type="button"
                            onClick={() => {
                              setActIndex(signInIndex);
                              setActiveAuthTab("activate");
                            }}
                            className="text-foreground font-bold hover:underline cursor-pointer ml-1"
                          >
                            Activate Enrolled Account
                          </button>
                        </p>
                      </div>
                    </form>
                  </div>
                )}

                {/* --------------------------------------------------------- */}
                {/* SCREENSHOT 2: ACTIVATE VIEW                               */}
                {/* --------------------------------------------------------- */}
                {activeAuthTab === "activate" && (
                  <div className="mt-6 space-y-4">
                    <div className="text-center space-y-1.5">
                      <div className="size-11 rounded-2xl bg-[#0A1F44] text-[#D4AF37] border border-[#D4AF37]/40 flex items-center justify-center mx-auto shadow-xs">
                        <Key className="size-5" />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                        Account Activation
                      </h3>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        For students pre-enrolled by their lecturer. Enter your index number and email to set up your password.
                      </p>
                    </div>

                    <form onSubmit={handleActivate} className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                          Index Number
                        </Label>
                        <Input
                          placeholder="E.G. 2084931"
                          value={actIndex}
                          onChange={(e) => setActIndex(e.target.value.toUpperCase())}
                          className="h-10.5 rounded-xl border-2 border-[#D4AF37]/60 bg-white dark:bg-background font-mono text-sm uppercase"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                          Registered Email Address
                        </Label>
                        <Input
                          type="email"
                          placeholder="e.g. student@example.com"
                          value={actEmail}
                          onChange={(e) => setActEmail(e.target.value)}
                          className="h-10.5 rounded-xl border border-border bg-white dark:bg-background text-sm"
                          required
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Must match the email recorded in the system by your instructor.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                            Create Password
                          </Label>
                          <button
                            type="button"
                            onClick={() => setShowActPassword(!showActPassword)}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="size-3" />
                            <span>{showActPassword ? "Hide" : "Show"}</span>
                          </button>
                        </div>
                        <Input
                          type={showActPassword ? "text" : "password"}
                          placeholder="At least 6 characters"
                          value={actPassword}
                          onChange={(e) => setActPassword(e.target.value)}
                          className="h-10.5 rounded-xl border border-border bg-white dark:bg-background text-sm"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                          Confirm Password
                        </Label>
                        <Input
                          type="password"
                          placeholder="Re-enter password"
                          value={actConfirmPassword}
                          onChange={(e) => setActConfirmPassword(e.target.value)}
                          className="h-10.5 rounded-xl border border-border bg-white dark:bg-background text-sm"
                          required
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={actBusy}
                        className="w-full h-12 rounded-2xl bg-[#B8861B] hover:bg-[#A37415] text-white font-bold text-sm shadow-md cursor-pointer flex items-center justify-center gap-2 mt-4"
                      >
                        <UserPlus className="size-4" />
                        <span>{actBusy ? "Activating..." : "Activate & Enter Portal"}</span>
                      </Button>

                      <div className="text-center pt-2">
                        <p className="text-xs text-muted-foreground">
                          Already have an account?{" "}
                          <button
                            type="button"
                            onClick={() => setActiveAuthTab("signin")}
                            className="text-foreground font-bold hover:underline cursor-pointer ml-1"
                          >
                            Sign In
                          </button>
                        </p>
                      </div>
                    </form>
                  </div>
                )}

                {/* --------------------------------------------------------- */}
                {/* SCREENSHOT 3: RESET VIEW                                  */}
                {/* --------------------------------------------------------- */}
                {activeAuthTab === "reset" && (
                  <div className="mt-6 space-y-4">
                    <div className="text-center space-y-1.5">
                      <div className="size-11 rounded-2xl bg-[#0A1F44] text-[#D4AF37] border border-[#D4AF37]/40 flex items-center justify-center mx-auto shadow-xs">
                        <Shield className="size-5" />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                        Reset Student Password
                      </h3>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        Provide your registered student email and index number to set a new password.
                      </p>
                    </div>

                    <form onSubmit={handleReset} className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                          Student Index Number
                        </Label>
                        <Input
                          placeholder="E.G. 2084931"
                          value={resetIndex}
                          onChange={(e) => setResetIndex(e.target.value.toUpperCase())}
                          className="h-10.5 rounded-xl border-2 border-[#D4AF37]/60 bg-white dark:bg-background font-mono text-sm uppercase"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                          Registered Email Address
                        </Label>
                        <Input
                          type="email"
                          placeholder="your.email@example.com"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="h-10.5 rounded-xl border border-border bg-white dark:bg-background text-sm"
                          required
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Must match the registered email for this student index number.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                            New Password (Min 6 Chars)
                          </Label>
                          <button
                            type="button"
                            onClick={() => setShowResetPassword(!showResetPassword)}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="size-3" />
                            <span>{showResetPassword ? "Hide" : "Show"}</span>
                          </button>
                        </div>
                        <Input
                          type={showResetPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={resetNewPassword}
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          className="h-10.5 rounded-xl border border-border bg-white dark:bg-background text-sm"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                          Confirm New Password
                        </Label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={resetConfirmPassword}
                          onChange={(e) => setResetConfirmPassword(e.target.value)}
                          className="h-10.5 rounded-xl border border-border bg-white dark:bg-background text-sm"
                          required
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={resetBusy}
                        className="w-full h-12 rounded-2xl bg-[#B8861B] hover:bg-[#A37415] text-white font-bold text-sm shadow-md cursor-pointer mt-4"
                      >
                        {resetBusy ? "Resetting..." : "Reset Password & Sign In"}
                      </Button>

                      <div className="text-center pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveAuthTab("signin")}
                          className="text-xs text-foreground font-semibold hover:underline cursor-pointer"
                        >
                          Back to sign in
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* --------------------------------------------------------- */}
                {/* SCREENSHOT 4: REGISTER VIEW                               */}
                {/* --------------------------------------------------------- */}
                {activeAuthTab === "register" && (
                  <div className="mt-5 space-y-3.5">
                    <div className="text-center space-y-1">
                      <div className="size-10 rounded-2xl bg-[#0A1F44] text-[#D4AF37] border border-[#D4AF37]/40 flex items-center justify-center mx-auto shadow-xs">
                        <UserPlus className="size-4.5" />
                      </div>
                      <h3 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">
                        New Student Registration
                      </h3>
                      <p className="text-[11px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
                        Qmark Academic Network. Register once to create your student account and get your digital QR pass.
                      </p>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-2.5">
                      <div className="space-y-0.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                          Full Legal Name
                        </Label>
                        <Input
                          placeholder="e.g. Kwame Mensah"
                          value={regFullName}
                          onChange={(e) => setRegFullName(e.target.value)}
                          className="h-9.5 rounded-xl border border-border bg-white dark:bg-background text-xs"
                          required
                        />
                      </div>

                      <div className="space-y-0.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                          Student Index Number
                        </Label>
                        <Input
                          placeholder="E.G. 2084931"
                          value={regIndex}
                          onChange={(e) => setRegIndex(e.target.value.toUpperCase())}
                          className="h-9.5 rounded-xl border border-border bg-white dark:bg-background font-mono text-xs uppercase"
                          required
                        />
                      </div>

                      <div className="space-y-0.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                          Academic Level
                        </Label>
                        <Select value={regLevel} onValueChange={setRegLevel}>
                          <SelectTrigger className="h-9.5 rounded-xl border border-border bg-white dark:bg-background text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACADEMIC_LEVELS.map((lvl) => (
                              <SelectItem key={lvl.value} value={lvl.value} className="text-xs">
                                {lvl.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-0.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                          Department / Faculty
                        </Label>
                        <Select value={regDepartment} onValueChange={setRegDepartment}>
                          <SelectTrigger className="h-9.5 rounded-xl border border-border bg-white dark:bg-background text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FACULTY_DEPARTMENTS.map((dept) => (
                              <SelectItem key={dept} value={dept} className="text-xs">
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-0.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                          Program of Study (Major)
                        </Label>
                        <Input
                          placeholder="e.g. BSc Computer Science"
                          value={regProgram}
                          onChange={(e) => setRegProgram(e.target.value)}
                          className="h-9.5 rounded-xl border border-border bg-white dark:bg-background text-xs"
                        />
                      </div>

                      <div className="space-y-0.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                          Email Address
                        </Label>
                        <Input
                          type="email"
                          placeholder="student@example.com"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className="h-9.5 rounded-xl border border-border bg-white dark:bg-background text-xs"
                          required
                        />
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                            Create Password
                          </Label>
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="size-3" />
                            <span>{showRegPassword ? "Hide" : "Show"}</span>
                          </button>
                        </div>
                        <Input
                          type={showRegPassword ? "text" : "password"}
                          placeholder="Minimum 6 characters"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="h-9.5 rounded-xl border border-border bg-white dark:bg-background text-xs"
                          required
                        />
                      </div>

                      <div className="space-y-0.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                          Confirm Password
                        </Label>
                        <Input
                          type="password"
                          placeholder="Re-enter password"
                          value={regConfirmPassword}
                          onChange={(e) => setRegConfirmPassword(e.target.value)}
                          className="h-9.5 rounded-xl border border-border bg-white dark:bg-background text-xs"
                          required
                        />
                      </div>

                      {/* Notice Pill matching Screenshot */}
                      <div className="p-2.5 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 flex items-start gap-2 text-[11px] text-foreground">
                        <div className="size-4 rounded-full border border-[#D4AF37] flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="size-2 text-[#D4AF37] stroke-[3]" />
                        </div>
                        <p className="leading-tight">
                          Upon registration, your personal QR attendance pass will be generated instantly for all enrolled courses.
                        </p>
                      </div>

                      <Button
                        type="submit"
                        disabled={regBusy}
                        className="w-full h-11 rounded-2xl bg-[#B8861B] hover:bg-[#A37415] text-white font-bold text-xs shadow-md cursor-pointer flex items-center justify-center gap-2 mt-2"
                      >
                        <UserPlus className="size-4" />
                        <span>{regBusy ? "Generating Pass..." : "Register & Generate QR Pass"}</span>
                      </Button>

                      <div className="text-center pt-1">
                        <p className="text-xs text-muted-foreground">
                          Already registered?{" "}
                          <button
                            type="button"
                            onClick={() => setActiveAuthTab("signin")}
                            className="text-foreground font-bold hover:underline cursor-pointer ml-1"
                          >
                            Sign In
                          </button>
                        </p>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // AUTHENTICATED STATE: 5 SIMPLIFIED TABS REQUESTED BY USER
  // =========================================================================
  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      {/* Title Bar matching faculty standard */}
      <QmarkTitleBar
        tag="STUDENT"
        user={{
          name: me.full_name,
          role: `${me.department ? me.department + " • " : ""}L${me.level}`,
          email: me.index_number,
        }}
        showBack={false}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 w-full max-w-4xl lg:max-w-[97vw] xl:max-w-[98vw] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6">
        {/* Active Live Session Alert */}
        {activeSession && (
          <div className="p-3.5 rounded-xl border border-[#B8861B]/40 bg-[#B8861B]/10 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Radio className="size-4 text-[#B8861B] animate-pulse shrink-0" />
              <div>
                <p className="font-bold text-foreground">
                  Live Attendance Open: {activeSession.courseCode || activeSession.title || "Class Session"}
                </p>
                <p className="text-muted-foreground text-[11px]">Show your QR pass below to check in.</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setPortalTab("qr")}
              className="h-8 text-xs font-bold bg-[#B8861B] hover:bg-[#A37315] text-white shrink-0 cursor-pointer"
            >
              Show QR Pass
            </Button>
          </div>
        )}

        {/* 5 Straightforward Nav Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl overflow-x-auto text-xs font-semibold select-none border border-border">
          <button
            type="button"
            onClick={() => setPortalTab("qr")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all shrink-0 cursor-pointer ${
              portalTab === "qr"
                ? "bg-card text-foreground shadow-xs font-bold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <QrCode className="size-4" />
            <span>My QR Code</span>
          </button>

          <button
            type="button"
            onClick={() => setPortalTab("attendance")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all shrink-0 cursor-pointer ${
              portalTab === "attendance"
                ? "bg-card text-foreground shadow-xs font-bold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarCheck className="size-4" />
            <span>Attendance</span>
          </button>

          <button
            type="button"
            onClick={() => setPortalTab("courses")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all shrink-0 cursor-pointer ${
              portalTab === "courses"
                ? "bg-card text-foreground shadow-xs font-bold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="size-4" />
            <span>Courses</span>
          </button>

          <button
            type="button"
            onClick={() => setPortalTab("notices")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all shrink-0 cursor-pointer ${
              portalTab === "notices"
                ? "bg-card text-foreground shadow-xs font-bold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Megaphone className="size-4" />
            <span>Notices & Tasks</span>
            {combinedFeed.length > 0 && (
              <span className="size-4 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center">
                {combinedFeed.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setPortalTab("notifications")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all shrink-0 cursor-pointer ${
              portalTab === "notifications"
                ? "bg-card text-foreground shadow-xs font-bold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BellRing className="size-4" />
            <span>Notifications</span>
            {notificationsList.length > 0 && (
              <span className="size-4 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center font-bold">
                {notificationsList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setPortalTab("settings")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all shrink-0 cursor-pointer ${
              portalTab === "settings"
                ? "bg-card text-foreground shadow-xs font-bold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings className="size-4" />
            <span>Settings</span>
          </button>
        </div>

        {/* TAB 1: MY QR CODE */}
        {portalTab === "qr" && (
          <div className="flex flex-col items-center justify-center py-4">
            <StudentQrPassCard
              student={{
                indexNumber: me.index_number,
                fullName: me.full_name,
                department: me.department,
                level: me.level,
                attendanceRate: overallRate,
                qrPayload: me.index_number,
              }}
              className="max-w-md w-full"
            />
            <p className="mt-4 text-xs text-muted-foreground text-center max-w-sm">
              Present this QR code to your lecturer's scanner or kiosk camera to record your attendance.
            </p>
          </div>
        )}

        {/* TAB 2: ATTENDANCE */}
        {portalTab === "attendance" && (
          <div className="space-y-6">
            <Card className="border border-border bg-card rounded-2xl shadow-xs">
              <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overall Standing</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-extrabold text-foreground">{overallRate}%</span>
                    <span className="text-xs font-semibold text-muted-foreground">Attendance Average</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {overallRate >= 75
                      ? "✓ Eligible for end-of-semester examinations."
                      : "⚠ At risk: Attendance is currently below the 75% examination threshold."}
                  </p>
                </div>
                <div className="w-full sm:w-48">
                  <Progress value={overallRate} className="h-2.5" />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground">Course Standing</h3>
              {courses.length === 0 ? (
                <Card className="p-6 text-center text-xs text-muted-foreground border-dashed border-border rounded-xl">
                  No registered courses found for this semester.
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {courses.map((c) => (
                    <Card key={c.course_id} className="p-4 border border-border bg-card rounded-xl space-y-2 shadow-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Badge variant="outline" className="text-[10px] font-mono font-bold mb-1">
                            {c.code}
                          </Badge>
                          <p className="text-xs font-bold text-foreground line-clamp-1">{c.title}</p>
                        </div>
                        <span className="text-base font-extrabold text-foreground">{c.percentage}%</span>
                      </div>
                      <Progress value={c.percentage} className="h-1.5" />
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                        <span>
                          {c.attended} of {c.sessions_total} sessions attended
                        </span>
                        <span
                          className={`font-semibold ${
                            c.percentage >= 75 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {c.percentage >= 75 ? "Eligible" : "Warning"}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground">Recent Check-In History</h3>
              {history.length === 0 ? (
                <Card className="p-6 text-center text-xs text-muted-foreground border-dashed border-border rounded-xl">
                  No attendance records recorded yet.
                </Card>
              ) : (
                <Card className="border border-border bg-card rounded-xl divide-y divide-border overflow-hidden">
                  {history.slice(0, 8).map((h) => (
                    <div key={h.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <p className="font-semibold text-foreground">{h.course_code || h.session_title}</p>
                          <p className="text-[11px] text-muted-foreground">{h.session_date}</p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-none text-[10px]">
                        PRESENT
                      </Badge>
                    </div>
                  ))}
                </Card>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: COURSES */}
        {portalTab === "courses" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Enrolled Courses ({courses.length})</h3>
              <Badge variant="outline" className="text-xs">
                Level {me.level}
              </Badge>
            </div>

            {courses.length === 0 ? (
              <Card className="p-8 text-center text-xs text-muted-foreground border-dashed border-border rounded-xl">
                No enrolled courses for your level currently.
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {courses.map((c) => (
                  <Card key={c.course_id} className="p-4 border border-border bg-card rounded-xl space-y-3 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted text-foreground">
                          {c.code}
                        </span>
                        <h4 className="text-sm font-bold text-foreground line-clamp-1">{c.title}</h4>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {c.credit_hours} Credits
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border">
                      <p>Lecturer: {c.lecturer_name || "Faculty Staff"}</p>
                      <p>Semester: {c.semester || "Current"}</p>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-muted-foreground">Attendance:</span>
                      <span className="font-bold text-foreground">{c.percentage}%</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: NOTICES & TASKS */}
        {portalTab === "notices" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFeedFilter("all")}
                className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                  feedFilter === "all" ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground"
                }`}
              >
                All Updates
              </button>
              <button
                type="button"
                onClick={() => setFeedFilter("announcements")}
                className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                  feedFilter === "announcements" ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground"
                }`}
              >
                Announcements ({announcements.length})
              </button>
              <button
                type="button"
                onClick={() => setFeedFilter("assignments")}
                className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                  feedFilter === "assignments" ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground"
                }`}
              >
                Assignments ({assignments.length})
              </button>
            </div>

            {combinedFeed.length === 0 ? (
              <Card className="p-8 text-center text-xs text-muted-foreground border-dashed border-border rounded-xl">
                No announcements or assignments posted yet.
              </Card>
            ) : (
              <div className="space-y-3">
                {combinedFeed.map((item) => (
                  <Card key={item.id} className="p-4 border border-border bg-card rounded-xl space-y-2 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {item.type === "assignment" ? (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-none text-[10px] gap-1">
                            <ClipboardList className="size-3" /> Assignment
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-none text-[10px] gap-1">
                            <Megaphone className="size-3" /> Announcement
                          </Badge>
                        )}
                        {item.courseCode && (
                          <span className="font-mono text-[11px] font-bold text-muted-foreground">
                            {item.courseCode}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(item.date).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-foreground">{item.title}</h4>
                    <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{item.body}</p>

                    {item.dueDate && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold pt-1">
                        <Clock className="size-3.5" />
                        <span>Due: {new Date(item.dueDate).toLocaleString()}</span>
                      </div>
                    )}

                    {item.link && (
                      <div className="pt-2">
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                        >
                          <span>Open Submission Link</span>
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: NOTIFICATION HISTORY (DEDICATED NOTIFICATION TAB AS REQUESTED) */}
        {portalTab === "notifications" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <BellRing className="size-4.5 text-primary" />
                  <span>Notification History & Alerts</span>
                  {notificationsList.length > 0 && (
                    <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-primary/10 text-primary font-bold">
                      {notificationsList.length} total
                    </Badge>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Real-time push notifications, class session alerts, announcements, and task updates for {me.index_number}.
                </p>
              </div>

              {/* Action buttons: Clear All and Refresh */}
              <div className="flex items-center gap-2">
                {notificationsList.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllNotifications}
                    className="h-8 text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Clear all</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadNotifications(me.id, me.index_number)}
                  disabled={notifLoading}
                  className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`size-3.5 ${notifLoading ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </Button>
              </div>
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
              {[
                { id: "all", label: `All Alerts (${notificationsList.length})` },
                {
                  id: "ANNOUNCEMENT",
                  label: `Announcements (${notificationsList.filter((n) => n.type?.toUpperCase() === "ANNOUNCEMENT").length})`,
                },
                {
                  id: "ASSIGNMENT",
                  label: `Assignments (${notificationsList.filter((n) => n.type?.toUpperCase() === "ASSIGNMENT").length})`,
                },
                {
                  id: "ATTENDANCE",
                  label: `Attendance (${notificationsList.filter((n) => n.type?.toUpperCase() === "ATTENDANCE").length})`,
                },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setNotifFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                    notifFilter === f.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Notification Messages List */}
            <div className="rounded-2xl border border-border bg-card divide-y overflow-hidden shadow-xs">
              {notifLoading && notificationsList.length === 0 ? (
                <div className="p-10 text-center text-xs text-muted-foreground space-y-2">
                  <RefreshCw className="size-6 animate-spin mx-auto text-primary" />
                  <p className="font-semibold text-sm">Loading notification history...</p>
                </div>
              ) : notificationsList.filter((item) =>
                  notifFilter === "all" ? true : item.type?.toUpperCase() === notifFilter.toUpperCase(),
                ).length === 0 ? (
                <div className="p-10 text-center text-xs text-muted-foreground space-y-2">
                  <Inbox className="size-9 text-muted-foreground/40 mx-auto" />
                  <p className="font-bold text-foreground text-sm">All caught up!</p>
                  <p className="max-w-sm mx-auto text-muted-foreground">
                    No notification messages here right now. When your course lecturers post announcements, assign coursework, or start roll calls, all notifications will arrive here.
                  </p>
                </div>
              ) : (
                notificationsList
                  .filter((item) =>
                    notifFilter === "all" ? true : item.type?.toUpperCase() === notifFilter.toUpperCase(),
                  )
                  .map((n) => {
                    const isAnnouncement = n.type?.toUpperCase() === "ANNOUNCEMENT";
                    const isAssignment = n.type?.toUpperCase() === "ASSIGNMENT";
                    const isAttendance = n.type?.toUpperCase() === "ATTENDANCE";

                    return (
                      <div
                        key={n.id}
                        className={`p-4 sm:p-5 flex items-start gap-3.5 transition-colors ${
                          !n.isRead ? "bg-primary/5 font-medium" : "hover:bg-muted/30"
                        }`}
                      >
                        <div
                          className={`size-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isAnnouncement
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                              : isAssignment
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                              : isAttendance
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isAnnouncement ? (
                            <Megaphone className="size-4.5" />
                          ) : isAssignment ? (
                            <FileText className="size-4.5" />
                          ) : isAttendance ? (
                            <CalendarCheck className="size-4.5" />
                          ) : (
                            <Bell className="size-4.5" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground">
                                {n.title}
                              </span>
                              {!n.isRead && (
                                <span className="size-2 rounded-full bg-primary shrink-0" />
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                              <Clock className="size-3" />
                              {n.createdAt ? new Date(n.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }) : "Recently"}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground leading-relaxed break-words">
                            {n.body}
                          </p>

                          <div className="pt-2 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 uppercase font-semibold">
                                {n.type || "UPDATE"}
                              </Badge>
                              {n.url && typeof n.url === "string" && n.url !== "#" && (
                                <a
                                  href={n.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-semibold"
                                >
                                  <span>View Related Page</span>
                                  <ExternalLink className="size-3" />
                                </a>
                              )}
                            </div>

                            {/* Individual Delete Button */}
                            <button
                              type="button"
                              onClick={() => deleteSingleNotification(n.id)}
                              className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1 cursor-pointer transition-colors p-1 rounded-md hover:bg-destructive/10"
                              title="Delete notification"
                              aria-label="Delete notification"
                            >
                              <Trash2 className="size-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Notification Device Settings */}
            <Card className="border border-border bg-card rounded-2xl shadow-xs overflow-hidden mt-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BellRing className="size-4 text-primary" /> Device Notification Settings
                </CardTitle>
                <CardDescription className="text-xs">
                  Configure browser & phone push notifications for class notices and attendance alerts.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-1">
                <PushNotificationManager
                  userContext={{
                    userId: me.id,
                    userRole: "student",
                    studentIndex: me.index_number,
                  }}
                  showCard={false}
                  hideHistory={true}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 6: SETTINGS */}
        {portalTab === "settings" && (
          <div className="space-y-6">
            <Card className="border border-border bg-card rounded-2xl shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <User className="size-4 text-primary" /> Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">Full Name</span>
                  <span className="font-bold text-foreground">{me.full_name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">Index Number</span>
                  <span className="font-mono font-bold text-foreground">{me.index_number}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">Department</span>
                  <span className="text-foreground">{me.department || "General Studies"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Academic Level</span>
                  <span className="text-foreground">Level {me.level}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border bg-card rounded-2xl shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BellRing className="size-4 text-primary" /> Notification Preferences
                </CardTitle>
                <CardDescription className="text-xs">
                  Manage push alerts and live session notifications on this device.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <PushNotificationManager
                  userContext={{
                    userId: me.id,
                    userRole: "student",
                    studentIndex: me.index_number,
                  }}
                  hideHistory={true}
                />
              </CardContent>
            </Card>

            <Card className="border border-border bg-card rounded-2xl shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Lock className="size-4 text-primary" /> Change Passcode
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Current Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="h-9 text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">New Password</Label>
                    <Input
                      type="password"
                      placeholder="At least 6 characters"
                      value={newSettingsPassword}
                      onChange={(e) => setNewSettingsPassword(e.target.value)}
                      className="h-9 text-xs"
                      required
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={changingPass} className="h-8 text-xs font-bold cursor-pointer">
                    {changingPass ? "Updating..." : "Update Password"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border border-destructive/20 bg-destructive/5 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-destructive">Sign Out of Student Portal</p>
                <p className="text-[11px] text-muted-foreground">Clear your saved session on this device.</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleSignOut}
                className="h-8 text-xs font-bold cursor-pointer"
              >
                <LogOut className="size-3.5 mr-1" />
                Sign Out
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
