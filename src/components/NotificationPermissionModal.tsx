import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Bell, BellRing, Sparkles, Clock, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  subscribeDeviceToPush,
  getPushPermissionStatus,
  isIOS,
  isStandalone,
  PushUserContext,
} from "@/lib/push-client";
import { toast } from "sonner";

interface NotificationPermissionModalProps {
  userContext: PushUserContext;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function NotificationPermissionModal({
  userContext,
  open,
  onClose,
  onSuccess,
}: NotificationPermissionModalProps) {
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isStudent = userContext.userRole === "student";

  const handleTurnOn = async () => {
    setLoading(true);
    // Mark as prompted immediately so it never interrupts the user again on this device
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`qmark_notification_prompt_shown_${userContext.userId}`, "true");
        localStorage.setItem("qmark_notification_prompt_shown_global", "true");
      } catch {
        // Ignore
      }
    }

    try {
      const res = await subscribeDeviceToPush(userContext);
      if (res.success) {
        toast.success("✓ Notifications enabled! You will now receive instant alerts.");
        onSuccess?.();
        onClose();

        // Send confirmation ping
        fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userContext.userId,
            payload: {
              type: "GENERAL",
              title: "🔔 Qmark Alerts Active",
              body: isStudent
                ? "You'll receive live roll-call sessions, course announcements & reminders."
                : "You'll receive live scan session alerts, student check-ins & reports.",
              url: isStudent ? "/student" : "/dashboard",
            },
          }),
        }).catch(() => {});
      } else if (res.error === "ios_pwa_required") {
        toast.info(
          "On iPhone/iPad, please tap Share (⎋) and select 'Add to Home Screen' to enable phone alerts.",
          { duration: 7000 },
        );
        onClose();
      } else {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          toast.success("✓ Notifications already permitted.");
          onSuccess?.();
          onClose();
        } else {
          toast.info("Notifications were not enabled. You can enable them anytime in Settings.");
          onClose();
        }
      }
    } catch {
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`qmark_notification_prompt_shown_${userContext.userId}`, "true");
        localStorage.setItem("qmark_notification_prompt_shown_global", "true");
      } catch {
        // Ignore
      }
    }
    setDismissed(true);
    onClose();
  };

  if (!open || dismissed) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleSkip}
          className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        />

        {/* Modal Container Rebranded from Square Go iOS 13 layout */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className="relative w-full max-w-sm sm:max-w-md bg-white dark:bg-[#0A1F44] rounded-[36px] sm:rounded-[42px] border border-[#D4AF37]/35 shadow-[0_25px_60px_-15px_rgba(10,31,68,0.35),0_0_0_1px_rgba(212,175,55,0.2)] p-6 sm:p-9 text-center overflow-hidden z-10 flex flex-col items-center select-none"
        >
          {/* Subtle Ambient Gold Radiance */}
          <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-[#D4AF37]/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full bg-[#0A1F44]/20 dark:bg-[#0B1D3A]/70 blur-3xl" />

          {/* Graphic Artwork matching Square Go iOS 13 phone illustration with Qmark styling */}
          <div className="relative mt-2 mb-8 flex items-center justify-center">
            {/* Soft Pastel Background Disc */}
            <div className="size-48 sm:size-52 rounded-full bg-gradient-to-b from-[#FEF9C3]/70 via-[#F3E5AB]/40 to-transparent dark:from-[#D4AF37]/15 dark:to-transparent flex items-center justify-center relative">
              {/* Phone Silhouette Container */}
              <div className="relative w-28 sm:w-32 h-44 sm:h-48 rounded-[28px] sm:rounded-[32px] bg-[#0A1F44] dark:bg-[#0B1D3A] border-[3px] border-[#D4AF37]/50 shadow-xl overflow-hidden flex flex-col items-center pt-2.5">
                {/* Dynamic Island / Speaker Notch */}
                <div className="w-10 h-3 rounded-full bg-black/70 mb-3" />

                {/* Subtle phone screen wallpaper */}
                <div className="w-full flex-1 bg-gradient-to-b from-[#112A59] to-[#0A1F44] p-2 flex flex-col items-center justify-center">
                  <QrCode className="size-10 text-[#D4AF37]/30 stroke-[1.5]" />
                </div>
              </div>

              {/* Floating iOS Notification Banner (Overlay crossing the phone like Square Go) */}
              <motion.div
                initial={{ y: 8, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="absolute w-[86%] sm:w-[92%] top-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-[#112A59] border border-[#D4AF37]/40 shadow-[0_12px_32px_rgba(0,0,0,0.18)] p-3 flex items-center gap-3 text-left"
              >
                {/* Leading Circle Icon (Clock or Bell with soft background) */}
                <div className="size-9 rounded-xl bg-[#FEF08A] dark:bg-[#D4AF37]/25 border border-[#D4AF37]/40 flex items-center justify-center text-[#854d0e] dark:text-[#D4AF37] shrink-0 shadow-2xs">
                  <Clock className="size-4 stroke-[2.5]" />
                </div>

                {/* Simulated Notification Lines & Qmark Badge */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#854d0e] dark:text-[#D4AF37]">
                      {isStudent ? "Class Session Open" : "Attendance Ready"}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-medium">now</span>
                  </div>
                  <div className="h-1.5 w-3/4 rounded-full bg-[#0A1F44]/25 dark:bg-white/30" />
                  <div className="h-1.5 w-1/2 rounded-full bg-[#0A1F44]/15 dark:bg-white/15" />
                </div>
              </motion.div>
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-[#0A1F44] dark:text-white leading-tight">
            {isStudent ? "Get class session reminders" : "Get attendance alerts"}
          </h2>

          {/* Rebranded Copy matching Square Go layout */}
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-xs sm:max-w-sm">
            {isStudent
              ? "Get reminders when roll-call begins, your attendance standing drops, or course assignments are posted."
              : "Get reminders when scheduled sessions are about to start, live roster verification updates, and audit alerts."}
          </p>

          {/* Action Buttons */}
          <div className="mt-8 w-full space-y-3">
            <Button
              type="button"
              onClick={handleTurnOn}
              disabled={loading}
              className="w-full h-13 rounded-full text-base font-bold bg-[#0A1F44] dark:bg-[#D4AF37] text-white dark:text-[#0A1F44] hover:bg-[#112A59] dark:hover:bg-[#F3E5AB] shadow-md transition-all cursor-pointer"
            >
              {loading ? "Turning on..." : "Turn on notifications"}
            </Button>

            <button
              type="button"
              onClick={handleSkip}
              className="w-full py-2 text-sm font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white transition-colors cursor-pointer"
            >
              Skip
            </button>
          </div>

          {/* Fine print note matching user prompt specification */}
          <p className="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
            You can adjust or turn off notifications anytime in App Settings or phone settings.
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
