import React from "react";

interface QmarkLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "full" | "icon" | "wordmark";
  theme?: "dark" | "light" | "auto";
  subtitle?: string;
  className?: string;
}

export const QmarkLogo: React.FC<QmarkLogoProps> = ({
  size = "md",
  variant = "full",
  theme = "auto",
  subtitle,
  className = "",
}) => {
  const sizeMap = {
    xs: { box: 24, mark: 18, text: "text-base", sub: "text-[9px]" },
    sm: { box: 32, mark: 24, text: "text-lg", sub: "text-[10px]" },
    md: { box: 40, mark: 30, text: "text-xl", sub: "text-[11px]" },
    lg: { box: 52, mark: 40, text: "text-2xl", sub: "text-xs" },
    xl: { box: 68, mark: 54, text: "text-3xl", sub: "text-sm" },
  };

  const { box, mark, text, sub } = sizeMap[size] || sizeMap.md;

  const isLight = theme === "light";
  const isDark = theme === "dark";

  // Standalone Qmark App Icon: Deep navy squircle with golden circular Q and checkmark tail
  const iconElement = (
    <div
      className="relative flex items-center justify-center shrink-0 select-none overflow-hidden"
      style={{
        width: box,
        height: box,
        borderRadius: Math.round(box * 0.22),
        backgroundColor: "#0A1931",
        border: "1px solid rgba(212, 175, 55, 0.25)",
        boxShadow: "0 2px 10px rgba(10, 25, 49, 0.35)",
      }}
    >
      <svg
        width={mark}
        height={mark}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Q Circle body */}
        <circle
          cx="256"
          cy="254"
          r="108"
          fill="none"
          stroke="#D4AF37"
          strokeWidth="28"
          strokeLinecap="round"
        />
        {/* Q Checkmark tail */}
        <polyline
          points="304,310 380,394 458,260"
          fill="none"
          stroke="#D4AF37"
          strokeWidth="28"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );

  if (variant === "icon") {
    return <div className={`inline-flex items-center ${className}`}>{iconElement}</div>;
  }

  const primaryTextColor = isDark
    ? "text-white"
    : isLight
    ? "text-[#0A1F44]"
    : "text-[#0A1F44] dark:text-white";

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {iconElement}
      {variant !== "icon" && (
        <div className="flex flex-col leading-none select-none">
          <div className="flex items-center">
            <span
              className={`font-black tracking-tight ${text} ${primaryTextColor}`}
              style={{ fontFamily: "'Poppins', 'Manrope', sans-serif" }}
            >
              Q<span style={{ color: "#D4AF37" }}>mark</span>
            </span>
          </div>
          {subtitle && (
            <span
              className={`font-medium ${sub} mt-0.5 tracking-wider uppercase ${
                isDark ? "text-neutral-400" : "text-neutral-500"
              }`}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
