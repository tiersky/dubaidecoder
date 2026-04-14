interface MetricValueProps {
  value: string | number;
  label: string;
  sublabel?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}

export default function MetricValue({
  value,
  label,
  sublabel,
  color = "text-slate-900",
  size = "md",
}: MetricValueProps) {
  const sizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl",
  };

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
        {label}
      </p>
      <p className={`${sizeClasses[size]} font-bold ${color} tracking-tight`}>
        {value}
      </p>
      {sublabel && (
        <p className="text-xs text-slate-400 mt-1">{sublabel}</p>
      )}
    </div>
  );
}
