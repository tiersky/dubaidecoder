interface FlagProps {
  iso2: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { box: 'w-6 h-[18px] rounded-[4px] text-[8px]', src: 'w40' },
  md: { box: 'w-8 h-6 rounded-[5px] text-[9px]', src: 'w80' },
  lg: { box: 'w-16 h-12 rounded-[10px] text-xs', src: 'w160' },
} as const;

/** Flag with a hairline ring so pale flags (Japan, Finland) keep an edge. */
export default function Flag({ iso2, name, size = 'sm' }: FlagProps) {
  const s = SIZES[size];
  if (iso2 === null) {
    return (
      <span
        aria-hidden
        className={`${s.box} flex flex-shrink-0 items-center justify-center bg-black/[0.06] font-semibold uppercase text-ink-2`}
      >
        {name.slice(0, 2)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/${s.src}/${iso2}.png`}
      alt=""
      className={`${s.box} flex-shrink-0 object-cover shadow-[0_0_0_0.5px_rgba(0,0,0,0.14),0_1px_2px_rgba(0,0,0,0.08)]`}
    />
  );
}
