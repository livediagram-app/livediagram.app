'use client';

// The This app / All Apps switch as one chip, for a phone's one-row toolbar (liveworkspace/docs/specs/004-index/
// one-explorer.md "A team's page", Work Tracker 1516): the current scope's logo, its name and a chevron. A tap opens a
// sheet of the two scopes, the current one ticked. Below 320px its name truncates before the row would wrap.

import { useState } from 'react';
import type { AppScope } from '@liveworkspace/ui';
import type { Choice } from '../ui/ChoiceSheet';
import { LazyChoiceSheet, preloadChoiceSheet } from '../ui/lazy-choice-sheet';
import { CaretDownIcon } from '../ui/icons';
import { siteOf } from '../words';
import { useExplorer } from './context';
import { useHostExtras } from './host';
import { TOOLBAR_CONTROL } from '../ui/classes';

export function ScopeChip() {
  const { app, filter, setFilter, renderAppLogo } = useExplorer();
  const { allLabel, showAppFilter } = useHostExtras();
  const [open, setOpen] = useState(false);
  if (!showAppFilter) return null;
  const choices: [Choice<AppScope>, Choice<AppScope>] = [
    { value: 'app', label: siteOf(app).name, logo: renderAppLogo?.(app) },
    { value: 'all', label: allLabel, logo: renderAppLogo?.('all') },
  ];
  const current = filter === 'all' ? choices[1] : choices[0];
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Show: ${current.label}`}
        data-scope-chip={current.value}
        onPointerDown={() => void preloadChoiceSheet()}
        onFocus={() => void preloadChoiceSheet()}
        onClick={() => setOpen(true)}
        className={`${TOOLBAR_CONTROL} min-w-0 gap-1.5 px-2.5 text-sm font-medium`}
      >
        {current.logo ? (
          <span aria-hidden className="inline-flex shrink-0 [&_svg]:size-4">
            {current.logo}
          </span>
        ) : null}
        <span className="min-w-0 truncate">{current.label}</span>
        <span aria-hidden className="inline-flex shrink-0 text-slate-400">
          <CaretDownIcon />
        </span>
      </button>
      <LazyChoiceSheet
        open={open}
        title="Show"
        choices={choices}
        value={filter}
        onPick={setFilter}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
