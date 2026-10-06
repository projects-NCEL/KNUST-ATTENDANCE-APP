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
      <div className="relative flex items-center gap-1.5 sm:gap-2.5 px-3.5 sm:px-6 py-2.5 sm:py-3 rounded-full backdrop-blur-3xl bg-white/95 dark:bg-[#07162c]/95 border-[2.5px] border-[#D4AF37]/50 dark:border-[#D4AF37]/45 shadow-[0_16px_44px_-6px_rgba(0,0,0,0.32)] dark:shadow-[0_20px_48px_-6px_rgba(0,0,0,0.75)]">
        {/* Top gold hairline */}
        <div className="pointer-events-none absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37]/80 to-transparent" />

        {/* Animated Curved Notch Scoop (Curved In) Cradling the Projecting Home Button */}
        <div className="pointer-events-none absolute -top-[16px] left-1/2 -translate-x-1/2 w-28 sm:w-32 h-5 overflow-visible flex items-center justify-center">
          <svg
            className="w-28 sm:w-32 h-5 overflow-visible"
            viewBox="0 0 120 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="goldBeamStudent" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#FFF2B2" stopOpacity="1" />
                <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            {/* Curved-in concave scoop fill seamlessly matching navbar glass */}
            <path
              d="M 0,0 C 26,0 34,18 60,18 C 86,18 94,0 120,0"
              className="fill-transparent stroke-[#D4AF37]/60 dark:stroke-[#D4AF37]/55 stroke-[2.5]"
              strokeLinecap="round"
            />
            {/* Glowing animated accent beam continuously running across the curved notch */}
            <motion.path
              d="M 0,0 C 26,0 34,18 60,18 C 86,18 94,0 120,0"
              fill="none"
              stroke="url(#goldBeamStudent)"
              strokeWidth="3.5"
              strokeLinecap="round"
              initial={{ pathLength: 0.35, pathOffset: 0 }}
              animate={{ pathOffset: [0, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
              className="drop-shadow-[0_0_8px_rgba(212,175,55,0.85)]"
            />
          </svg>
        </div>

        {/* Left Items: Pass & Check In */}
        {leftItems.map((item) => {
          const isActive = item.to ? false : activeTab === item.id;
          const Icon = item.icon;

          if (item.to) {
            return (
              <Link key={item.id} to={item.to as string} className="relative group">
                <motion.div
                  whileHover={{ scale: 1.07 }}
                  whileTap={{ scale: 0.93 }}
                  className="relative flex flex-col items-center justify-center px-3.5 sm:px-4.5 py-1.5 sm:py-2 rounded-full transition-all duration-200 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-[#D4AF37]/15 min-w-[56px] sm:min-w-[70px]"
                >
                  {item.isLive && (
                    <span className="absolute top-1 right-2 size-2.5 rounded-full bg-[#B8861B] ring-2 ring-white dark:ring-[#0A1F44] animate-pulse" />
                  )}
                  <Icon className="size-6 sm:size-6.5 shrink-0 stroke-[3.2]" />
                  <span className="text-[12px] sm:text-[13px] font-black leading-tight mt-0.5 tracking-tight uppercase">
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
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.93 }}
                className={`relative flex flex-col items-center justify-center px-3.5 sm:px-4.5 py-1.5 sm:py-2 rounded-full transition-all duration-200 min-w-[56px] sm:min-w-[70px] ${
                  isActive
                    ? "text-[#0A1F44] dark:text-[#E2BD56] font-black"
                    : "text-muted-foreground hover:text-foreground hover:bg-[#D4AF37]/15 font-bold"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="student-nav-indicator"
                    className="absolute inset-0 rounded-full bg-[#D4AF37]/25 dark:bg-[#D4AF37]/30 border-[2px] border-[#D4AF37]/65 shadow-xs"
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  />
                )}
                <Icon className={`size-6 sm:size-6.5 shrink-0 z-10 ${isActive ? "stroke-[3.2]" : "stroke-[2.9]"}`} />
                <span className="text-[12px] sm:text-[13px] font-black leading-tight mt-0.5 tracking-tight z-10 uppercase">
                  {item.label}
                </span>
              </motion.div>
            </button>
          );
        })}

        {/* Center Prominent Item: Home (Attendance) Projecting Out on Curved Notch */}
        <button
          type="button"
          onClick={() => onTabChange("attendance")}
          className="relative group mx-2 sm:mx-3 cursor-pointer"
        >
          <motion.div
            whileHover={{ scale: 1.1, y: -28 }}
            whileTap={{ scale: 0.92, y: -20 }}
            animate={{ y: -22 }}
            transition={{ type: "spring", stiffness: 450, damping: 22 }}
            className="relative flex flex-col items-center justify-center cursor-pointer"
          >
            {/* Pulsing ambient gold aura */}
            <span className="absolute -inset-1.5 rounded-full bg-[#D4AF37]/35 blur-md animate-pulse" />

            <div
              className={`size-15 sm:size-16 rounded-full flex flex-col items-center justify-center transition-all duration-300 relative border-[3px] ${
                isHomeActive
                  ? "bg-[#0A1F44] text-[#E2BD56] border-[#D4AF37] ring-4 ring-[#D4AF37]/45 shadow-[0_12px_28px_rgba(212,175,55,0.55)]"
                  : "bg-[#0A1F44] text-[#F3DB8B] border-[#D4AF37]/85 ring-2 ring-[#D4AF37]/30 shadow-[0_10px_24px_rgba(0,0,0,0.4)] hover:border-[#D4AF37]"
              }`}
            >
              <Home className="size-6.5 sm:size-7 stroke-[3.2] drop-shadow-sm" />
              <span className="text-[10px] sm:text-[11px] font-black leading-none mt-0.5 tracking-wider uppercase text-[#E2BD56]">
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
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.93 }}
                className={`relative flex flex-col items-center justify-center px-3.5 sm:px-4.5 py-1.5 sm:py-2 rounded-full transition-all duration-200 min-w-[56px] sm:min-w-[70px] ${
                  isActive
                    ? "text-[#0A1F44] dark:text-[#E2BD56] font-black"
                    : "text-muted-foreground hover:text-foreground hover:bg-[#D4AF37]/15 font-bold"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="student-nav-indicator-right"
                    className="absolute inset-0 rounded-full bg-[#D4AF37]/25 dark:bg-[#D4AF37]/30 border-[2px] border-[#D4AF37]/65 shadow-xs"
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  />
                )}
                <Icon className={`size-6 sm:size-6.5 shrink-0 z-10 ${isActive ? "stroke-[3.2]" : "stroke-[2.9]"}`} />
                <span className="text-[12px] sm:text-[13px] font-black leading-tight mt-0.5 tracking-tight z-10 uppercase">
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
