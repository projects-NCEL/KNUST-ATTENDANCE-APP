import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Download,
  CheckCircle2,
  Share2,
  PlusSquare,
  Smartphone,
  ShieldAlert,
  ExternalLink,
  Copy,
  X,
  Zap,
  Bell,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { toast } from "sonner";

interface InstallAppModalProps {
  open: boolean;
  onClose: () => void;
}

export function InstallAppModal({ open, onClose }: InstallAppModalProps) {
  const { isInstalled, browserInfo, triggerNativeInstall, isInstallable } = usePWAInstall();
  const [installing, setInstalling] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleInstallClick = async () => {
    if (isInstalled) {
      toast.info("Qmark is already installed and active on this device!");
      onClose();
      return;
    }

    setInstalling(true);
    try {
      const result = await triggerNativeInstall();
      if (result.status === "accepted") {
        toast.success("✓ Qmark added to your home screen!");
        if (typeof window !== "undefined") {
          localStorage.setItem("qmark_install_prompt_completed", "true");
        }
        onClose();
      } else if (result.status === "dismissed") {
        toast.info("Installation dismissed. You can install Qmark anytime.");
        onClose();
      } else {
        // Browser requires guided steps (e.g. Safari iOS or Samsung Internet menu)
        setShowManualGuide(true);
      }
    } catch {
      setShowManualGuide(true);
    } finally {
      setInstalling(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Link copied! Open in Google Chrome to install with 1 tap.");
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          "qmark_install_modal_dismissed_until",
          String(Date.now() + 7 * 24 * 60 * 60 * 1000), // Squelch automatic popup for 7 days
        );
      } catch {
        // ignore
      }
    }
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 select-none">
        {/* Dark Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleDismiss}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: "spring", stiffness: 360, damping: 26 }}
          className="relative w-full max-w-md rounded-3xl bg-card border-2 border-[#D4AF37]/60 shadow-[0_24px_60px_-10px_rgba(0,0,0,0.6)] overflow-hidden z-10 flex flex-col max-h-[92vh]"
        >
          {/* Top Gold Accent Hairline */}
          <div className="absolute inset-x-8 top-0 h-[2.5px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

          {/* Close X Button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-3.5 right-3.5 size-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer z-20"
            aria-label="Close modal"
          >
            <X className="size-4" />
          </button>

          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
            {/* Header with App Emblem */}
            <div className="flex flex-col items-center text-center space-y-2 pt-1">
              <div className="relative">
                <div className="absolute -inset-2 rounded-2xl bg-[#D4AF37]/30 blur-md animate-pulse" />
                <div className="relative size-16 rounded-2xl bg-[#0A1F44] border-2 border-[#D4AF37] flex items-center justify-center text-[#E2BD56] shadow-xl overflow-hidden">
                  <img
                    src="/qmark_icon_standalone.png"
                    alt="Qmark"
                    className="size-12 object-contain rounded-xl"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                    }}
                  />
                  <Download className="size-8 stroke-[2.5] text-[#E2BD56]" />
                </div>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center justify-center gap-1.5">
                  <span>Install Qmark App</span>
                  <Sparkles className="size-4 text-[#D4AF37]" />
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
                  Add Qmark to your home screen for rapid 1-tap roll calls, offline student pass, and instant lecture alerts.
                </p>
              </div>
            </div>

            {/* Feature Perks */}
            <div className="grid grid-cols-3 gap-2 py-1">
              <div className="p-2.5 rounded-2xl bg-muted/50 border border-border text-center flex flex-col items-center justify-center">
                <Zap className="size-4 text-[#B8861B] dark:text-[#E2BD56] mb-1" />
                <span className="text-[11px] font-bold text-foreground leading-tight">Instant Launch</span>
                <span className="text-[9.5px] text-muted-foreground mt-0.5">No typing URLs</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-muted/50 border border-border text-center flex flex-col items-center justify-center">
                <Smartphone className="size-4 text-[#B8861B] dark:text-[#E2BD56] mb-1" />
                <span className="text-[11px] font-bold text-foreground leading-tight">Full Screen</span>
                <span className="text-[9.5px] text-muted-foreground mt-0.5">App experience</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-muted/50 border border-border text-center flex flex-col items-center justify-center">
                <Bell className="size-4 text-[#B8861B] dark:text-[#E2BD56] mb-1" />
                <span className="text-[11px] font-bold text-foreground leading-tight">Push Alerts</span>
                <span className="text-[9.5px] text-muted-foreground mt-0.5">Roll call notices</span>
              </div>
            </div>

            {/* CRITICAL: Google Play Protect & Samsung Internet Clarification Banner */}
            {browserInfo.isAndroid && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/35 text-amber-950 dark:text-amber-200 text-xs space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold text-[12px] leading-tight text-amber-800 dark:text-amber-300">
                      Google Play Protect Notice on Android
                    </p>
                    <p className="text-[11px] text-muted-foreground dark:text-amber-200/90 mt-1 leading-normal">
                      If Android displays <span className="font-bold text-foreground">"Unsafe app blocked"</span>, tap{" "}
                      <span className="font-black underline text-amber-700 dark:text-amber-300">"Install anyway"</span> (located right above the blue OK button).{" "}
                      <span className="font-semibold text-destructive">Do NOT tap "OK"</span> as that cancels the installation.
                    </p>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between gap-2 border-t border-amber-500/20">
                  <span className="text-[10.5px] text-muted-foreground">
                    💡 Tip: Google Chrome installs in 1 tap without warnings.
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyLink}
                    className="h-7 text-[10.5px] font-bold text-primary hover:text-primary/80 gap-1 p-0 px-2 cursor-pointer"
                  >
                    <Copy className="size-3" />
                    <span>{copied ? "Copied!" : "Copy Link"}</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Step-by-Step Manual Guide (if needed or requested) */}
            {showManualGuide && (
              <div className="p-3.5 rounded-2xl bg-muted/60 border border-border text-xs space-y-2">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <Smartphone className="size-4 text-primary" />
                  <span>
                    How to Add to Home Screen in {browserInfo.browser}:
                  </span>
                </p>
                <div className="space-y-1.5 pl-1">
                  {browserInfo.isIOS ? (
                    <>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-primary">1.</span>
                        <span>Tap the <strong>Share</strong> button (⎋) in Safari's bottom toolbar.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-primary">2.</span>
                        <span>Scroll down and select <strong>"Add to Home Screen"</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-primary">3.</span>
                        <span>Tap <strong>"Add"</strong> at top right to place Qmark on your screen.</span>
                      </div>
                    </>
                  ) : browserInfo.browser === "Samsung Internet" ? (
                    <>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-primary">1.</span>
                        <span>Tap the <strong>Menu (☰)</strong> button at the bottom-right corner.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-primary">2.</span>
                        <span>Select <strong>"Add page to"</strong> $\rightarrow$ <strong>"Home screen"</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-primary">3.</span>
                        <span>Confirm and tap <strong>"Install anyway"</strong> if Play Protect prompts.</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-primary">1.</span>
                        <span>Tap the <strong>three dots (⋮)</strong> menu at the top-right corner.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-primary">2.</span>
                        <span>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-primary">3.</span>
                        <span>Tap <strong>"Install"</strong> to confirm.</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <Button
                onClick={handleInstallClick}
                disabled={installing}
                className="w-full h-11 text-xs sm:text-sm font-extrabold cursor-pointer bg-[#0A1F44] text-white hover:bg-[#0A1F44]/90 dark:bg-white dark:text-[#0A1F44] border-2 border-[#D4AF37]/60 shadow-lg"
              >
                <Download className="size-4 mr-2" />
                {installing
                  ? "Adding to Home Screen..."
                  : isInstallable
                    ? "Install Qmark App"
                    : "Add to Home Screen"}
              </Button>

              <Button
                variant="ghost"
                onClick={handleDismiss}
                className="w-full h-9 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Maybe Later
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
