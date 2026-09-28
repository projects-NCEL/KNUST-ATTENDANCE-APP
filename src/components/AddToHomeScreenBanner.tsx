import React, { useState } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Download, Share2, PlusSquare, CheckCircle2, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const AddToHomeScreenBanner: React.FC = () => {
  const { isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showAndroidGuideModal, setShowAndroidGuideModal] = useState(false);

  const handleInstallClick = async () => {
    if (isInstalled) {
      toast.info("Qmark is already installed on your home screen!");
      return;
    }

    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    const result = await install();
    if (result === "accepted") {
      toast.success("Qmark has been added to your home screen!");
    } else if (result === "ios") {
      setShowIOSModal(true);
    } else if (result === "manual") {
      setShowAndroidGuideModal(true);
    }
  };

  return (
    <>
      <div className="mt-6 p-4 sm:p-5 rounded-3xl glass-card border border-[#D4AF37]/35 flex flex-col sm:flex-row items-center justify-between gap-3.5 shadow-sm transition-all relative overflow-hidden group">
        {/* Subtle Ambient Gold Radial Glow */}
        <div className="pointer-events-none absolute -right-10 -bottom-10 size-40 rounded-full bg-[#D4AF37]/15 blur-2xl group-hover:bg-[#D4AF37]/25 transition-all" />

        <div className="flex items-center gap-3.5 relative z-10 w-full sm:w-auto">
          {/* App Icon with Gold Ring */}
          <div className="relative size-12 sm:size-13 rounded-2xl ring-2 ring-[#D4AF37]/50 bg-[#0A1F44] p-1 flex items-center justify-center shrink-0 shadow-sm">
            <img
              src="/qmark_icon_standalone.png"
              alt="Qmark App"
              className="size-full rounded-xl object-contain"
            />
            <span className="absolute -top-1 -right-1 size-3 rounded-full bg-[#10B981] ring-2 ring-white dark:ring-[#0B1D3A]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-[#0A1F44] dark:text-white truncate">
                {isInstalled ? "Qmark App Installed" : "Add Qmark to Home Screen"}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#AA820A] dark:text-[#D4AF37] border border-[#D4AF37]/30 shrink-0">
                PWA
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-200 mt-0.5 line-clamp-1 sm:line-clamp-none">
              {isInstalled
                ? "Running as standalone app. Offline passes and push notifications enabled."
                : "Instant 1-tap launch, full screen experience, and zero browser address bar."}
            </p>
          </div>
        </div>

        <div className="relative z-10 w-full sm:w-auto shrink-0 flex items-center gap-2">
          {isInstalled ? (
            <div className="w-full sm:w-auto px-5 py-2.5 rounded-full font-bold text-xs text-center flex items-center justify-center gap-1.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>Installed on Device</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full sm:w-auto px-5 sm:px-6 py-2.5 rounded-full font-bold text-xs text-center transition-all cursor-pointer shrink-0 shadow-md hover:scale-[1.02] active:scale-[0.98] bg-[#0A1F44] text-white dark:bg-[#D4AF37] dark:text-[#0A1F44] border border-[#D4AF37]/40 hover:opacity-95 flex items-center justify-center gap-2"
            >
              <Smartphone className="size-4 shrink-0" />
              <span>{isIOS ? "Add to iPhone / iPad" : "Add to Home Screen"}</span>
            </button>
          )}
        </div>
      </div>

      {/* iOS Installation Instructions Modal */}
      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white dark:bg-[#0B1D3A] border-2 border-[#D4AF37]/40 shadow-2xl text-[#0A1F44] dark:text-white">
          <DialogHeader>
            <div className="mx-auto size-14 rounded-2xl ring-2 ring-[#D4AF37] bg-[#0A1F44] p-1 flex items-center justify-center mb-2 shadow-sm">
              <img
                src="/qmark_icon_standalone.png"
                alt="Qmark"
                className="size-full rounded-xl object-contain"
              />
            </div>
            <DialogTitle className="text-center text-lg sm:text-xl font-extrabold text-[#0A1F44] dark:text-white">
              Add Qmark to your iOS Home Screen
            </DialogTitle>
            <DialogDescription className="text-center text-xs sm:text-sm text-slate-600 dark:text-slate-200">
              Install Qmark on your iPhone or iPad for 1-tap access and full-screen experience.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 my-3 pt-2 border-t border-[#D4AF37]/25 text-xs sm:text-sm">
            {/* Step 1 */}
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#0A1F44]/5 dark:bg-white/5 border border-[#D4AF37]/25">
              <div className="size-8 rounded-xl bg-[#0A1F44] dark:bg-[#D4AF37] text-white dark:text-[#0A1F44] font-bold flex items-center justify-center shrink-0">
                1
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                  Tap the Safari <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#D4AF37]/20 text-[#0A1F44] dark:text-[#D4AF37] font-bold"><Share2 className="size-3.5" /> Share</span> icon
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                  Located in the bottom navigation bar of Safari (or top bar on iPad).
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#0A1F44]/5 dark:bg-white/5 border border-[#D4AF37]/25">
              <div className="size-8 rounded-xl bg-[#0A1F44] dark:bg-[#D4AF37] text-white dark:text-[#0A1F44] font-bold flex items-center justify-center shrink-0">
                2
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                  Scroll down and tap <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#D4AF37]/20 text-[#0A1F44] dark:text-[#D4AF37] font-bold"><PlusSquare className="size-3.5" /> Add to Home Screen</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                  Select "Add to Home Screen" from the action sheet.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#0A1F44]/5 dark:bg-white/5 border border-[#D4AF37]/25">
              <div className="size-8 rounded-xl bg-[#0A1F44] dark:bg-[#D4AF37] text-white dark:text-[#0A1F44] font-bold flex items-center justify-center shrink-0">
                3
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  Tap <span className="font-bold text-[#D4AF37]">"Add"</span> in the top-right corner
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                  The standalone Qmark app will appear on your device home screen immediately.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowIOSModal(false)}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider cursor-pointer hover:opacity-90 transition"
          >
            Got It
          </button>
        </DialogContent>
      </Dialog>

      {/* Android / Desktop Manual Guide Modal (Fallback if prompt blocked) */}
      <Dialog open={showAndroidGuideModal} onOpenChange={setShowAndroidGuideModal}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white dark:bg-[#0B1D3A] border-2 border-[#D4AF37]/40 shadow-2xl text-[#0A1F44] dark:text-white">
          <DialogHeader>
            <div className="mx-auto size-14 rounded-2xl ring-2 ring-[#D4AF37] bg-[#0A1F44] p-1 flex items-center justify-center mb-2 shadow-sm">
              <img
                src="/qmark_icon_standalone.png"
                alt="Qmark"
                className="size-full rounded-xl object-contain"
              />
            </div>
            <DialogTitle className="text-center text-lg sm:text-xl font-extrabold text-[#0A1F44] dark:text-white">
              Install Qmark on Your Device
            </DialogTitle>
            <DialogDescription className="text-center text-xs sm:text-sm text-slate-600 dark:text-slate-200">
              Open your browser menu (⋮) and tap <b>"Install app"</b> or <b>"Add to Home screen"</b>.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 rounded-2xl bg-[#0A1F44]/5 dark:bg-white/5 border border-[#D4AF37]/25 text-xs sm:text-sm space-y-2">
            <p className="font-semibold text-foreground">
              In Google Chrome or Samsung Internet:
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              1. Tap the three dots (<b>⋮</b>) menu in the top or bottom right corner.
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              2. Tap <b>"Install app"</b> or <b>"Add to Home screen"</b>.
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              3. Confirm install to access Qmark like a native app anytime.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAndroidGuideModal(false)}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider cursor-pointer hover:opacity-90 transition mt-2"
          >
            Understood
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
};
