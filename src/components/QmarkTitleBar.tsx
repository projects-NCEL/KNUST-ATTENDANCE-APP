import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, User, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InAppNotificationCenter } from "@/components/PushNotificationManager";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

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
}

export function QmarkTitleBar({
  onBack,
  backTo,
  tag = "GH",
  user,
  notificationUserId,
  onSignOut,
  extraActions,
  showBack = true,
}: QmarkTitleBarProps) {
  const navigate = useNavigate();

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

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-[#0A1F44]/95 backdrop-blur-md rounded-b-[28px] sm:rounded-b-[36px] border-b-2 border-[#D4AF37]/40 shadow-[0_4px_24px_-4px_rgba(10,31,68,0.08),0_1px_2px_rgba(212,175,55,0.12)] transition-all">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2.5 sm:gap-3 min-w-0">
        {/* Left Side: Circular Back Button & Emblem + App Name + Tag */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
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
            to="/"
            className="flex items-center gap-2 sm:gap-2.5 hover:opacity-95 transition group min-w-0"
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

          {/* Pill Capsule with Circular Gold-Ringed Avatar & First Name (Matching the design) */}
          {user && (
            <div className="rounded-full border border-[#D4AF37]/50 dark:border-[#D4AF37]/60 bg-white/90 dark:bg-[#0A1F44] pl-1 pr-3 sm:pr-4 py-1 flex items-center gap-2 shadow-xs">
              <div className="size-7 sm:size-8 rounded-full ring-2 ring-[#D4AF37] overflow-hidden bg-[#0A1F44] text-[#D4AF37] flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs uppercase">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name || "User"}
                    className="size-full object-cover"
                  />
                ) : displayName ? (
                  <span>{displayName.charAt(0).toUpperCase()}</span>
                ) : (
                  <User className="size-4" />
                )}
              </div>
              <span className="font-bold text-xs sm:text-sm text-[#0A1F44] dark:text-white truncate max-w-[85px] sm:max-w-[130px]">
                {displayName || user.role || "User"}
              </span>
            </div>
          )}

          {/* In-App Notification Center (closes on outside click) */}
          {notificationUserId && <InAppNotificationCenter userId={notificationUserId} />}

          <ThemeToggle className="h-8 w-8" />

          {onSignOut && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSignOut}
              aria-label="Sign out"
              className="text-xs h-8 px-2.5 sm:px-3 font-semibold rounded-full border-border/80 hover:bg-muted cursor-pointer"
            >
              <LogOut className="size-3.5 sm:mr-1 text-[#D4AF37]" />
              <span className="hidden sm:inline">Exit</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
