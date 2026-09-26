interface KnustEmblemProps {
  className?: string;
  size?: number;
}

export function KnustEmblem({ className = "", size = 36 }: KnustEmblemProps) {
  return (
    <img
      src="/qmark_icon_standalone.png"
      alt="Qmark Official Emblem"
      width={size}
      height={size}
      decoding="async"
      className={`shrink-0 object-contain rounded-xl p-0.5 shadow-xs ${className}`}
      style={{ width: size, height: size }}
      referrerPolicy="no-referrer"
    />
  );
}
