import { memo } from "react";

interface GoldMeshBackgroundProps {
  className?: string;
}

export const GoldMeshBackground = memo(function GoldMeshBackground({
  className = "",
}: GoldMeshBackgroundProps) {
  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden select-none -z-10 bg-background transition-colors duration-300 ${className}`}
      aria-hidden="true"
    >
      {/* Very subtle architectural hairline grid, ultra-clean */}
      <div
        className="absolute inset-0 opacity-[0.035] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
    </div>
  );
});
