'use client';

// The labelled tile grid of a context-menu section: one copy for every editor (their context-menu-rows hold the rest).
import { type ReactNode } from 'react';

export function BorderGrid({
  label,
  cols,
  children,
}: {
  label: string;
  cols: 2 | 3 | 4 | 5;
  children: ReactNode;
}) {
  const colClass =
    cols === 5
      ? 'grid-cols-5'
      : cols === 4
        ? 'grid-cols-4'
        : cols === 3
          ? 'grid-cols-3'
          : 'grid-cols-2';
  return (
    <div className="mb-1.5 last:mb-0">
      <p className="px-1 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className={`grid gap-1 ${colClass}`}>{children}</div>
    </div>
  );
}
