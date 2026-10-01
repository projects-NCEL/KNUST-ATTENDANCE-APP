import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, User, LogOut, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect, type ReactNode } from "react";

export interface QmarkTitleBarProps {
  onBack?: () => void;
  backTo?: string;
  tag?: string;
  user?: {
    name?: string;
    avatarUrl?: string;
    email?: string;
    role?: string;
  } | null;
  notificationUserId?: string | null;
  onSignOut?: () => void;
  extraActions?: ReactNode;
  showBack?: boolean;
  showMenuButton?: boolean;
  onToggleSidebar?: () => void;
}

export function QmarkTitleBar({
  onBack,
  backTo,
  tag = "GH",
  user,
  notificationUserId: _notificationUserId,
  onSignOut,
  extraActions,
  showBack = true,
  showMenuButton = false,
  onToggleSidebar,
}: QmarkTitleBarProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const userPillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (userPillRef.current && !userPillRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, []);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate({ to: backTo as string });
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      navigate({ to: "/" });
    }
  };

  const displayName = user?.name ? user.name.trim().split(" ")[0] : null;
  const initial = (
    user?.name?.trim()?.charAt(0) ||
    user?.email?.trim()?.charAt(0) ||
    "P"
  ).toUpperCase();

  // Clicking Qmark logo/emblem returns to active dashboard (lecturer dashboard or student pass)
  const dashboardTarget =
    user?.role === "student" ||
    (typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/student") ||
        localStorage.getItem("qroll_active_gateway") === "student"))
      ? "/student"
      : "/dashboard";

  return (
    <header className="sticky top-0 mt-0 pt-0 z-40 w-full bg-white/95 dark:bg-[#0A1F44]/95 backdrop-blur-md rounded-b-[28px] sm:rounded-b-[36px] border-b-2 border-[#D4AF37]/40 shadow-[0_4px_24px_-4px_rgba(10,31,68,0.08),0_1px_2px_rgba(212,175,55,0.12)] transition-all">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2.5 sm:gap-3 min-w-0">
        {/* Left Side: Menu Toggle, Circular Back Button & Emblem + App Name + Tag */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {showMenuButton && (
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label="Toggle navigation menu"
              className="size-9 sm:size-10 rounded-full bg-[#F0F4F8] hover:bg-[#E2E8F0] dark:bg-slate-800/90 dark:hover:bg-slate-700/90 border border-slate-200/90 dark:border-slate-700/80 flex items-center justify-center text-[#0A1F44] dark:text-slate-100 shadow-2xs transition-all cursor-pointer shrink-0"
              title="Menu"
            >
              <Menu className="size-5 shrink-0" />
            </button>
          )}

          {showBack && (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Go back"
              className="size-9 sm:size-10 rounded-full bg-[#F0F4F8] hover:bg-[#E2E8F0] dark:bg-slate-800/90 dark:hover:bg-slate-700/90 border border-slate-200/90 dark:border-slate-700/80 flex items-center justify-center text-[#0A1F44] dark:text-slate-100 shadow-2xs transition-all cursor-pointer shrink-0"
              title="Go back"
            >
              <ChevronLeft className="size-5 shrink-0 stroke-[2.5]" />
            </button>
          )}

          {/* Brand Emblem, Name, and Pill Tag */}
          <Link
            to={dashboardTarget}
            className="flex items-center gap-2 sm:gap-2.5 hover:opacity-95 transition group min-w-0 cursor-pointer"
            title="Return to Dashboard"
          >
            <div className="relative size-9 sm:size-10 rounded-full p-0.5 ring-2 ring-[#D4AF37] bg-white dark:bg-[#0A1F44] flex items-center justify-center shadow-xs shrink-0">
              <img
                src="/qmark_icon_standalone.png"
                alt="Qmark"
                className="size-full rounded-full object-contain p-0.5"
              />
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[#10B981] ring-2 ring-white dark:ring-[#0A1F44]" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-base sm:text-lg font-extrabold text-[#0A1F44] dark:text-white tracking-tight">
                Qmark
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-[#FEF08A]/70 dark:bg-[#D4AF37]/25 text-[#854d0e] dark:text-[#D4AF37] border border-[#D4AF37]/40 shadow-2xs shrink-0">
                {tag}
              </span>
            </div>
          </Link>
        </div>

        {/* Right Side: Extra Actions, User Capsule, Notifications, Theme, Exit */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {extraActions}

          {/* Pill Capsule with Circular Gold-Ringed Avatar & First Name (Collapsed by default to show only photo/initial, fully opens on hover or click) */}
          {user && (
            <div
              ref={userPillRef}
              onClick={() => setIsExpanded((prev) => !prev)}
              onMouseEnter={() => setIsExpanded(true)}
              onMouseLeave={() => setIsExpanded(false)}
              className={`group/userpill cursor-pointer rounded-full border border-[#D4AF37]/50 dark:border-[#D4AF37]/60 bg-white/95 dark:bg-[#0A1F44]/95 p-1 flex items-center transition-all duration-300 ease-out shadow-xs select-none ${
                isExpanded ? "pr-3 sm:pr-4 gap-2" : "hover:pr-3 hover:sm:pr-4 hover:gap-2"
              }`}
              title={displayName || user.role || user.email || "Account Profile"}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsExpanded((prev) => !prev);
                }
              }}
            >
              <div className="size-7 sm:size-8 rounded-full ring-2 ring-[#D4AF37] overflow-hidden bg-[#0A1F44] text-[#D4AF37] flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs uppercase transition-transform duration-300 group-hover/userpill:scale-105">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name || "User"}
                    className="size-full object-cover"
                  />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
              <div
                className={`overflow-hidden transition-all duration-300 ease-out flex items-center ${
                  isExpanded
                    ? "max-w-[160px] opacity-100"
                    : "max-w-0 opacity-0 group-hover/userpill:max-w-[160px] group-hover/userpill:opacity-100 group-hover/userpill:ml-1"
                }`}
              >
                <span className="font-bold text-xs sm:text-sm text-[#0A1F44] dark:text-white whitespace-nowrap truncate max-w-[85px] sm:max-w-[140px]">
                  {displayName || user.role || "User"}
                </span>
              </div>
            </div>
          )}

          <ThemeToggle className="h-8 w-8" />
        </div>
      </div>
    </header>
  );
}
