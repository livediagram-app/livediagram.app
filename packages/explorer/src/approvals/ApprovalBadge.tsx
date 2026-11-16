'use client';

// The approval's pill in the editor's header, after the role pill (approvals.md "In the editor"): Awaiting n of m
// (amber, a clock), Changes Requested (rose, a flag), Approved (green, a checked page), Changed Since Approval (amber
// outline, a pencil). Its hover card names the requester, the due day (and Overdue) and who has and hasn't answered.
// For an Editor of the whole item it opens the Share dialog on its Approval tab; for anyone else it is focusable
// words. No approval, or a cancelled one, draws nothing.

import { HoverCard } from '@liveworkspace/ui';
import { DOCUMENT_CHECK, FLAG } from '../library/event-icons';
import { Glyph } from '../ui/icons';
import { badgeSummary, statusWords, type StatusTone } from './approval-words';
import { useApprovalDoor } from './door';

const CLOCK = 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z';
const PENCIL =
  'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z';

const GLYPH: Record<StatusTone, string> = {
  awaiting: CLOCK,
  changes: FLAG,
  approved: DOCUMENT_CHECK,
  changed: PENCIL,
};

// The role pill's shape (19px, 10px semibold, a ring), so the two read as one row.
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
      <Glyph size={11} units={24}>
        <path d={GLYPH[tone]} />
      </Glyph>
      <span className="text-optical-line text-optical-caps">{label}</span>
    </span>
  );
}

export function ApprovalBadge() {
  const ctx = useApprovalDoor();
  const words = statusWords(ctx?.approval ?? null);
  if (!ctx?.approval || !words) return null;
  const summary = badgeSummary(ctx.approval);
  const open = ctx.openApprovalTab;
  const glyph = (
    <Glyph size={11} units={24}>
      <path d={GLYPH[words.tone]} />
    </Glyph>
  );
  return (
    <HoverCard title={words.label} description={summary}>
      {open ? (
        <button
          type="button"
          onClick={open}
          aria-label={`${words.label}. Open the approval`}
          data-approval-status={words.tone}
          className={`${PILL} ${BADGE_TONE[words.tone]} ${HOVER[words.tone]} relative cursor-pointer transition touch-target-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400`}
        >
          {glyph}
          <span className="text-optical-line text-optical-caps">{words.label}</span>
        </button>
      ) : (
        <span
          tabIndex={0}
          data-approval-status={words.tone}
          className={`${PILL} ${BADGE_TONE[words.tone]} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400`}
        >
          {glyph}
          <span className="text-optical-line text-optical-caps">{words.label}</span>
        </span>
      )}
    </HoverCard>
  );
}
