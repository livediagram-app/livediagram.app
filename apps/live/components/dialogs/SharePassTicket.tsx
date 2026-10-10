import type { ReactNode } from 'react';
import type { ShareRole } from '@/lib/api-client';
import { ROLE_PASS } from './share-dialog-parts';

// The card every share link is drawn as (docs/specs/007-editor/live-app.md
// "The pass metaphor"): a role-coloured header band and a body the caller fills.
// Active and expired passes share it so the two read as the same object in two
// states. The band runs across the top rather than down the left so the body,
// and the link in it, has the card's whole width (blueprint SR7).

// Arrival and departure (docs/specs/007-editor/live-app.md "Share dialog"):
// the <li> is a one-row grid whose row eases between 0fr and 1fr, so a pass
// opens or closes its own space and the passes around it glide instead of
// jumping. The gap between passes lives INSIDE the collapsing row (pb-2 here,
// no gap on the <ul>), so it closes with the pass; the 2px inset on the other
// sides keeps the card's shadow and highlight ring inside the clip.
export function SharePassTicket({
  role,
  expired = false,
  fresh = false,
  highlight = false,
  leaving = false,
  onLeft,
  children,
}: {
  role: ShareRole;
  expired?: boolean;
  // Just issued: opens into the list.
  fresh?: boolean;
  // Just issued and still worth pointing at: a brand ring that fades out.
  highlight?: boolean;
  // On its way out: closes its space, then `onLeft` fires to remove it.
  leaving?: boolean;
  onLeft?: () => void;
  children: ReactNode;
}) {
  const pass = ROLE_PASS[role];
  const { Icon } = pass;
  const motion = leaving ? 'animate-row-close' : fresh ? 'animate-row-open' : '';
  return (
    <li
      className={`grid ${motion}`}
      onAnimationEnd={(e) => {
        // Only this row's own close, not an animation bubbling from inside.
        if (leaving && e.target === e.currentTarget) onLeft?.();
      }}
    >
      <div className="min-h-0 overflow-hidden px-0.5 pt-0.5 pb-2">
        <div
          className={`relative flex flex-col overflow-hidden rounded-xl border shadow-sm transition-[border-color,box-shadow] duration-long ${
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
            <Icon />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em]">{pass.stamp}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-2 px-3 py-2.5">{children}</div>
        </div>
      </div>
    </li>
  );
}
