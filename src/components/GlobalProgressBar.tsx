import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

/**
 * GlobalProgressBar
 * A subtle, premium golden progress line with shimmering light glow and
 * an unobtrusive corner micro-spinner that animates whenever client navigation
 * is in transit or asynchronous React Query data is being fetched/mutated.
 */
export function GlobalProgressBar() {
  const routerState = useRouterState();
  const isNavigating = routerState.status === "pending";
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();

  const isBusy = isNavigating || isFetching > 0 || isMutating > 0;

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let finishTimer: NodeJS.Timeout;

    if (isBusy) {
      setVisible(true);
      setProgress((prev) => (prev === 0 ? 15 : prev));

      // Increment progress realistically while pending
      timer = setInterval(() => {
        setProgress((prev) => {
          if (prev < 60) return prev + Math.random() * 15 + 5;
          if (prev < 85) return prev + Math.random() * 5 + 2;
          if (prev < 94) return prev + 0.5;
          return prev;
        });
      }, 150);
    } else if (visible) {
      // Complete bar to 100% then fade out smoothly
      setProgress(100);
      finishTimer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 350);
    }

    return () => {
      clearInterval(timer);
      clearTimeout(finishTimer);
    };
  }, [isBusy, visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[9999] pointer-events-none select-none"
      role="progressbar"
      aria-label="Loading page data"
      aria-valuenow={Math.round(progress)}
    >
      {/* Ultra-fine Golden Shimmer Progress Bar */}
      <div className="relative w-full h-[2.5px] bg-transparent overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#D4AF37] via-[#FFF3B0] to-[#D4AF37] transition-all duration-200 ease-out shadow-[0_0_12px_rgba(212,175,55,0.85),0_0_4px_rgba(212,175,55,1)]"
          style={{ width: `${progress}%` }}
        />
        {/* Trailing golden radiant particle pulse */}
        <div
          className="absolute top-0 bottom-0 w-24 bg-gradient-to-r from-transparent via-white/80 to-transparent blur-[1px] -translate-y-1/2"
          style={{
            left: `calc(${progress}% - 96px)`,
            transition: "left 200ms ease-out",
          }}
        />
      </div>

      {/* Subtle Micro-spinner in top-right corner */}
      <div className="absolute top-3.5 right-4 flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/80 dark:bg-[#0A1F44]/80 backdrop-blur-md border border-[#D4AF37]/40 shadow-sm animate-in fade-in duration-200">
        <svg
          className="size-3.5 text-[#D4AF37] animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3.5"
          />
          <path
            className="opacity-90"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-[10px] font-bold text-[#0A1F44] dark:text-[#F3E5AB] tracking-tight">
          Loading...
        </span>
      </div>
    </div>
  );
}
