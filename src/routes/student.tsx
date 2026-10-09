import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
  Home,
} from "lucide-react";
import { toast } from "sonner";
import { StudentQrPassCard } from "@/components/StudentQrPassCard";
import { QmarkTitleBar } from "@/components/QmarkTitleBar";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { NotificationPermissionModal } from "@/components/NotificationPermissionModal";
import { syncPushSubscriptionIfGranted } from "@/lib/push-client";

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
    // Drop cached portal data on sign-out
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("qmark_portal_cache_"))
      .forEach((k) => sessionStorage.removeItem(k));
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

type StudentAuthTab = "signin" | "activate" | "reset";
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
  // Check if this device has activated or signed into a student account before
  const [activeAuthTab, setActiveAuthTab] = useState<StudentAuthTab>(() => {
    if (typeof window !== "undefined") {
      const hasActivated =
        localStorage.getItem("qmark_student_has_activated") === "true" ||
        Boolean(localStorage.getItem(STORE)) ||
        localStorage.getItem("qroll_student_session") === "true";
      return hasActivated ? "signin" : "activate";
    }
    return "activate";
  });

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
  const [portalTab, setPortalTab] = useState<PortalTabType>("attendance");
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

  // Portal data is cached in this browser tab for 3 minutes, so refreshing the page
  // or signing back in does not hit the database again.
  const PORTAL_CACHE_MS = 3 * 60 * 1000;
  const applyPortalData = useCallback((data: any) => {
    if (data.student) setMe(data.student);
    if (Array.isArray(data.courses)) setCourses(data.courses);
    if (Array.isArray(data.history)) setHistory(data.history);
    if (Array.isArray(data.announcements)) setAnnouncements(data.announcements);
    if (Array.isArray(data.assignments)) setAssignments(data.assignments);
    if (Array.isArray(data.active_sessions)) {
      setActiveSession(data.active_sessions.length > 0 ? data.active_sessions[0] : null);
    }
  }, []);

  // Push Notification auto-sync & prompt for student
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  useEffect(() => {
    if (!me?.id) return;
    const studentUserContext = {
      userId: me.index_number || me.id,
      userRole: "student" as const,
      studentId: me.id,
      indexNumber: me.index_number,
      level: me.level,
    };

    // If permission already granted, silently ensure backend has this device registered
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      void syncPushSubscriptionIfGranted(studentUserContext);
      return;
    }

    // If not yet granted or denied, prompt user with modal
    try {
      const promptShown =
        localStorage.getItem(`qmark_notification_prompt_shown_${me.index_number}`) ||
        localStorage.getItem(`qmark_notification_prompt_shown_${me.id}`);
      if (!promptShown && typeof Notification !== "undefined" && Notification.permission === "default") {
        const timer = setTimeout(() => {
          setShowNotificationModal(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore storage error
    }
  }, [me?.id, me?.index_number, me?.level]);

  const loadingDataRef = useRef(false);
  const loadStudentData = useCallback(
    async (userIndex: string, userPass?: string, force = false) => {
      const cacheKey = `qmark_portal_cache_${userIndex.toUpperCase()}`;
      if (!force) {
        try {
          const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
          if (cached && Date.now() - cached.t < PORTAL_CACHE_MS) {
            applyPortalData(cached.data);
            if (cached.data?.student) {
              loadNotifications(cached.data.student.id, cached.data.student.index_number);
            }
            return;
          }
        } catch {
          // ignore bad cache
        }
      }
      // Never run two loads at the same time
      if (loadingDataRef.current) return;
      loadingDataRef.current = true;
      try {
        const dataRes = await fetch("/api/public/student-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "data", index: userIndex, password: userPass }),
        });
        const data = await dataRes.json();
        if (!dataRes.ok) {
          console.error("Portal data error:", data?.error);
          if (dataRes.status === 429 || dataRes.status === 503) {
            toast.error("Qmark is busy right now. Please try again in a few minutes.");
          }
          return;
        }
        applyPortalData(data);
        if (data.student) {
          loadNotifications(data.student.id, data.student.index_number);
        }
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), data }));
        } catch {
          // storage full; ignore
        }
      } catch (err) {
        console.error("Error loading student portal data:", err);
      } finally {
        loadingDataRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyPortalData],
  );

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

        localStorage.setItem("qmark_student_has_activated", "true");
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

  // Restore stored session (runs once per page load, never in a loop)
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
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
          department: regDepartment,
          email: regEmail.trim(),
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error || "Registration failed");
        return;
      }

      if (data.assigned_classes > 0) {
        toast.success("Account registered and added to your class list. Entering portal...");
      } else {
        toast.success("Account registered. Your lecturer has not set up your class in Qmark yet, so ask them to add you.", {
          duration: 8000,
        });
      }
      localStorage.setItem("qmark_student_has_activated", "true");
      saveStudentSession(upperIdx, regPassword);
      localStorage.setItem("qroll_student_session", "true");
      localStorage.setItem("qroll_active_gateway", "student");
      setMe(data.student);
      void loadStudentData(upperIdx, regPassword, true);
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
      localStorage.setItem("qmark_student_has_activated", "true");
      saveStudentSession(upperIdx, actPassword);
      localStorage.setItem("qroll_student_session", "true");
      localStorage.setItem("qroll_active_gateway", "student");
      setMe(data.student);
      void loadStudentData(upperIdx, actPassword, true);
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
      localStorage.setItem("qmark_student_has_activated", "true");
      saveStudentSession(upperIdx, resetNewPassword);
      localStorage.setItem("qroll_student_session", "true");
      localStorage.setItem("qroll_active_gateway", "student");
      setMe(data.student);
      void loadStudentData(upperIdx, resetNewPassword, true);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setResetBusy(false);
    }
  };

  const handleSignOut = () => {
    clearStudentSession();
    // This device has an activated account, so show Sign In next time
    setActiveAuthTab("signin");
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

  const totalSessions = useMemo(() => {
    return courses.reduce((acc, c) => acc + (c.sessions_total || 0), 0);
  }, [courses]);

  const totalAttended = useMemo(() => {
    return courses.reduce((acc, c) => acc + (c.attended || 0), 0);
  }, [courses]);

  const formattedDate = useMemo(() => {
    return new Date()
      .toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "long" })
      .replace(",", " ·");
  }, []);

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

        {/* Main Split-Card Container */}
        <div className="flex-1 flex items-center justify-center p-2.5 sm:p-5 lg:p-8 my-auto w-full">
          <div className="w-full max-w-4xl rounded-[22px] sm:rounded-[28px] border border-[#D4AF37]/35 shadow-2xl bg-card overflow-hidden grid grid-cols-1 md:grid-cols-12">
            {/* ------------------------------------------------------------- */}
            {/* LEFT COLUMN: Deep Navy #0A1F44 with Black Students Hero Image */}
            {/* Compact and short so students immediately see the login box   */}
            {/* ------------------------------------------------------------- */}
            <div className="md:col-span-5 bg-[#0A1F44] text-white p-3.5 sm:p-5 md:p-8 flex flex-col justify-between relative overflow-hidden select-none min-h-[68px] sm:min-h-[84px] md:min-h-[460px]">
              {/* Strategic Black Students Campus Hero Image Background - Vibrant and clearly visible */}
              <img
                src="/knust-students-hero.jpg"
                alt="University Students on Campus"
                className="absolute inset-0 size-full object-cover object-center filter brightness-95 contrast-105"
              />
              {/* Subtle gradient overlay so the photo is brightly visible */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 backdrop-blur-[0.5px]" />

              {/* Top Logo & Status Capsule */}
              <div className="relative z-10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <div className="size-8 sm:size-9 md:size-10 rounded-xl bg-black/40 border border-white/30 flex items-center justify-center p-1 sm:p-1.5 shadow-sm backdrop-blur-md">
                    <img src="/qmark_icon_standalone.png" alt="Qmark" className="size-full object-contain" />
                  </div>
                  <div>
                    <h1 className="text-base sm:text-lg md:text-xl font-extrabold tracking-tight text-white flex items-center gap-0.5 leading-none drop-shadow-md">
                      Q<span className="text-[#D4AF37]">mark</span>
                    </h1>
                    <p className="text-[8px] sm:text-[9px] md:text-[10px] font-bold tracking-widest text-white/90 uppercase mt-0.5 drop-shadow-sm">
                      Student Pass
                    </p>
                  </div>
                </div>

                <div>
                  <span className="inline-flex items-center text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white bg-black/40 border border-white/30 px-2.5 py-0.5 rounded-full backdrop-blur-md shadow-xs">
                    Student Pass
                  </span>
                </div>
              </div>

              {/* Bottom Title: Clean & Compact, zero scroll obstruction, desktop only */}
              <div className="relative z-10 pt-4 md:pt-0 drop-shadow-md hidden md:block">
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white leading-tight">
                  Your Personal Digital QR Pass
                </h2>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* RIGHT COLUMN: Form Panel with the 4 Top Tabs                */}
            {/* ------------------------------------------------------------- */}
            <div className="md:col-span-7 bg-[#FAF8F5] dark:bg-[#0A1F44]/90 p-5 sm:p-7 flex flex-col justify-between">
              <div>
                {/* 3 Tabs Segmented Capsule: Sign In -> Activate -> Reset */}
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

        {/* Nav Tabs: Home (attendance dashboard) comes first */}
        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl overflow-x-auto text-xs font-semibold select-none border border-border">
          <button
            type="button"
            onClick={() => setPortalTab("attendance")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all shrink-0 cursor-pointer ${
              portalTab === "attendance"
                ? "bg-card text-foreground shadow-xs font-bold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Home className="size-4" />
            <span>Home</span>
          </button>

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

        {/* TAB 2: ATTENDANCE (REDESIGNED STUDENT HOMEPAGE MATCHING LECTURER DASHBOARD) */}
        {portalTab === "attendance" && (
          <div className="dash-scope space-y-6 sm:space-y-8 pb-10">
            <style>{`
              .dash-scope {
                --ink: #071733;
                --navy-1: #06142F;
                --navy-2: #0C2656;
                --navy-3: #1A4A9C;
                --gold: #D9B64A;
                --gold-hi: #F3DB8B;
                --gold-lo: #B8922A;
                --muted: #6F7C99;
                --line: rgba(10, 31, 68, .07);
                --ease: cubic-bezier(.22, 1, .36, 1);
              }

              /* entrance animations */
              .dash-in {
                opacity: 0;
                transform: translateY(18px);
                animation: dashRise .8s var(--ease) forwards;
                animation-delay: var(--d, 0s);
              }
              @keyframes dashRise {
                to {
                  opacity: 1;
                  transform: none;
                }
              }

              /* greeting */
              .dash-hello {
                margin: 10px 0 16px;
              }
              .dash-hello .d {
                font-size: 12px;
                font-weight: 700;
                letter-spacing: .09em;
                text-transform: uppercase;
                color: var(--muted);
              }
              .dash-hello h1 {
                margin: 6px 0 0;
                font-size: 30px;
                font-weight: 800;
                letter-spacing: -.035em;
                line-height: 1.08;
                color: var(--ink);
              }
              @media (min-width: 640px) {
                .dash-hello h1 {
                  font-size: 38px;
                }
              }
              .dark .dash-hello h1 {
                color: #FFFFFF;
              }
              .dash-hello h1 span {
                background: linear-gradient(100deg, #0C2656, #1A4A9C);
                -webkit-background-clip: text;
                background-clip: text;
                color: transparent;
              }
              .dark .dash-hello h1 span {
                background: linear-gradient(100deg, #F3DB8B, #D9B64A);
                -webkit-background-clip: text;
                background-clip: text;
                color: transparent;
              }

              /* hero with wavy, moving bottom edge */
              .dash-hero-wrap {
                filter: drop-shadow(0 22px 22px rgba(12,38,86,.30));
              }
              .dash-hero {
                --wave: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='30' viewBox='0 0 360 30'%3E%3Cpath d='M0 0H360V16C300 30 240 30 180 16C120 2 60 2 0 16Z'/%3E%3C/svg%3E");
                position: relative;
                padding: 24px 22px 58px;
                color: #fff;
                overflow: hidden;
                border-radius: 30px 30px 0 0;
                background:
                  radial-gradient(260px 220px at 92% 0%, rgba(243,219,139,.30), transparent 70%),
                  radial-gradient(300px 260px at 0% 100%, rgba(26,74,156,.75), transparent 70%),
                  linear-gradient(155deg, var(--navy-1) 0%, var(--navy-2) 55%, #123A7E 100%);
                -webkit-mask: linear-gradient(#000, #000) 0 0 / 100% calc(100% - 29px) no-repeat, var(--wave) 0 100% / 360px 30px repeat-x;
                        mask: linear-gradient(#000, #000) 0 0 / 100% calc(100% - 29px) no-repeat, var(--wave) 0 100% / 360px 30px repeat-x;
                animation: dashEdge 9s linear infinite;
              }
              @media (min-width: 768px) {
                .dash-hero {
                  padding: 32px 32px 64px;
                }
              }
              @keyframes dashEdge {
                to {
                  -webkit-mask-position: 0 0, 360px 100%;
                  mask-position: 0 0, 360px 100%;
                }
              }

              /* rim light that travels with the edge */
              .dash-hero::before,
              .dash-hero::after {
                content: "";
                position: absolute;
                left: 0;
                right: 0;
                bottom: 0;
                height: 30px;
                pointer-events: none;
                background-repeat: repeat-x;
                background-size: 360px 30px;
              }
              .dash-hero::before {
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='30' viewBox='0 0 360 30'%3E%3Cpath d='M0 0H360V13C300 27 240 27 180 13C120 -1 60 -1 0 13Z' fill='white' fill-opacity='.07'/%3E%3C/svg%3E");
                background-position: 180px 0;
                animation: dashDriftR 13s linear infinite;
              }
              .dash-hero::after {
                bottom: 2px;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='30' viewBox='0 0 360 30'%3E%3Cpath d='M0 14C60 0 120 0 180 14C240 28 300 28 360 14' fill='none' stroke='%23F3DB8B' stroke-opacity='.55' stroke-width='1.6'/%3E%3C/svg%3E");
                animation: dashDrift 9s linear infinite;
              }
              @keyframes dashDrift {
                to {
                  background-position: 360px 0;
                }
              }
              @keyframes dashDriftR {
                from {
                  background-position: 180px 0;
                }
                to {
                  background-position: -180px 0;
                }
              }

              /* radar rings */
              .dash-rings {
                position: absolute;
                right: -50px;
                top: -50px;
                width: 190px;
                height: 190px;
                pointer-events: none;
              }
              .dash-rings i {
                position: absolute;
                inset: 0;
                border-radius: 50%;
                border: 1px solid rgba(243,219,139,.35);
                animation: dashPing 4.5s ease-out infinite;
              }
              .dash-rings i:nth-child(2) {
                animation-delay: 1.5s;
              }
              .dash-rings i:nth-child(3) {
                animation-delay: 3s;
              }
              @keyframes dashPing {
                0% {
                  transform: scale(.35);
                  opacity: .9;
                }
                100% {
                  transform: scale(1.1);
                  opacity: 0;
                }
              }

              .dash-row {
                position: relative;
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              .dash-eyebrow {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: .14em;
                text-transform: uppercase;
                color: var(--gold-hi);
              }
              .dash-eyebrow svg {
                width: 15px;
                height: 15px;
                stroke: currentColor;
                fill: none;
                stroke-width: 2;
                stroke-linecap: round;
              }
              .dash-when {
                font-size: 12px;
                font-weight: 700;
                padding: 6px 12px;
                border-radius: 20px;
                color: var(--gold-hi);
                background: rgba(243,219,139,.10);
                border: 1px solid rgba(243,219,139,.28);
                backdrop-filter: blur(6px);
              }
              .dash-hero h2 {
                position: relative;
                margin: 16px 0 6px;
                font-weight: 800;
                letter-spacing: -.04em;
                line-height: 1.05;
              }
              .dash-hero h2 em {
                font-style: normal;
                font-weight: 500;
                color: rgba(255,255,255,.55);
              }
              .dash-hero .meta {
                position: relative;
                margin: 0;
                font-weight: 500;
                color: rgba(255,255,255,.68);
              }

              .dash-go {
                position: relative;
                overflow: hidden;
                width: 100%;
                height: 58px;
                border: 0;
                border-radius: 20px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                font: 800 16px 'Manrope', sans-serif;
                letter-spacing: -.01em;
                color: var(--ink);
                background: linear-gradient(180deg, var(--gold-hi) 0%, var(--gold) 55%, var(--gold-lo) 100%);
                box-shadow: 0 10px 24px rgba(217,182,74,.35), inset 0 1px 0 rgba(255,255,255,.7);
                transition: transform .25s var(--ease), box-shadow .25s var(--ease);
              }
              .dash-go::after {
                content: "";
                position: absolute;
                top: 0;
                bottom: 0;
                width: 60px;
                left: -80px;
                transform: skewX(-20deg);
                background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
                animation: dashSheen 3.8s ease-in-out infinite 1.2s;
              }
              @keyframes dashSheen {
                0%, 55% {
                  left: -80px;
                }
                100% {
                  left: 120%;
                }
              }
              .dash-go:hover {
                transform: translateY(-2px);
                box-shadow: 0 16px 30px rgba(217,182,74,.45), inset 0 1px 0 rgba(255,255,255,.7);
              }
              .dash-go:active {
                transform: scale(.97);
              }
              .dash-scan-ico {
                position: relative;
                width: 22px;
                height: 22px;
              }
              .dash-scan-ico svg {
                width: 22px;
                height: 22px;
                stroke: var(--ink);
                fill: none;
                stroke-width: 2.2;
                stroke-linecap: round;
                stroke-linejoin: round;
              }
              .dash-scan-ico b {
                position: absolute;
                left: 4px;
                right: 4px;
                height: 2px;
                border-radius: 2px;
                background: var(--ink);
                animation: dashLine 2s ease-in-out infinite;
              }
              @keyframes dashLine {
                0%, 100% {
                  top: 5px;
                }
                50% {
                  top: 15px;
                }
              }

              .dash-alt {
                position: relative;
                display: block;
                margin: 12px auto 0;
                width: max-content;
                font-size: 13px;
                font-weight: 600;
                color: rgba(255,255,255,.72);
                text-decoration: none;
                padding-bottom: 2px;
                background: linear-gradient(var(--gold-hi), var(--gold-hi)) 0 100% / 0 1px no-repeat;
                transition: background-size .35s var(--ease), color .2s;
                cursor: pointer;
              }
              .dash-alt:hover {
                color: #fff;
                background-size: 100% 1px;
              }

              /* section headers */
              .dash-sec {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                margin: 24px 4px 12px;
              }
              .dash-sec h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 800;
                letter-spacing: -.02em;
                color: var(--ink);
              }
              .dark .dash-sec h3 {
                color: #FFFFFF;
              }
              .dash-sec a, .dash-sec button {
                font-size: 13px;
                font-weight: 700;
                color: var(--navy-3);
                text-decoration: none;
                background: transparent;
                border: 0;
                cursor: pointer;
              }
              .dark .dash-sec a, .dark .dash-sec button {
                color: var(--gold-hi);
              }

              /* card items */
              .dash-item {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 16px 18px;
                border-radius: 20px;
                background: rgba(255,255,255,.85);
                backdrop-filter: blur(10px);
                border: 1px solid var(--line);
                box-shadow: 0 6px 18px rgba(12,38,86,.06);
                transition: transform .3s var(--ease), box-shadow .3s var(--ease);
                text-decoration: none;
                color: inherit;
                cursor: pointer;
              }
              .dark .dash-item {
                background: rgba(12,38,86,.35);
                border: 1px solid rgba(255,255,255,.08);
                box-shadow: 0 6px 18px rgba(0,0,0,.25);
              }
              .dash-item:hover {
                transform: translateX(4px);
                box-shadow: 0 12px 26px rgba(12,38,86,.11);
              }
              .dash-item .t {
                width: 60px;
                text-align: center;
                font-weight: 800;
                font-size: 14px;
                letter-spacing: -.02em;
                line-height: 1.1;
                color: var(--ink);
              }
              .dark .dash-item .t {
                color: #FFFFFF;
              }
              .dash-item .t small {
                display: block;
                margin-top: 2px;
                font-size: 11px;
                font-weight: 700;
                color: var(--gold-lo);
                letter-spacing: 0;
              }
              .dark .dash-item .t small {
                color: var(--gold-hi);
              }
              .dash-item .bar {
                width: 3.5px;
                align-self: stretch;
                border-radius: 3px;
                background: linear-gradient(180deg, var(--gold-hi), var(--gold-lo));
              }
              .dash-item .n {
                flex: 1;
                min-width: 0;
              }
              .dash-item .n b {
                display: block;
                font-size: 15px;
                font-weight: 700;
                letter-spacing: -.01em;
                color: var(--ink);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .dark .dash-item .n b {
                color: #FFFFFF;
              }
              .dash-item .n span {
                font-size: 12px;
                color: var(--muted);
                font-weight: 500;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                display: block;
              }
              .dash-item svg {
                width: 18px;
                height: 18px;
                stroke: #9AA5BF;
                fill: none;
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
                transition: transform .3s var(--ease);
                flex-shrink: 0;
              }
              .dash-item:hover svg {
                transform: translateX(3px);
                stroke: var(--navy-2);
              }
              .dark .dash-item:hover svg {
                stroke: var(--gold-hi);
              }
            `}</style>

            {/* ---------- Greeting ---------- */}
            <div className="dash-hello dash-in flex flex-col sm:flex-row sm:items-end justify-between gap-4" style={{ "--d": ".08s" } as any}>
              <div>
                <div className="d">{formattedDate}</div>
                <h1>
                  Welcome,
                  <br />
                  <span>{me.full_name}</span>
                </h1>
              </div>

              {/* Quick status & rate pill on wide screens */}
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-white/80 dark:bg-white/10 border border-[#D4AF37]/30 dark:border-[#D4AF37]/25 backdrop-blur-md shadow-xs">
                  <span className={`size-2.5 rounded-full ${overallRate >= 75 ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse"}`} />
                  <span className="text-xs font-semibold text-muted-foreground">Attendance:</span>
                  <span className="text-sm font-bold text-foreground font-mono">{overallRate}%</span>
                </div>
                <div className="px-3 py-1.5 rounded-2xl border border-border bg-white/70 dark:bg-card text-[11px] font-bold text-foreground">
                  {overallRate >= 75 ? "✓ Exam Ready" : "⚠ At Risk"}
                </div>
              </div>
            </div>

            {/* ---------- Hero with wavy, moving bottom edge ---------- */}
            <div className="dash-hero-wrap dash-in" style={{ "--d": ".18s" } as any}>
              <section className="dash-hero">
                <div className="dash-rings">
                  <i></i>
                  <i></i>
                  <i></i>
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="dash-row justify-start gap-3">
                      <span className="dash-eyebrow">
                        <svg viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7v5l3 2" />
                        </svg>
                        {activeSession ? "Live Session" : "Academic Pass"}
                      </span>
                      <span className="dash-when">
                        {activeSession ? "Roll Call Open" : `Level ${me.level || "200"}`}
                      </span>
                    </div>

                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
                      {activeSession?.courseCode || courses[0]?.code || "Qmark"} <em>{activeSession?.title || courses[0]?.title || "Student Pass"}</em>
                    </h2>
                    <p className="meta text-sm sm:text-base">
                      {activeSession
                        ? "Active lecture session in progress · Tap below to verify attendance"
                        : `Index: ${me.index_number} · ${me.department || me.program || "KNUST"}`}
                    </p>
                  </div>

                  <div className="flex flex-col items-center md:items-end shrink-0 w-full md:w-auto">
                    {activeSession ? (
                      <Link
                        to={`/check-in?session=${activeSession.id}` as string}
                        className="w-full md:w-auto"
                        style={{ textDecoration: "none" }}
                      >
                        <button className="dash-go md:min-w-[260px] md:px-8">
                          <span className="dash-scan-ico">
                            <svg viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="2" />
                              <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
                            </svg>
                            <b></b>
                          </span>
                          Check In to Class
                        </button>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPortalTab("qr")}
                        className="dash-go md:min-w-[260px] md:px-8"
                      >
                        <span className="dash-scan-ico">
                          <svg viewBox="0 0 24 24">
                            <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
                          </svg>
                          <b></b>
                        </span>
                        Open My Pass
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setPortalTab(activeSession ? "qr" : "courses")}
                      className="dash-alt"
                    >
                      {activeSession ? "or present digital QR pass" : "or view course standing breakdown"}
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {/* ---------- Metric Stat Cards (Matching Lecturer Aesthetic) ---------- */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 dash-in" style={{ "--d": ".26s" } as any}>
              <div className="p-4 rounded-2xl bg-white/80 dark:bg-white/5 border border-border shadow-xs backdrop-blur-md">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Overall Attendance</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-foreground">{overallRate}%</span>
                  <span className={`text-[11px] font-bold ${overallRate >= 75 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {overallRate >= 75 ? "Eligible" : "Warning"}
                  </span>
                </div>
                <Progress value={overallRate} className="h-1.5 mt-2.5" />
              </div>

              <div className="p-4 rounded-2xl bg-white/80 dark:bg-white/5 border border-border shadow-xs backdrop-blur-md">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Attended Sessions</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-foreground">{totalAttended}</span>
                  <span className="text-xs font-semibold text-muted-foreground">of {totalSessions} total</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 truncate">Recorded class roll-calls</p>
              </div>

              <div className="p-4 rounded-2xl bg-white/80 dark:bg-white/5 border border-border shadow-xs backdrop-blur-md">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Registered Courses</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-foreground">{courses.length}</span>
                  <span className="text-xs font-semibold text-muted-foreground">Courses</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 truncate">Level {me.level || "200"} Semester Roster</p>
              </div>

              <div className="p-4 rounded-2xl bg-white/80 dark:bg-white/5 border border-border shadow-xs backdrop-blur-md">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Exam Status</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-xl sm:text-2xl font-extrabold ${overallRate >= 75 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {overallRate >= 75 ? "Qualified" : "Review Req."}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 truncate">75% attendance threshold</p>
              </div>
            </div>

            {/* ---------- Enrolled Courses & Class Schedule (dash-item cards) ---------- */}
            <div className="space-y-3">
              <div className="dash-sec dash-in" style={{ "--d": ".34s" } as any}>
                <h3>Course Schedule & Standing</h3>
                <button type="button" onClick={() => setPortalTab("courses")}>See all</button>
              </div>

              {courses.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground border-dashed border border-border rounded-2xl bg-card">
                  No courses currently registered for this semester.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                  {courses.map((item, idx) => (
                    <div
                      key={item.course_id}
                      onClick={() => setPortalTab("courses")}
                      className="dash-item dash-in"
                      style={{ "--d": `${0.4 + idx * 0.07}s` } as any}
                    >
                      <div className="t">
                        {item.code}
                        <small>{item.percentage}%</small>
                      </div>
                      <div className="bar" />
                      <div className="n">
                        <b>{item.title}</b>
                        <span>
                          {item.attended} of {item.sessions_total} sessions · {item.percentage >= 75 ? "Eligible" : "Warning"}
                        </span>
                      </div>
                      <svg viewBox="0 0 24 24">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ---------- Recent Check-In History ---------- */}
            <div className="space-y-3 pt-2">
              <div className="dash-sec dash-in" style={{ "--d": ".48s" } as any}>
                <h3>Recent Attendance History</h3>
                <button type="button" onClick={() => setPortalTab("qr")}>View Pass</button>
              </div>

              {history.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border-dashed border border-border rounded-2xl bg-card">
                  No attendance check-ins recorded yet this semester.
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-xs">
                  {history.slice(0, 6).map((h) => (
                    <div key={h.id} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="size-4" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground text-sm">{h.course_code || h.session_title || "Lecture"}</p>
                          <p className="text-[11px] text-muted-foreground">{h.session_date}</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        VERIFIED
                      </span>
                    </div>
                  ))}
                </div>
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
                    userId: me.index_number || me.id,
                    userRole: "student",
                    studentId: me.id,
                    indexNumber: me.index_number,
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

      {me && (
        <NotificationPermissionModal
          open={showNotificationModal}
          onClose={() => setShowNotificationModal(false)}
          onSuccess={() => {
            if (me) {
              void syncPushSubscriptionIfGranted({
                userId: me.index_number || me.id,
                userRole: "student",
                studentId: me.id,
                indexNumber: me.index_number,
                level: me.level,
              });
            }
          }}
          userContext={{
            userId: me.index_number || me.id,
            userRole: "student",
            studentId: me.id,
            indexNumber: me.index_number,
            level: me.level,
          }}
        />
      )}
    </div>
  );
}
