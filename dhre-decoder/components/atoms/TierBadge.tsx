import { Tier, TIER_CONFIG } from '@/types';

interface TierBadgeProps {
  tier: Tier;
}

export default function TierBadge({ tier }: TierBadgeProps) {
  const config = TIER_CONFIG[tier];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      {config.label}
    </span>
  );
}
