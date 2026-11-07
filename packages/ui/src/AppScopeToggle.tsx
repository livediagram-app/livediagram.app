'use client';

import type { ReactNode } from 'react';
import { HoverCard } from './HoverCard';

/** Which apps a page shows: the one it was opened from, or every app. */
export type AppScope = 'app' | 'all';

/** One side of the switch: its words, its logo and what its hover card says. */
export type AppScopeOption = {
  label: string;
  // The product's logo mark (an app's prism, or liveworkspace's for every app), drawn at 16px.
  logo?: ReactNode;
  // The hover card's line under the label: what the side shows.
  description: string;
};

const SEGMENTS =
  'flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800';
const segment = (active: boolean) =>
  `flex h-7 cursor-pointer items-center justify-center rounded px-2 text-xs font-medium transition-colors duration-micro ${
    active
      ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-200'
      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
  }`;

// The "this app or All Apps" switch (liveworkspace/docs/specs/010-site/site.md "The Explorer", Which app; "The Community",
// Which posts): two segments, the app's own name and All Apps, each with its logo and a hover card naming what it
// shows. The Explorer's pane header and the Community page both draw it, so the two scopes look and read the same.
export function AppScopeToggle({
  value,
  onChange,
  app,
  all,
  className = '',
}: {
  value: AppScope;
  onChange: (next: AppScope) => void;
  app: AppScopeOption;
  all: AppScopeOption;
  className?: string;
}) {
  const side = (scope: AppScope, option: AppScopeOption) => (
    <HoverCard title={option.label} description={option.description}>
      <button
        type="button"
        aria-pressed={value === scope}
        onClick={() => {
          if (value !== scope) onChange(scope);
        }}
        className={segment(value === scope)}
      >
        {option.logo ? (
          <span aria-hidden className="mr-1.5 inline-flex shrink-0 [&_svg]:size-4">
            {option.logo}
          </span>
        ) : null}
        {option.label}
      </button>
    </HoverCard>
  );
  return (
    <div role="group" aria-label="Show" className={`${SEGMENTS} ${className}`}>
      {side('app', app)}
      {side('all', all)}
    </div>
  );
}
