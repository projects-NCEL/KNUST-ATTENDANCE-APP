import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    __qmarkSplashDone?: boolean;
  }
}

const SPLASH_DONE_EVENT = "qmark:splash-done";

/** Runs `cb` as soon as the launch animation has finished (right away if it already has). */
export function onSplashDone(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (window.__qmarkSplashDone) {
    cb();
    return () => {};
  }
  const handler = () => cb();
  window.addEventListener(SPLASH_DONE_EVENT, handler, { once: true });
  return () => window.removeEventListener(SPLASH_DONE_EVENT, handler);
}

function markSplashDone() {
  if (typeof window === "undefined") return;
  window.__qmarkSplashDone = true;
  window.dispatchEvent(new Event(SPLASH_DONE_EVENT));
}

/**
 * Snappy Qmark Animated Splash Screen.
 * Fast, crisp presentation that launches smoothly and quickly.
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(true);

  const innerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const markWrapRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<SVGSVGElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const ruleRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const loaderFillRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      sessionStorage.removeItem("qmark_splash_played");
    } catch {
      // ignore
    }

    const inner = innerRef.current;
    const glow = glowRef.current;
    const markWrap = markWrapRef.current;
    const anim = animRef.current;
    const wordmark = wordmarkRef.current;
    const rule = ruleRef.current;
    const tagline = taglineRef.current;
    const loaderFill = loaderFillRef.current;

    if (!inner || !glow || !markWrap || !anim || !wordmark || !rule || !tagline) {
      return;
    }

    const PHASES = ["bg", "logo", "wordmark", "tagline", "hold", "exit"];
    // Snappy durations: logo appears almost immediately, entire sequence ~1.6s
    const DURATIONS: Record<string, number> = {
      bg: 60,
      logo: 440,
      wordmark: 240,
      tagline: 280,
      hold: 340,
      exit: 280,
    };

    const LOADER_WIDTHS: Record<string, string> = {
      bg: "20%",
      logo: "45%",
      wordmark: "70%",
      tagline: "88%",
      hold: "100%",
      exit: "100%",
    };

    function applyPhase(phase: string) {
      if (!inner || !glow || !markWrap || !anim || !wordmark || !rule || !tagline) return;

      const logoVisible = phase !== "bg";
      const strokeAnimate = ["logo", "wordmark", "tagline", "hold", "exit"].includes(phase);
      const wordmarkVisible = ["wordmark", "tagline", "hold"].includes(phase);
      const taglineVisible = ["tagline", "hold"].includes(phase);
      const exiting = phase === "exit";

      inner.classList.toggle("exiting", exiting);
      glow.classList.toggle("on", strokeAnimate);

      markWrap.classList.toggle("visible", logoVisible);
      markWrap.classList.remove("scale-1", "scale-exit");
      if (phase === "exit") {
        markWrap.classList.add("scale-exit");
      } else if (logoVisible) {
        markWrap.classList.add("scale-1");
      }

      anim.classList.toggle("animate", strokeAnimate);
      wordmark.classList.toggle("visible", wordmarkVisible);
      rule.classList.toggle("visible", taglineVisible);
      tagline.classList.toggle("visible", taglineVisible);

      if (loaderFill && LOADER_WIDTHS[phase]) {
        loaderFill.style.width = LOADER_WIDTHS[phase];
      }
    }

    // Reset to frame zero without transitions
    inner.style.transition = "none";
    anim.style.transition = "none";
    applyPhase("bg");
    void inner.offsetWidth; // force reflow
    inner.style.transition = "";
    anim.style.transition = "";

    let idx = 0;

    function advance() {
      const phase = PHASES[idx];
      applyPhase(phase);

      if (idx === PHASES.length - 1) {
        // Exit complete: unmount after exit duration
        timerRef.current = setTimeout(() => {
          setVisible(false);
          markSplashDone();
        }, DURATIONS[phase]);
        return;
      }

      timerRef.current = setTimeout(() => {
        idx++;
        advance();
      }, DURATIONS[phase]);
    }

    advance();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const inner = innerRef.current;
    const markWrap = markWrapRef.current;
    if (inner) inner.classList.add("exiting");
    if (markWrap) markWrap.classList.add("scale-exit");
    setTimeout(() => {
      setVisible(false);
      markSplashDone();
    }, 280);
  };

  if (!visible) return null;

  return (
    <div
      id="screen-splash"
      role="dialog"
      aria-label="App Launch Screen"
      onClick={dismiss}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        // Visible screen height (excludes the browser address bar), so "middle" is the real middle
        height: "100dvh",
        zIndex: 9999,
        background: "var(--navy, #0A1F44)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
        fontFamily: "'Manrope', system-ui, sans-serif",
      }}
    >
      <style>{`
        #screen-splash {
          --navy: #0A1F44;
          --navy-light: #0F2A5C;
          --gold: #D4AF37;
          --gold-light: #E8C84A;
        }

        .splash-inner {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          opacity: 1;
          width: 100%;
          transition: opacity 0.4s ease, transform 0.4s ease;
        }
        .splash-inner.exiting {
          opacity: 0;
          transform: scale(0.96);
          transition: opacity 0.28s cubic-bezier(0.55, 0, 1, 0.45), transform 0.28s cubic-bezier(0.55, 0, 1, 0.45);
        }

        .splash-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(ellipse 280px 280px at 50% 50%, rgba(212,175,55,0.07) 0%, transparent 70%);
          opacity: 0;
          transition: opacity 0.6s ease;
        }
        .splash-glow.on {
          opacity: 1;
        }

        .splash-mark-wrap {
          margin-bottom: 20px;
          opacity: 0;
          transform: scale(0.65);
          transition: none;
        }
        .splash-mark-wrap.visible {
          opacity: 1;
          transition: opacity 0.2s ease, transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .splash-mark-wrap.scale-1 {
          transform: scale(1);
        }
        .splash-mark-wrap.scale-exit {
          transform: scale(0.96);
        }

        .splash-wordmark {
          opacity: 0;
          transform: translateY(14px);
          transition: none;
        }
        .splash-wordmark.visible {
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.25s cubic-bezier(0.22, 1, 0.36, 1), transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .splash-wordmark span {
          font-size: 36px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #fff;
          line-height: 1;
          font-family: 'Manrope', system-ui, sans-serif;
        }
        .splash-wordmark span.gold {
          color: var(--gold, #D4AF37);
        }

        .splash-tagline-wrap {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 9px;
          width: 220px;
        }
        .splash-rule {
          width: 100%;
          height: 1.5px;
          background: linear-gradient(90deg, transparent, var(--gold, #D4AF37) 20%, var(--gold, #D4AF37) 80%, transparent);
          transform-origin: left center;
          transform: scaleX(0);
          opacity: 0;
          transition: none;
        }
        .splash-rule.visible {
          transform: scaleX(1);
          opacity: 1;
          transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .splash-tagline {
          color: rgba(212,175,55,0.75);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-align: center;
          opacity: 0;
          transform: translateY(5px);
          transition: none;
          font-family: 'Manrope', system-ui, sans-serif;
        }
        .splash-tagline.visible {
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.25s ease 0.06s, transform 0.25s ease 0.06s;
        }

        .splash-loader-track {
          position: absolute;
          left: 0;
          right: 0;
          bottom: calc(28px + env(safe-area-inset-bottom, 0px));
          display: flex;
          justify-content: center;
        }
        .splash-loader {
          width: 100px;
          height: 4px;
          background: rgba(255,255,255,0.15);
          border-radius: 2px;
          overflow: hidden;
          position: relative;
        }
        .splash-loader-fill {
          position: absolute;
          inset-block: 0;
          left: 0;
          width: 20%;
          background: var(--gold, #D4AF37);
          border-radius: 2px;
          transition: width 0.35s ease-out;
        }

        /* Qmark animated SVG strokes */
        #qmark-anim circle.ring,
        #qmark-anim path.bracket,
        #qmark-anim path.check {
          transition: none;
        }
        #qmark-anim.animate circle.glow {
          opacity: 0.07;
          transition: opacity 0.5s ease;
        }
        #qmark-anim circle.glow {
          opacity: 0;
          filter: blur(16px);
        }
        #qmark-anim circle.ring {
          stroke-dasharray: 176;
          stroke-dashoffset: 176;
          opacity: 0.6;
        }
        #qmark-anim.animate circle.ring {
          stroke-dashoffset: 0;
          opacity: 1;
          transition: stroke-dashoffset 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.15s;
        }
        #qmark-anim path.bracket {
          stroke-dasharray: 24;
          stroke-dashoffset: 24;
          opacity: 0;
        }
        #qmark-anim.animate path.bracket {
          stroke-dashoffset: 0;
          opacity: 1;
        }
        #qmark-anim.animate path.bracket:nth-of-type(1) {
          transition: stroke-dashoffset 0.22s cubic-bezier(0.22, 1, 0.36, 1) 0.18s;
        }
        #qmark-anim.animate path.bracket:nth-of-type(2) {
          transition: stroke-dashoffset 0.22s cubic-bezier(0.22, 1, 0.36, 1) 0.22s;
        }
        #qmark-anim.animate path.bracket:nth-of-type(3) {
          transition: stroke-dashoffset 0.22s cubic-bezier(0.22, 1, 0.36, 1) 0.26s;
        }
        #qmark-anim path.check {
          stroke-dasharray: 56;
          stroke-dashoffset: 56;
          opacity: 0;
        }
        #qmark-anim.animate path.check {
          stroke-dashoffset: 0;
          opacity: 1;
          transition: stroke-dashoffset 0.3s cubic-bezier(0.22, 1, 0.36, 1) 0.14s;
        }
      `}</style>

      {/* Splash Inner Container */}
      <div ref={innerRef} className="splash-inner">
        <div ref={glowRef} className="splash-glow" />

        <div ref={markWrapRef} className="splash-mark-wrap">
          <svg
            ref={animRef}
            id="qmark-anim"
            viewBox="4 -3 100 100"
            width="100"
            height="100"
            fill="none"
            style={{ overflow: "visible" }}
          >
            <circle className="glow" cx="46" cy="44" r="38" fill="#D4AF37" />
            <circle
              className="ring"
              cx="46"
              cy="44"
              r="28"
              stroke="#D4AF37"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              className="bracket"
              d="M 18 32 L 18 22 L 28 22"
              stroke="#D4AF37"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              className="bracket"
              d="M 64 22 L 74 22 L 74 32"
              stroke="#D4AF37"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              className="bracket"
              d="M 18 56 L 18 66 L 28 66"
              stroke="#D4AF37"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              className="check"
              d="M 60 60 L 70 72 L 90 48"
              stroke="#D4AF37"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div ref={wordmarkRef} className="splash-wordmark">
          <span>
            Q<span className="gold">mark</span>
          </span>
        </div>

        <div className="splash-tagline-wrap">
          <div ref={ruleRef} className="splash-rule" />
          <span ref={taglineRef} className="splash-tagline">
            Attendance, verified instantly.
          </span>
        </div>
      </div>

      {/* Splash Loader Track */}
      <div className="splash-loader-track">
        <div className="splash-loader">
          <div ref={loaderFillRef} className="splash-loader-fill" />
        </div>
      </div>
    </div>
  );
}
