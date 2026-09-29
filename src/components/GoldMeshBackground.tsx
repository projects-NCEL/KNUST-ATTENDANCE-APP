import { memo } from "react";
import { motion } from "motion/react";

interface GoldMeshBackgroundProps {
  className?: string;
  variant?: "grid" | "dots" | "clean" | "both";
  intensity?: "subtle" | "medium" | "vibrant";
  showRadialGlow?: boolean;
}

export const GoldMeshBackground = memo(function GoldMeshBackground({
  className = "",
  variant = "grid",
  intensity = "subtle",
  showRadialGlow = true,
}: GoldMeshBackgroundProps) {
  const opacity =
    intensity === "subtle"
      ? "opacity-60"
      : intensity === "medium"
        ? "opacity-80"
        : "opacity-100";

  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden select-none -z-10 ${className}`}
      aria-hidden="true"
    >
      {/* Base Canvas */}
      <div className="absolute inset-0 bg-background transition-colors duration-500" />

      {/* Atmospheric Ambient Lighting (Perimeter Aura, leaves content zone clear for text readability) */}
      {showRadialGlow && (
        <>
          {/* Top subtle golden light wash */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] sm:w-[900px] h-[380px] rounded-full bg-gradient-to-b from-[#B8861B]/12 via-[#B8861B]/04 to-transparent blur-3xl pointer-events-none transform-gpu" />

          {/* Deep Navy/Slate top-left soft aura */}
          <div className="absolute -top-20 -left-20 w-[420px] h-[420px] rounded-full bg-[#0A1F44]/05 dark:bg-[#123164]/30 blur-3xl pointer-events-none" />

          {/* Warm Antique Gold perimeter glow on bottom-right */}
          <div className="absolute -bottom-24 -right-24 w-[480px] h-[480px] rounded-full bg-[#B8861B]/10 dark:bg-[#B8861B]/08 blur-3xl pointer-events-none" />
        </>
      )}

      {/* Architectural Precision Grid - Minimal, crisp, executive */}
      {(variant === "grid" || variant === "both") && (
        <div
          className={`absolute inset-0 bg-precision-grid ${opacity} transition-opacity duration-300`}
          style={{
            maskImage:
              "radial-gradient(ellipse 80% 70% at 50% 40%, black 40%, transparent 95%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 70% at 50% 40%, black 40%, transparent 95%)",
          }}
        />
      )}

      {/* Micro Point Matrix Layer */}
      {(variant === "dots" || variant === "both") && (
        <div
          className={`absolute inset-0 bg-precision-dots ${opacity} transition-opacity duration-300`}
          style={{
            maskImage:
              "radial-gradient(ellipse 60% 50% at 50% 50%, black 30%, transparent 90%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 60% 50% at 50% 50%, black 30%, transparent 90%)",
          }}
        />
      )}

      {/* Ultra-subtle Breathing Light Accent */}
      <motion.div
        animate={{
          opacity: [0.08, 0.18, 0.08],
          scale: [1, 1.04, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[260px] rounded-full bg-radial from-[#B8861B]/10 via-transparent to-transparent blur-3xl pointer-events-none"
      />
    </div>
  );
});
