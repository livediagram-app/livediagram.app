'use client';

// A dialog's tab bar (the Sankey Flows dialog's Table / Text, the Sequence dialog's Messages / Text): underlined tabs
// on the left, arrow keys moving between them, and anything the dialog adds on the right (an Import button).
// Each panel is labelled by its tab through `${idPrefix}-tab-${tab}` / `${idPrefix}-panel-${tab}`.

import type { ReactNode } from 'react';

export function DialogTabs<T extends string>({
  tabs,
  labels,
  value,
  onChange,
  idPrefix,
  ariaLabel,
  children,
}: {
  tabs: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (tab: T) => void;
  idPrefix: string;
  ariaLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 max-sm:px-4 dark:border-slate-800">
      <div role="tablist" aria-label={ariaLabel} className="flex gap-1">
        {tabs.map((t) => {
          const on = t === value;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${t}`}
              aria-selected={on}
              aria-controls={`${idPrefix}-panel-${t}`}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(t)}
              onKeyDown={(e) => {
                const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
                if (!step) return;
                e.preventDefault();
                const next = tabs[(tabs.indexOf(value) + step + tabs.length) % tabs.length]!;
                onChange(next);
                document.getElementById(`${idPrefix}-tab-${next}`)?.focus();
              }}
              className={`relative cursor-pointer px-2 py-2.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                on
                  ? 'text-slate-900 dark:text-slate-50'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {labels[t]}
              {on ? (
                <span
                  aria-hidden
                  className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-brand-500"
                />
              ) : null}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}
