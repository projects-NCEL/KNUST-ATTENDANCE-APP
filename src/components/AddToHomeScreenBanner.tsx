import React, { useState } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Smartphone, CheckCircle2, Share2, PlusSquare, ArrowDown, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const AddToHomeScreenBanner: React.FC = () => {
  const { isInstalled, isIOS, triggerNativeInstall, isInstallable } = usePWAInstall();
  const [showIOSTip, setShowIOSTip] = useState(false);

  const handleClick = async () => {
    if (isInstalled) {
      toast.info("Qmark is already installed and active on your home screen!");
      return;
    }

    if (isIOS) {
      setShowIOSTip((prev) => !prev);
      return;
    }

    // Directly trigger the browser's native installation prompt
    const success = await triggerNativeInstall();
    if (success) {
      toast.success("Qmark added to your device successfully!");
    } else {
      // If the browser needs user to use the search bar or menu install icon
      toast.info("Tap 'Install' in your browser's prompt or search bar to add Qmark.");
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-2">
      <div className="p-4 sm:p-5 rounded-3xl glass-card border border-[#D4AF37]/35 flex flex-col sm:flex-row items-center justify-between gap-3.5 shadow-sm transition-all relative overflow-hidden group">
        {/* Subtle Ambient Gold Radiance */}
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
                {isInstalled ? "Qmark App Installed" : "Install Qmark App"}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#AA820A] dark:text-[#D4AF37] border border-[#D4AF37]/30 shrink-0">
                1-TAP APP
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-200 mt-0.5">
              {isInstalled
                ? "Running standalone. Full-screen experience and push alerts active."
                : "Add to home screen to launch like a native app without browser bars."}
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
              onClick={handleClick}
              className="w-full sm:w-auto px-6 py-2.5 rounded-full font-bold text-xs text-center transition-all cursor-pointer shrink-0 shadow-md hover:scale-[1.02] active:scale-[0.98] bg-[#0A1F44] text-white dark:bg-[#D4AF37] dark:text-[#0A1F44] border border-[#D4AF37]/40 hover:opacity-95 flex items-center justify-center gap-2"
            >
              <Smartphone className="size-4 shrink-0 text-[#D4AF37] dark:text-[#0A1F44]" />
              <span>{isIOS ? "Add to iPhone / iPad" : "Add to Home Screen"}</span>
            </button>
          )}
        </div>
      </div>

      {/* iOS Minimal Inline Banner: Only when explicitly requested by iOS users */}
      {showIOSTip && isIOS && !isInstalled && (
        <div className="p-3 sm:p-3.5 rounded-2xl bg-[#0A1F44]/90 dark:bg-[#0D234A] text-white border border-[#D4AF37]/40 flex items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="size-7 rounded-lg bg-[#D4AF37] text-[#0A1F44] flex items-center justify-center shrink-0">
              <Share2 className="size-3.5" />
            </div>
            <p className="text-white/95 leading-snug">
              In Safari, tap <span className="text-[#D4AF37] font-bold">Share</span> below, then tap <span className="text-[#D4AF37] font-bold">"Add to Home Screen" (+)</span> to install.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowIOSTip(false)}
            className="text-white/70 hover:text-white px-2 py-1 rounded font-bold"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
