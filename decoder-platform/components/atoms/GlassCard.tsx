interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  padding?: string;
  style?: React.CSSProperties;
}

export default function GlassCard({
  children,
  className = "",
  hover = false,
  onClick,
  padding = "p-6",
  style,
}: GlassCardProps) {
  return (
    <div
      className={`glass-card ${padding} ${hover ? "glass-card-hover cursor-pointer" : ""} ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}
