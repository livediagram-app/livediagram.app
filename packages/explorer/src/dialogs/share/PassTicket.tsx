'use client';

// The card every share link is drawn as: a band in its level's colour across the top, and a body the caller fills.
// Live and expired passes share it, so the two read as one object in two states. A pass just issued opens into the
// list and wears a ring for a moment; one on its way out closes its space (usePassExit).

import { useRef, useState, type ReactNode } from 'react';
import type { Level } from '@liveworkspace/index-client';
import { LEVEL_PASS } from './parts';

export function PassTicket({
  level,
  code,
  expired = false,
  fresh = false,
  highlight = false,
  leaving = false,
  children,
}: {
  level: Level;
  code: string;
  expired?: boolean;
  fresh?: boolean;
  highlight?: boolean;
  leaving?: boolean;
  children: ReactNode;
}) {
  const pass = LEVEL_PASS[level];
  const motion = leaving ? 'lw-pass-close' : fresh ? 'lw-pass-open' : '';
  return (
    <li
      data-share-link={code}
      data-share-pass-highlight={highlight ? '' : undefined}
      className={`grid ${motion}`}
    >
      <div className="min-h-0 overflow-hidden px-0.5 pb-2 pt-0.5">
        <div
          className={`relative flex flex-col overflow-hidden rounded-xl border shadow-sm transition-[border-color,box-shadow] duration-300 ${
            expired
              ? 'border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/40'
              : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/70'
          }${highlight ? ' border-brand-300 ring-2 ring-brand-400/40 dark:border-brand-500/60' : ''}`}
        >
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 ${
              expired
                ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                : pass.solid
            }`}
          >
            <pass.Icon />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em]">{pass.title}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-2 px-3 py-2.5">{children}</div>
        </div>
      </div>
    </li>
  );
}

// How long a pass takes to close its space (explorer.css lw-pass-close).
export const PASS_EXIT_MS = 200;

/** A pass's way out: `leave` closes its space, then runs `onGone` (the revoke, which the list already reflects). */
export function usePassExit(onGone: () => void): { leaving: boolean; leave: () => void } {
  const [leaving, setLeaving] = useState(false);
  const gone = useRef(onGone);
  gone.current = onGone;
  return {
    leaving,
    leave: () => {
      if (leaving) return;
      setLeaving(true);
      // Not cleared on unmount: closing the dialog mid-way still revokes.
      setTimeout(() => gone.current(), PASS_EXIT_MS);
    },
  };
}
