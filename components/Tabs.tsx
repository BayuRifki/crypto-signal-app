'use client';
import { useState, type ReactNode } from 'react';

export type Tab = { id: string; label: string; icon?: ReactNode; badge?: ReactNode };

type Props = {
  tabs: Tab[];
  value: string;
  onChange: (id: string) => void;
  size?: 'sm' | 'md';
};

export default function Tabs({ tabs, value, onChange, size = 'md' }: Props) {
  return (
    <div className="flex gap-0.5 p-0.5 bg-bg-elevated border border-line rounded-md overflow-x-auto scrollbar-none">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded font-medium transition focus-ring ${
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
            } ${active ? 'bg-bg-card text-fg shadow-soft' : 'text-fg-muted hover:text-fg hover:bg-bg-panel'}`}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.badge}
          </button>
        );
      })}
    </div>
  );
}

export const useTabs = (initial: string) => {
  const [value, setValue] = useState(initial);
  return { value, setValue };
};
