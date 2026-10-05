import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  QrCode,
  Radio,
  Home,
  BookOpen,
  Megaphone,
} from "lucide-react";

interface StudentFloatingNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  activeSessionId?: string | null;
}

export function StudentFloatingNav({
  activeTab,
  onTabChange,
  activeSessionId,
}: StudentFloatingNavProps) {
  const leftItems = [
    { id: "qr", label: "My Pass", icon: QrCode },
    {
      id: "checkin",
      label: "Check In",
      icon: Radio,
      to: activeSessionId ? `/check-in?session=${activeSessionId}` : "/check-in",
      isLive: Boolean(activeSessionId),
    },
  ];

  const rightItems = [
    { id: "courses", label: "Courses", icon: BookOpen },
    { id: "announcements", label: "Notices", icon: Megaphone },
  ];

  const isHomeActive = activeTab === "attendance";

  return (
    <motion.nav
      initial={{ y: 80, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className="fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-[96vw] pointer-events-auto select-none"
      aria-label="Student Floating Navigation"
    >
      <div className="relative flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full backdrop-blur-2xl bg-white/92 dark:bg-[#07162c]/92 border border-[#D4AF37]/30 dark:border-[#D4AF37]/25 shadow-[0_10px_30px_-6px_rgba(0,0,0,0.16)] dark:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.5)]">
        {/* Whisper-thin subtle top gold hairline */}
        <div className="pointer-events-none absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />

        {/* Left Items: Pass & Check In */}
        {leftItems.map((item) => {
          const isActive = item.to ? false : activeTab === item.id;
          const Icon = item.icon;

          if (item.to) {
            return (
              <Link key={item.id} to={item.to as string} className="relative group">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative flex flex-col items-center justify-center px-2.5 sm:px-3.5 py-1.5 rounded-full transition-all duration-200 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-[#D4AF37]/10"
                >
                  {item.isLive && (
                    <span className="absolute top-1 right-2 size-2 rounded-full bg-[#B8861B] ring-1.5 ring-white dark:ring-[#0A1F44] animate-pulse" />
                  )}
                  <Icon className="size-5 sm:size-5.5 shrink-0 stroke-[2]" />
                  <span className="text-[10px] sm:text-[11px] font-semibold leading-tight mt-0.5 tracking-tight">
                    {item.label}
                  </span>
                </motion.div>
              </Link>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className="relative group cursor-pointer"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`relative flex flex-col items-center justify-center px-2.5 sm:px-3.5 py-1.5 rounded-full transition-all duration-200 ${
                  isActive
                    ? "text-[#0A1F44] dark:text-[#E2BD56] font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-[#D4AF37]/10"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="student-nav-indicator"
                    className="absolute inset-0 rounded-full bg-[#D4AF37]/15 dark:bg-[#D4AF37]/20 border border-[#D4AF37]/35"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className={`size-5 sm:size-5.5 shrink-0 z-10 ${isActive ? "stroke-[2.2]" : "stroke-[2]"}`} />
                <span className="text-[10px] sm:text-[11px] font-semibold leading-tight mt-0.5 tracking-tight z-10">
                  {item.label}
                </span>
              </motion.div>
            </button>
          );
        })}

        {/* Center Prominent Item: Home (Attendance) */}
        <button
          type="button"
          onClick={() => onTabChange("attendance")}
          className="relative group mx-1 sm:mx-2 -my-2.5 sm:-my-3.5 cursor-pointer"
        >
          <motion.div
            whileHover={{ scale: 1.08, y: -2 }}
            whileTap={{ scale: 0.94 }}
            className="relative flex flex-col items-center justify-center cursor-pointer"
          >
            <div
              className={`relative size-11 sm:size-12 rounded-full flex flex-col items-center justify-center transition-all duration-200 shadow-[0_4px_16px_rgba(0,0,0,0.18)] ${
                isHomeActive
                  ? "bg-[#0A1F44] text-[#E2BD56] border border-[#D4AF37]/50 ring-2 ring-[#D4AF37]/20"
                  : "bg-white dark:bg-[#0E2448] text-foreground hover:text-[#D4AF37] border border-[#D4AF37]/35"
              }`}
            >
              <Home className={`size-5 sm:size-5.5 shrink-0 ${isHomeActive ? "stroke-[2.4]" : "stroke-[2]"}`} />
              <span className="text-[9px] font-black leading-none mt-0.5 tracking-wider uppercase">
                Home
              </span>
            </div>
          </motion.div>
        </button>

        {/* Right Items: Courses & Notices */}
        {rightItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className="relative group cursor-pointer"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`relative flex flex-col items-center justify-center px-2.5 sm:px-3.5 py-1.5 rounded-full transition-all duration-200 ${
                  isActive
                    ? "text-[#0A1F44] dark:text-[#E2BD56] font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-[#D4AF37]/10"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="student-nav-indicator"
                    className="absolute inset-0 rounded-full bg-[#D4AF37]/15 dark:bg-[#D4AF37]/20 border border-[#D4AF37]/35"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className={`size-5 sm:size-5.5 shrink-0 z-10 ${isActive ? "stroke-[2.2]" : "stroke-[2]"}`} />
                <span className="text-[10px] sm:text-[11px] font-semibold leading-tight mt-0.5 tracking-tight z-10">
                  {item.label}
                </span>
              </motion.div>
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}
