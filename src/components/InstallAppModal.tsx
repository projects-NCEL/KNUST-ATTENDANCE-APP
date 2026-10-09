import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall, getOpenInChromeUrl } from "@/hooks/usePWAInstall";
import { toast } from "sonner";

interface InstallAppModalProps {
  open: boolean;
  onClose: () => void;
}

// New key names, so "Not now" taps saved by the old version no longer hide the pop-up
export const INSTALL_DISMISS_KEY = "qmark_install_popup_closed_this_visit_v2";
export const INSTALL_DONE_KEY = "qmark_install_accepted_v2";

/**
 * True when the install pop-up should not open by itself:
 * the app was installed from this browser, or it was already closed during this visit
 * (it opens again on the next visit / next app launch).
 */
export function isInstallPopupSnoozed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (localStorage.getItem(INSTALL_DONE_KEY) === "true") return true;
    return sessionStorage.getItem(INSTALL_DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

export function InstallAppModal({ open, onClose }: InstallAppModalProps) {
  const { isInstalled, browserInfo, triggerNativeInstall, isInstallable } = usePWAInstall();
  const [installing, setInstalling] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);

  // On Android, only Chrome builds an app that Google Play Protect trusts
  const mustOpenInChrome = browserInfo.mustOpenInChrome;

  const markDone = () => {
    try {
      localStorage.setItem(INSTALL_DONE_KEY, "true");
    } catch {
      // ignore
    }
  };

  const handleSkip = () => {
    try {
      // Hide it for the rest of this visit only; it opens again next time
      sessionStorage.setItem(INSTALL_DISMISS_KEY, "true");
    } catch {
      // ignore
    }
    onClose();
  };

  const handleInstall = async () => {
    if (isInstalled) {
      toast.info("Qmark is already installed on this device.");
      markDone();
      onClose();
      return;
    }

    if (mustOpenInChrome) {
      // Re-open this page in Chrome, where installing is safe and needs no "Install anyway"
      window.location.href = getOpenInChromeUrl();
      return;
    }

    setInstalling(true);
    try {
      const result = await triggerNativeInstall();
      if (result.status === "accepted") {
        toast.success("Qmark added to your home screen.");
        markDone();
        onClose();
      } else if (result.status === "dismissed") {
        handleSkip();
      } else {
        // iPhone Safari and some desktop browsers have no install button: show the steps
        setShowManualGuide(true);
      }
    } catch {
      setShowManualGuide(true);
    } finally {
      setInstalling(false);
    }
  };

  if (!open) return null;

  const heading = mustOpenInChrome ? "Install Qmark with Chrome" : "Install the Qmark app";
  const body = mustOpenInChrome
    ? `To install safely on Android, open Qmark in Google Chrome. Installing from ${
        browserInfo.isInAppBrowser ? "this in-app browser" : browserInfo.browser
      } triggers a Play Protect warning.`
    : "Open Qmark straight from your home screen: your QR pass, roll calls and class alerts in one tap.";
  const buttonLabel = installing
    ? "Installing..."
    : mustOpenInChrome
      ? "Open in Chrome"
      : isInstallable
        ? "Install app"
        : "Show me how";

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

        {/* Card: same look as the notification pop-up */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-modal-title"
          className="relative w-full max-w-sm sm:max-w-md bg-white dark:bg-[#0A1F44] rounded-[36px] sm:rounded-[42px] border border-[#D4AF37]/35 shadow-[0_25px_60px_-15px_rgba(10,31,68,0.35),0_0_0_1px_rgba(212,175,55,0.2)] p-6 sm:p-9 text-center overflow-hidden z-10 flex flex-col items-center select-none"
        >
          <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-[#D4AF37]/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full bg-[#0A1F44]/20 dark:bg-[#0B1D3A]/70 blur-3xl" />

          {/* Illustration: the Qmark icon landing on a phone home screen */}
          <div className="relative mt-2 mb-8 flex items-center justify-center">
            <div className="size-48 sm:size-52 rounded-full bg-gradient-to-b from-[#FEF9C3]/70 via-[#F3E5AB]/40 to-transparent dark:from-[#D4AF37]/15 dark:to-transparent flex items-center justify-center relative">
              <div className="relative w-28 sm:w-32 h-44 sm:h-48 rounded-[28px] sm:rounded-[32px] bg-[#0A1F44] dark:bg-[#0B1D3A] border-[3px] border-[#D4AF37]/50 shadow-xl overflow-hidden flex flex-col items-center pt-2.5">
                <div className="w-10 h-3 rounded-full bg-black/70 mb-3" />
                <div className="w-full flex-1 bg-gradient-to-b from-[#112A59] to-[#0A1F44] p-3 grid grid-cols-3 gap-2 content-start">
                  {Array.from({ length: 9 }).map((_, i) =>
                    i === 4 ? (
                      <motion.div
                        key={i}
                        initial={{ scale: 0.4, opacity: 0, y: -18 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        transition={{ delay: 0.25, type: "spring", stiffness: 260, damping: 16 }}
                        className="aspect-square rounded-lg bg-white border border-[#D4AF37] shadow-md flex items-center justify-center overflow-hidden"
                      >
                        <img
                          src="/qmark_icon_standalone.png"
                          alt=""
                          className="size-full object-contain"
                        />
                      </motion.div>
                    ) : (
                      <div key={i} className="aspect-square rounded-lg bg-white/10" />
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>

          <h2
            id="install-modal-title"
            className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-[#0A1F44] dark:text-white leading-tight"
          >
            {heading}
          </h2>

          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-xs sm:max-w-sm">
            {body}
          </p>

          {/* Steps for browsers without an install button */}
          {showManualGuide && (
            <div className="mt-5 w-full rounded-2xl bg-neutral-100 dark:bg-white/10 border border-[#D4AF37]/25 p-4 text-left text-xs space-y-1.5 text-neutral-700 dark:text-neutral-200">
              <p className="font-bold text-[#0A1F44] dark:text-white flex items-center gap-1.5">
                <Smartphone className="size-4 text-[#B8861B]" />
                Add Qmark to your home screen
              </p>
              {browserInfo.isIOS ? (
                <>
                  <p>1. In Safari, tap the Share button at the bottom.</p>
                  <p>2. Tap "Add to Home Screen".</p>
                  <p>3. Tap "Add".</p>
                </>
              ) : (
                <>
                  <p>1. Open your browser menu (⋮ or ☰).</p>
                  <p>2. Tap "Install app" or "Add to Home screen".</p>
                  <p>3. Confirm with "Install".</p>
                </>
              )}
            </div>
          )}

          <div className="mt-8 w-full space-y-3">
            <Button
              type="button"
              onClick={handleInstall}
              disabled={installing}
              className="w-full h-13 rounded-full text-base font-bold bg-[#0A1F44] dark:bg-[#D4AF37] text-white dark:text-[#0A1F44] hover:bg-[#112A59] dark:hover:bg-[#F3E5AB] shadow-md transition-all cursor-pointer"
            >
              <Download className="size-4 mr-2" />
              {buttonLabel}
            </Button>

            <button
              type="button"
              onClick={handleSkip}
              className="w-full py-2 text-sm font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white transition-colors cursor-pointer"
            >
              Not now
            </button>
          </div>

          <p className="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
            Free, no app store needed. You can remove it anytime like any other app.
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
