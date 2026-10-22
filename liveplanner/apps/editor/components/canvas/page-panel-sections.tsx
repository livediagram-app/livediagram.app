'use client';

// The Background section's frame (page-background-section.tsx): a titled section, and the tiles its kinds and
// patterns are picked from.
import type { ReactNode } from 'react';

export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-3 py-2">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

export const tileClass = (active: boolean) =>
  `flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] font-medium transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
    active
      ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-300 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/40'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;
