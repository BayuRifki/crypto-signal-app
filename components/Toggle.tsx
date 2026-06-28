'use client';
import { Icon } from './Icon';

type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  icon?: React.ReactNode;
};

export default function Toggle({ checked, onChange, label, description, icon }: Props) {
  return (
    <label className="flex items-center gap-3 px-2 py-2 rounded hover:bg-bg-panel cursor-pointer group min-h-[44px]">
      <span className="text-fg-muted group-hover:text-fg transition flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-fg font-medium">{label}</div>
        {description && <div className="text-2xs text-fg-dim mt-0.5">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`Toggle ${label}`}
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        className={`relative w-10 h-6 rounded-full transition flex-shrink-0 cursor-pointer ${
          checked ? 'bg-accent' : 'bg-bg-hover border border-line-strong'
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[20px]' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  );
}
