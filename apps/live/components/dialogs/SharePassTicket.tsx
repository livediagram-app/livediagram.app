import type { ReactNode } from 'react';
import type { ShareRole } from '@/lib/api-client';
import { ROLE_PASS } from './share-dialog-parts';

// The ticket every share link is drawn as (docs/specs/007-editor/live-app.md
// "The pass metaphor"): a role-coloured stub, a perforated edge with a notch
// punched out top and bottom, and a body the caller fills. Active and expired
// passes share it so the two read as the same object in two states.
//
// The notches are circles in the DIALOG's background colour, half clipped by
// the card's overflow, so they read as holes through the card rather than
// shapes on it. Their border matches the card's so the cut has an edge.
const STUB_WIDTH = 'w-16';
const NOTCH =
  'pointer-events-none absolute left-16 h-[18px] w-[18px] -translate-x-1/2 rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';

export function SharePassTicket({
  role,
  expired = false,
  fresh = false,
  children,
}: {
  role: ShareRole;
  expired?: boolean;
  // Just issued: pops in so the eye lands on it.
  fresh?: boolean;
  children: ReactNode;
}) {
  const pass = ROLE_PASS[role];
  const { Icon } = pass;
  return (
    <li
      className={`relative flex overflow-hidden rounded-xl border shadow-sm ${
        expired
          ? 'border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/40'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/70'
      }${fresh ? ' animate-pop-in' : ''}`}
    >
      <div
        className={`flex ${STUB_WIDTH} shrink-0 flex-col items-center justify-center gap-1 py-3 ${
          expired ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400' : pass.solid
        }`}
      >
        <Icon />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em]">{pass.stamp}</span>
      </div>
      {/* Perforation, then the two punched notches sitting on it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-2 left-16 border-l-2 border-dashed border-slate-200 dark:border-slate-600"
      />
      <span aria-hidden className={`${NOTCH} -top-[9px]`} />
      <span aria-hidden className={`${NOTCH} -bottom-[9px]`} />
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-2.5 pr-3 pl-4">{children}</div>
    </li>
  );
}
