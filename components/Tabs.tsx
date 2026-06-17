'use client';
import { useState, type ReactNode, useEffect, useRef } from 'react';

export type Tab = { id: string; label: string; icon?: ReactNode; badge?: ReactNode; count?: number };

type Props = {
  tabs: Tab[];
  value: string;
  onChange: (id: string) => void;
  size?: 'sm' | 'md';
  ariaLabel?: string;
};

export default function Tabs({ tabs, value, onChange, size = 'md', ariaLabel = 'Tabs' }: Props) {
  const tabId = (id: string) => `tab-${id}`;
  const panelId = (id: string) => `panel-${id}`;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = tabs.length - 1;
    else return;
    e.preventDefault();
    tabRefs.current[nextIndex]?.focus();
    onChange(tabs[nextIndex].id);
  };

  return (
    <>
      <div role="tablist" aria-label={ariaLabel} className="flex gap-0.5 p-0.5 bg-bg-elevated border border-line rounded-md overflow-x-auto scrollbar-none">
        {tabs.map((t, i) => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[i] = el; }}
              role="tab"
              id={tabId(t.id)}
              aria-selected={active}
              aria-controls={panelId(t.id)}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded font-medium transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info ${
                size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-3.5 text-sm'
              } ${active ? 'bg-bg-card text-fg shadow-soft' : 'text-fg-muted hover:text-fg hover:bg-bg-panel'}`}
            >
              {t.icon}
              <span>{t.label}</span>
              {typeof t.count === 'number' && (
                <span className={`px-1.5 rounded text-2xs font-bold tabular ${active ? 'bg-info/20 text-info' : 'bg-bg-panel text-fg-dim'}`}>
                  {t.count}
                </span>
              )}
              {t.badge}
            </button>
          );
        })}
      </div>
    </>
  );
}

export const useTabs = (initial: string) => {
  const [value, setValue] = useState(initial);
  return { value, setValue };
};
