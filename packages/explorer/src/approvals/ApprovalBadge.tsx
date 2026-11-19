'use client';

// The approval's badge (approvals.md "In the editor"), first in the editor's corner card (`corner`, EditorCornerActions)
// or as a pill after the visibility pill where a header bar has pills: Awaiting n of m
// (amber, a clock), Changes Requested (rose, a flag), Approved (green, a checked page), Changed Since Approval (amber
// outline, a pencil). Its hover card names the requester, the due day (and Overdue) and who has and hasn't answered.
// For an Editor of the whole item it opens the Share dialog on its Approval tab; for anyone else it is focusable
// words. No approval, or a cancelled one, draws nothing.

import { HoverCard } from '@liveworkspace/ui';
import { ApprovalGlyph, STATUS_GLYPH } from './glyphs';
import { badgeSummary, statusWords, type StatusTone } from './approval-words';
import { useApprovalDoor } from './door';

// The visibility pill's shape (19px, 10px semibold, a ring), so the two read as one row.
const PILL =
  'inline-flex h-[19px] items-center gap-1 rounded-full px-2 text-[10px] font-semibold ring-1 whitespace-nowrap';
export const BADGE_TONE: Record<StatusTone, string> = {
  awaiting:
    'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30',
  changes:
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
  approved:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  changed:
    'bg-transparent text-amber-800 ring-amber-400 dark:text-amber-200 dark:ring-amber-400/60',
};
// The corner card's buttons' shape (EditorCornerActions' CORNER_BTN): 36px tall, its glyph beside its words, the
// glyph alone on a phone and wherever the card drops its names (`data-compact`). Tinted and ringed in its tone, so it
// reads as where the item stands rather than one more action.
const CORNER =
  'flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg px-2.5 phone:px-0 [[data-compact]_&]:px-0 text-xs font-medium ring-1 ring-inset whitespace-nowrap';
const CORNER_WORDS = 'phone:sr-only [[data-compact]_&]:sr-only';
const HOVER: Record<StatusTone, string> = {
  awaiting: 'hover:ring-amber-400 dark:hover:ring-amber-400/60',
  changes: 'hover:ring-rose-400 dark:hover:ring-rose-400/60',
  approved: 'hover:ring-emerald-400 dark:hover:ring-emerald-400/60',
  changed: 'hover:bg-amber-50 dark:hover:bg-amber-500/10',
};

/** The status pill on its own, for the header and the Share dialog's Approval tab. */
export function ApprovalPill({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span className={`${PILL} ${BADGE_TONE[tone]}`} data-approval-status={tone}>
      <ApprovalGlyph d={STATUS_GLYPH[tone]} size={11} />
      <span className="text-optical-line text-optical-caps">{label}</span>
    </span>
  );
}

export function ApprovalBadge({ corner = false }: { corner?: boolean }) {
  const ctx = useApprovalDoor();
  const words = statusWords(ctx?.approval ?? null);
  if (!ctx?.approval || !words) return null;
  const summary = badgeSummary(ctx.approval);
  const open = ctx.openApprovalTab;
  const shape = corner ? CORNER : PILL;
  const glyph = <ApprovalGlyph d={STATUS_GLYPH[words.tone]} size={corner ? 14 : 11} />;
  const label = (
    <span className={corner ? CORNER_WORDS : 'text-optical-line text-optical-caps'}>
      {words.label}
    </span>
  );
  return (
    <HoverCard title={words.label} description={summary}>
      {open ? (
        <button
          type="button"
          onClick={open}
          aria-label={`${words.label}. Open the approval`}
          data-approval-status={words.tone}
          className={`${shape} ${BADGE_TONE[words.tone]} ${HOVER[words.tone]} relative cursor-pointer transition ${corner ? '' : 'touch-target-y '}focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400`}
        >
          {glyph}
          {label}
        </button>
      ) : (
        <span
          tabIndex={0}
          data-approval-status={words.tone}
          className={`${shape} ${BADGE_TONE[words.tone]} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400`}
        >
          {glyph}
          {label}
        </span>
      )}
    </HoverCard>
  );
}
