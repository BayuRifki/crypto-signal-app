'use client';

import React, { useCallback } from 'react';

export type BottomTab = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  count?: number;
  panel: React.ReactNode;
};

export interface BottomTabBarProps {
  tabs: BottomTab[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
  className?: string;
}

export default function BottomTabBar({
  tabs,
  value,
  onChange,
  ariaLabel = 'Bottom panel tabs',
  className = '',
}: BottomTabBarProps) {
  const activeTab = tabs.find((t) => t.id === value) ?? tabs[0];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, currentId: string) => {
      const currentIdx = tabs.findIndex((t) => t.id === currentId);
      if (currentIdx === -1) return;

      let nextIdx = currentIdx;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nextIdx = currentIdx > 0 ? currentIdx - 1 : tabs.length - 1;
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextIdx = currentIdx < tabs.length - 1 ? currentIdx + 1 : 0;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIdx = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIdx = tabs.length - 1;
      } else {
        return;
      }

      const nextTab = tabs[nextIdx];
      onChange(nextTab.id);
      // Focus the new tab button after state update
      requestAnimationFrame(() => {
        const btns = document.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        btns[nextIdx]?.focus();
      });
    },
    [tabs, onChange]
  );

  return (
    <div className={`flex flex-col border-t border-line bg-bg-panel ${className}`}>
      {/* Tab list */}
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex h-9 items-center gap-1 px-2"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === value;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
              className={[
                'flex items-center gap-1.5 rounded px-2 py-1 text-sm transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent',
                isActive
                  ? 'relative -mt-px border-t-2 border-accent bg-bg-elevated text-fg'
                  : 'text-fg-muted hover:bg-bg-elevated hover:text-fg',
              ].join(' ')}
            >
              {tab.icon && (
                <span className="flex-shrink-0 text-base leading-none">
                  {tab.icon}
                </span>
              )}
              <span className="leading-none">{tab.label}</span>
              {tab.count !== undefined && (
                <span className="rounded bg-bg-elevated px-1 text-xs text-fg-muted">
                  {tab.count}
                </span>
              )}
              {tab.badge}
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      {activeTab && (
        <div
          role="tabpanel"
          id={`panel-${activeTab.id}`}
          aria-labelledby={`tab-${activeTab.id}`}
          className="min-h-0 flex-1 overflow-auto"
        >
          {activeTab.panel}
        </div>
      )}
    </div>
  );
}