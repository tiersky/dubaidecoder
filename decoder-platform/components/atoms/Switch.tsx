'use client';

interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  size?: 'md' | 'sm';
}

export default function Switch({ checked, onChange, label, size = 'md' }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-size={size}
      onClick={onChange}
      className="switch"
    >
      <span className="switch-knob" />
    </button>
  );
}
