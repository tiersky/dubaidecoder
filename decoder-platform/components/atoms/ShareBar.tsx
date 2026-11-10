import { rampColor } from '@/lib/ui/theme';

interface ShareBarProps {
  /** Fill fraction of the track, 0–1. */
  value: number;
  /** Ramp position for colour, 0–1 (relative to the leading market). */
  tone?: number;
  className?: string;
}

export default function ShareBar({ value, tone, className = '' }: ShareBarProps) {
  // Rounded so server and client serialize the same transform string.
  const v = Math.round(Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 1000) / 1000;
  return (
    <div className={`share-track ${className}`} aria-hidden>
      <div
        className="share-fill"
        style={{
          transform: `scaleX(${v})`,
          backgroundColor: rampColor(0.35 + 0.65 * (tone ?? v)),
        }}
      />
    </div>
  );
}
