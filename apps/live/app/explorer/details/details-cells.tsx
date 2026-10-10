'use client';

import type { AccessLevel, DocumentStats } from '@livediagram/api-schema';
import { editorModeLabel } from '@livediagram/document';
import { lucideKey, lucideMessageSquare, lucideShapes } from '@livediagram/icons/lucide';
import { EDITOR_MODE_ICONS, Tooltip, lucideGlyph } from '@livediagram/ui';
import { ROLE_PASS } from '@/components/dialogs/share-dialog-parts';
import { FolderSolidIcon } from '@/components/primitives/explorer-icons';
import { isPowerUserMode } from '@/lib/power-user-mode';
import { useOptionalExplorer } from '../ExplorerContext';
import type { DetailsColumn, DetailsColumnId } from './details-columns';
import { formatDateTime } from './details-format';

// The Details view's cells (docs/specs/013-workspace/explorer-details-view.md "Columns").

// Hides a column below the width that shows it ("Narrow screens"). Literal class strings, so
// Tailwind generates them.
export const SHOWN_FROM_CLASS: Record<DetailsColumn['shownFrom'], string> = {
  always: '',
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
};

// Rows at half height in power user mode ("Dense rows"): no vertical padding.
export function useDenseRows(): boolean {
  const explorer = useOptionalExplorer();
  return explorer ? isPowerUserMode(explorer.prefs) : false;
}

export function cellClass(dense: boolean): string {
  // Dense cells also drop the default line height, which would leave room under each icon.
  return dense ? 'px-3 py-0 align-middle leading-none' : 'px-3 py-2 align-middle';
}

// The icon columns' header icons, drawn in place of a title.
const TypeHeaderIcon = lucideGlyph(lucideShapes, 13);
const CommentsHeaderIcon = lucideGlyph(lucideMessageSquare, 13);
const AccessHeaderIcon = lucideGlyph(lucideKey, 13);
export const HEADER_ICON: Partial<Record<DetailsColumnId, () => React.JSX.Element>> = {
  type: () => <TypeHeaderIcon aria-hidden />,
  comments: () => <CommentsHeaderIcon aria-hidden />,
  access: () => <AccessHeaderIcon aria-hidden />,
};

// An icon with no words: named in a tooltip and, visually hidden, for assistive technology.
function NamedIcon({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip label={label}>
      <span className="inline-flex items-center justify-center align-middle">
        {children}
        <span className="sr-only">{label}</span>
      </span>
    </Tooltip>
  );
}

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
    <NamedIcon label={editorModeLabel(stats.mode)}>
      <Icon aria-hidden size={14} className="text-slate-500 dark:text-slate-400" />
    </NamedIcon>
  );
}

export function FolderTypeCell() {
  return (
    <NamedIcon label="Folder">
      <span aria-hidden className="text-amber-500">
        <FolderSolidIcon />
      </span>
    </NamedIcon>
  );
}

// Above this the bubble reads "99+".
const COMMENTS_SHOWN_MAX = 99;

// A speech bubble holding the count; nothing for none (D151).
export function CommentsCell({
  stats,
  dense = false,
}: {
  stats: DocumentStats | null | undefined;
  dense?: boolean;
}) {
  if (!stats) return <NoValue label={NOT_COUNTED} />;
  const n = stats.comments;
  if (n === 0) return null;
  const label = `${n} ${n === 1 ? 'comment' : 'comments'}`;
  return (
    <NamedIcon label={label}>
      <span className="relative inline-flex text-slate-500 dark:text-slate-400">
        <CommentsHeaderIcon aria-hidden size={dense ? 20 : 24} />
        {/* Centred in the bubble's body: the box, less the tail at its foot. */}
        <span
          aria-hidden="true"
          className={`absolute inset-0 flex items-center justify-center ${dense ? 'pb-[3px] text-[8px]' : 'pb-1 text-[9px]'} font-semibold leading-none tabular-nums text-slate-700 dark:text-slate-200`}
        >
          {n > COMMENTS_SHOWN_MAX ? `${COMMENTS_SHOWN_MAX}+` : n}
        </span>
      </span>
    </NamedIcon>
  );
}

// The reader's level as the Share dialog's role icon, small and muted: a quiet fact on most rows.
export function AccessCell({ level }: { level: AccessLevel }) {
  const { Icon, title } = ROLE_PASS[level];
  return (
    <NamedIcon label={title}>
      <span aria-hidden className="inline-flex text-slate-500 dark:text-slate-400">
        <Icon size={12} />
      </span>
    </NamedIcon>
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
