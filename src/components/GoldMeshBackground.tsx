import { memo } from "react";
import { motion } from "motion/react";

interface GoldMeshBackgroundProps {
  className?: string;
  variant?: "dots" | "diamonds" | "both";
  intensity?: "subtle" | "medium" | "vibrant";
  showRadialGlow?: boolean;
}

export const GoldMeshBackground = memo(function GoldMeshBackground({
  className = "",
  variant = "both",
  intensity = "vibrant",
  showRadialGlow = true,
}: GoldMeshBackgroundProps) {
  const opacity = intensity === "subtle" ? "opacity-50" : intensity === "medium" ? "opacity-80" : "opacity-100";

  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden select-none -z-10 ${className}`}
      aria-hidden="true"
    >
      {/* Base Canvas */}
      <div className="absolute inset-0 bg-background transition-colors duration-500" />

      {/* Gold Radiant Shade Glows - refined darker gold so text stays clearly visible */}
      {showRadialGlow && (
        <>
          {/* Top Center Radiant Gold Halo */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[850px] h-[550px] rounded-full bg-gradient-to-b from-[#B8861B]/18 via-[#B8861B]/08 to-transparent blur-3xl pointer-events-none transform-gpu" />

          {/* Deep Navy/Gold Secondary Ambient Orbs */}
          <div className="absolute top-1/4 -right-20 w-[500px] h-[500px] rounded-full bg-[#B8861B]/12 dark:bg-[#B8861B]/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 -left-20 w-[520px] h-[520px] rounded-full bg-[#B8861B]/10 dark:bg-[#B8861B]/08 blur-3xl pointer-events-none" />
        </>
      )}

      {/* Gold Diamond Geometric Mesh Layer */}
      {(variant === "diamonds" || variant === "both") && (
        <div className={`absolute inset-0 bg-gold-diamonds ${opacity} transition-opacity duration-300`} />
      )}

      {/* Gold Dot Matrix Layer */}
      {(variant === "dots" || variant === "both") && (
        <div className={`absolute inset-0 bg-gold-dots ${opacity} transition-opacity duration-300`} />
      )}

      {/* Subtle Dynamic Animated Gold Light Beam */}
      <motion.div
        animate={{
          opacity: [0.14, 0.32, 0.14],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] rounded-full bg-radial from-[#B8861B]/15 via-transparent to-transparent blur-2xl pointer-events-none"
      />
    </div>
  );
});
