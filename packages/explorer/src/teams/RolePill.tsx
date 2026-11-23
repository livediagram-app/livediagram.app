// A member's role as a pill (Admin in the brand hue, Member quiet), and the pill's shape for the row's other marks
// ("you", Invited). Shared by the team card's rows and the Share dialog's Team Members list.

import type { TeamRole } from '../data/teams';

export const PILL = 'shrink-0 rounded-full px-1.5 text-[10px] font-medium ring-1';
export const PILL_QUIET =
  'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600';

export function RolePill({ role }: { role: TeamRole }) {
  return (
    <span
      className={`inline-flex w-fit items-center py-0.5 ${PILL} ${
        role === 'admin'
          ? 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30'
          : PILL_QUIET
      }`}
    >
      {role === 'admin' ? 'Admin' : 'Member'}
    </span>
  );
}
