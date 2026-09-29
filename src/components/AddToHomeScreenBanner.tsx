import React, { useState } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import {
  Smartphone,
  CheckCircle2,
  Share2,
  PlusSquare,
  ArrowRight,
  MoreVertical,
  Laptop,
  Compass,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const AddToHomeScreenBanner: React.FC = () => {
  const { isInstalled, browserInfo, triggerNativeInstall, isInstallable } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  const handleInstallClick = async () => {
    if (isInstalled) {
      toast.info("Qmark is already installed and running on your device!");
      return;
    }

    // Try interacting directly with the browser's native installation prompt
    const result = await triggerNativeInstall();

    if (result.status === "accepted") {
      toast.success("Qmark added to your device home screen!");
      setShowGuideModal(false);
    } else if (result.status === "dismissed") {
      toast.info("Installation dismissed. You can add Qmark anytime.");
    } else {
      // Browser requires manual home screen action (iOS Safari, or browser menu)
      setShowGuideModal(true);
    }
  };

  const getBrowserGuideSteps = () => {
    if (browserInfo.isIOS) {
      return [
        {
          step: "1",
          icon: <Share2 className="size-4 text-[#B8861B]" />,
          text: "Tap the Share button in Safari toolbar (bottom on iPhone, top on iPad).",
        },
        {
          step: "2",
          icon: <PlusSquare className="size-4 text-[#B8861B]" />,
          text: "Scroll the menu down and select 'Add to Home Screen'.",
        },
        {
          step: "3",
          icon: <CheckCircle2 className="size-4 text-[#B8861B]" />,
          text: "Tap 'Add' at the top-right corner to place Qmark on your home screen.",
        },
      ];
    }

    if (browserInfo.browser === "Samsung Internet") {
      return [
        {
          step: "1",
          icon: <MoreVertical className="size-4 text-[#B8861B]" />,
          text: "Tap the Menu button (☰) in the bottom-right corner of Samsung Internet.",
        },
        {
          step: "2",
          icon: <PlusSquare className="size-4 text-[#B8861B]" />,
          text: "Select 'Add page to' and choose 'Home screen'.",
        },
        {
          step: "3",
          icon: <CheckCircle2 className="size-4 text-[#B8861B]" />,
          text: "Confirm by tapping 'Add' to install.",
        },
      ];
    }

    if (browserInfo.isAndroid) {
      return [
        {
          step: "1",
          icon: <MoreVertical className="size-4 text-[#B8861B]" />,
          text: "Tap the three dots menu (⋮) in the top-right corner of your browser.",
        },
        {
          step: "2",
          icon: <Smartphone className="size-4 text-[#B8861B]" />,
          text: "Select 'Install app' or 'Add to Home screen'.",
        },
        {
          step: "3",
          icon: <CheckCircle2 className="size-4 text-[#B8861B]" />,
          text: "Tap 'Install' on the confirmation prompt.",
        },
      ];
    }

    // Desktop Chrome / Edge / Safari / Firefox
    return [
      {
        step: "1",
        icon: <Laptop className="size-4 text-[#B8861B]" />,
        text: "Look at the right side of your browser address bar (URL bar).",
      },
      {
        step: "2",
        icon: <PlusSquare className="size-4 text-[#B8861B]" />,
        text: "Click the Install Qmark icon (⊕ or computer icon) in the address bar.",
      },
      {
        step: "3",
        icon: <CheckCircle2 className="size-4 text-[#B8861B]" />,
        text: "Click 'Install' to launch Qmark as a standalone desktop app.",
      },
    ];
  };

  return (
    <>
      <div className="mt-5 w-full">
        <div className="p-3.5 sm:p-4 rounded-2xl glass-card border border-[#B8861B]/30 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs transition-all relative overflow-hidden group">
          {/* Subtle Corner Glow */}
          <div className="pointer-events-none absolute -right-8 -bottom-8 size-32 rounded-full bg-[#B8861B]/10 blur-xl group-hover:bg-[#B8861B]/15 transition-all" />

          {/* Left info */}
          <div className="flex items-center gap-3 relative z-10 w-full sm:w-auto">
            <div className="relative size-10 rounded-xl ring-1.5 ring-[#B8861B]/50 bg-[#0A1F44] p-1 flex items-center justify-center shrink-0 shadow-xs">
              <img
                src="/qmark_icon_standalone.png"
                alt="Qmark"
                className="size-full rounded-lg object-contain"
              />
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[#10B981] ring-1.5 ring-white dark:ring-[#0B1D3A]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-[#0A1F44] dark:text-white">
                  {isInstalled ? "Qmark App Active" : "Add to Home Screen"}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#B8861B]/15 text-[#B8861B] dark:text-[#E2BD56] border border-[#B8861B]/30 shrink-0">
                  {browserInfo.browser} • {browserInfo.os}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate max-w-sm">
                {isInstalled
                  ? "Running in full-screen standalone mode."
                  : `Launch faster directly from your home screen on ${browserInfo.browser}.`}
              </p>
            </div>
          </div>

          {/* Right action */}
          <div className="relative z-10 w-full sm:w-auto shrink-0 flex items-center gap-2">
            {isInstalled ? (
              <div className="w-full sm:w-auto px-3.5 py-1.5 rounded-full font-bold text-xs text-center flex items-center justify-center gap-1.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Installed</span>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleInstallClick}
                className="w-full sm:w-auto h-8.5 px-4 rounded-full font-bold text-xs cursor-pointer shadow-xs bg-[#0A1F44] hover:bg-[#0E2858] text-white dark:bg-[#B8861B] dark:hover:bg-[#C99826] dark:text-white border border-[#B8861B]/40 flex items-center justify-center gap-1.5"
              >
                {browserInfo.isIOS ? (
                  <Share2 className="size-3.5 text-[#E2BD56] dark:text-white shrink-0" />
                ) : (
                  <Smartphone className="size-3.5 text-[#E2BD56] dark:text-white shrink-0" />
                )}
                <span>
                  {isInstallable
                    ? "Install App"
                    : browserInfo.isIOS
                      ? "Add to iOS"
                      : "Add to Screen"}
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Guided Browser Install Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#0B1E3D] p-5 shadow-2xl border border-[#B8861B]/40 relative">
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 size-7 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-muted-foreground cursor-pointer transition-colors"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="size-9 rounded-xl bg-[#0A1F44] text-[#E2BD56] flex items-center justify-center ring-1 ring-[#B8861B]/40 shrink-0">
                <Compass className="size-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0A1F44] dark:text-white">
                  Add to Home Screen
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Follow these quick steps on {browserInfo.browser}:
                </p>
              </div>
            </div>

            <div className="space-y-2.5 my-4">
              {getBrowserGuideSteps().map((item) => (
                <div
                  key={item.step}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07162E] border border-slate-200/80 dark:border-white/10 flex items-start gap-2.5 text-xs text-foreground"
                >
                  <div className="size-5 rounded-full bg-[#B8861B]/15 text-[#B8861B] dark:text-[#E2BD56] font-bold text-[10px] grid place-items-center shrink-0 mt-0.5">
                    {item.step}
                  </div>
                  <div className="flex-1 min-w-0 leading-relaxed text-[11px]">
                    {item.text}
                  </div>
                  <div className="shrink-0">{item.icon}</div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full h-9 rounded-xl font-bold text-xs bg-[#B8861B] hover:bg-[#C99826] text-white cursor-pointer"
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
