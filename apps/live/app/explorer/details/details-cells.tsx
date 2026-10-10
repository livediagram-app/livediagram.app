'use client';

import type { AccessLevel, DocumentStats } from '@livediagram/api-schema';
import { editorModeLabel } from '@livediagram/document';
import { EDITOR_MODE_ICONS, Tooltip } from '@livediagram/ui';
import { ROLE_PASS } from '@/components/dialogs/share-dialog-parts';
import type { DetailsColumn } from './details-columns';
import { formatDateTime } from './details-format';

// The Details view's cells (docs/specs/013-workspace/explorer-details-view.md "Columns").

// Hides a column below the width that shows it ("Narrow screens"). Literal class strings, so
// Tailwind generates them.
export const SHOWN_FROM_CLASS: Record<DetailsColumn['shownFrom'], string> = {
  always: '',
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
};

export const CELL_CLASS = 'px-3 py-2 align-middle';

// A cell with no value: a dash, named for assistive technology and in a tooltip.
export function NoValue({ label }: { label: string }) {
  return (
    <Tooltip label={label}>
      <span className="text-slate-500 dark:text-slate-400">
        <span aria-hidden>–</span>
        <span className="sr-only">{label}</span>
      </span>
    </Tooltip>
  );
}

export const NOT_COUNTED = 'Not counted yet';

export function TypeCell({ stats }: { stats: DocumentStats | null | undefined }) {
  if (!stats) return <NoValue label={NOT_COUNTED} />;
  const Icon = EDITOR_MODE_ICONS[stats.mode];
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
      <Icon aria-hidden size={14} className="shrink-0 text-slate-400" />
      <span className="truncate">{editorModeLabel(stats.mode)}</span>
    </span>
  );
}

// The reader's level as the Share dialog's role icon, named in a tooltip and for assistive technology.
export function AccessCell({ level }: { level: AccessLevel }) {
  const pass = ROLE_PASS[level];
  const { Icon } = pass;
  return (
    <Tooltip label={pass.title}>
      <span className={`inline-flex items-center ${pass.text}`}>
        <Icon />
        <span className="sr-only">{pass.title}</span>
      </span>
    </Tooltip>
  );
}

export function DateCell({ at }: { at: number | undefined }) {
  if (at === undefined) return <NoValue label="Not known" />;
  return (
    <span className="whitespace-nowrap text-xs tabular-nums text-slate-600 dark:text-slate-300">
      {formatDateTime(at)}
    </span>
  );
}
