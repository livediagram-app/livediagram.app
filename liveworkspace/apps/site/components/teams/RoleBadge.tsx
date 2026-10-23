import type { TeamRole } from '@/lib/account-api';
import { roleLabel } from '@/lib/teams';

// A role in a pill: admins in the darker slate, members quieter. `invited` marks an invitation still
// waiting.
export function RoleBadge({ role, invited = false }: { role?: TeamRole; invited?: boolean }) {
  const tone = invited
    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
    : role === 'admin'
      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-semibold ${tone}`}
    >
      <span className="text-optical-centre">
        {invited ? 'Invited' : roleLabel(role ?? 'member')}
      </span>
    </span>
  );
}
