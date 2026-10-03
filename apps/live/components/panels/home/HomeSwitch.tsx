'use client';

// The phone's Recent / Timeline switch (docs/specs/013-workspace/explorer-home.md "Layout"): the
// WAI-ARIA tabs pattern, two tabs and one panel. One tab stop on the selected tab; Left and Right
// move and select (wrapping), Home and End go to the first and last.

import { useRef, type KeyboardEvent } from 'react';
import { HOME_COPY } from '@/app/explorer/home/home-copy';
import { FOCUS_RING } from './home-styles';

export type HomeColumn = 'recent' | 'timeline';

const COLUMNS: readonly HomeColumn[] = ['recent', 'timeline'];
const LABELS: Readonly<Record<HomeColumn, string>> = {
  recent: HOME_COPY.recent,
  timeline: HOME_COPY.timeline,
};

export function homeTabId(column: HomeColumn): string {
  return `home-tab-${column}`;
}

export const HOME_PANEL_ID = 'home-tabpanel';

export function HomeSwitch({
  column,
  onChange,
}: {
  column: HomeColumn;
  onChange: (column: HomeColumn) => void;
}) {
  const tabs = useRef<Partial<Record<HomeColumn, HTMLButtonElement | null>>>({});

  const select = (next: HomeColumn) => {
    onChange(next);
    tabs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = COLUMNS.indexOf(column);
    const last = COLUMNS.length - 1;
    const to =
      e.key === 'ArrowRight'
        ? (at + 1) % COLUMNS.length
        : e.key === 'ArrowLeft'
          ? (at - 1 + COLUMNS.length) % COLUMNS.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (to === null) return;
    e.preventDefault();
    select(COLUMNS[to]!);
  };

  return (
    <div
      role="tablist"
      aria-label={HOME_COPY.switchLabel}
      onKeyDown={onKeyDown}
      className="grid grid-cols-2 gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800"
    >
      {COLUMNS.map((c) => {
        const on = c === column;
        return (
          <button
            key={c}
            ref={(el) => {
              tabs.current[c] = el;
            }}
            type="button"
            role="tab"
            id={homeTabId(c)}
            aria-selected={on}
            aria-controls={HOME_PANEL_ID}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(c)}
            className={`h-9 rounded-md text-sm font-semibold transition ${FOCUS_RING} ${
              on
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
            }`}
          >
            {LABELS[c]}
          </button>
        );
      })}
    </div>
  );
}
