import type { ReactNode } from 'react';
import type { ShareRole } from '@/lib/api-client';
import { ROLE_PASS } from './share-dialog-parts';

// The card every share link is drawn as (docs/specs/007-editor/live-app.md
// "The pass metaphor"): a role-coloured stub and a body the caller fills.
// Active and expired passes share it so the two read as the same object in two
// states. A perforated edge with punched notches was tried and read as stray
// dots and circles at this size, so the stub's colour edge is the only divide.
const STUB_WIDTH = 'w-16';

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
        <span className="text-[10px] font-bold uppercase tracking-[0.12em]">{pass.stamp}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-2.5 pr-3 pl-4">{children}</div>
    </li>
  );
}
