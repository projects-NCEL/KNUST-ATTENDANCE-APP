interface KnustEmblemProps {
  className?: string;
  size?: number;
}

export function KnustEmblem({ className = "", size = 36 }: KnustEmblemProps) {
  return (
    <img
      src="/knust-logo.svg"
      alt="KNUST Official Crest"
      width={size}
      height={size}
      className={`shrink-0 object-contain rounded-full bg-white p-0.5 shadow-xs ${className}`}
      style={{ width: size, height: size }}
      referrerPolicy="no-referrer"
    />
  );
}
