'use client';

// The card writes every session kind shares (docs/specs/026-plan/session-tabs.md "The action bar", "History"): an
// outcome (or its undo) kept in the card's history, and an undo's writes on the real card: the move back to where the
// outcome found it (while it is still where the outcome put it), the flag off when the outcome set it, a duplicate link
// it made taken out. Used by every kind's run (useSessionRun, Stand-up's useStandupRun).
import { beforeRank, isFlagged, itemStatus, type SessionOutcome } from '@liveplanner/items';
import type { SessionDecision, SessionTabState } from '@liveplanner/project';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { recordSessionOutcome } from '@/lib/api/item-history';
import { duplicateUnlink } from './triage/triage-duplicate';

export type OutcomeExtra = { reason?: string; duplicateOf?: string; undone?: true };

// The card's history keeps the outcome (or its undo); a failure is logged, never in the way of the session.
export function recordOutcome(
  plan: Pick<PlanContextValue, 'itemsScope'>,
  sessionKind: SessionTabState['sessionKind'],
  itemId: string,
  outcome: SessionOutcome,
  extra: OutcomeExtra = {},
): void {
  if (!plan.itemsScope) return;
  recordSessionOutcome(plan.itemsScope, itemId, { session: sessionKind, outcome, ...extra }).catch(
    (error: unknown) => debugLog('[session] outcome.failed', { outcome, error: String(error) }),
  );
}

// An undone decision's writes on the card (when it is still on the plan), its undo kept in its history.
export function undoDecision(
  plan: Pick<PlanContextValue, 'items' | 'types' | 'moveItem' | 'patchItem' | 'itemsScope'>,
  sessionKind: SessionTabState['sessionKind'],
  itemId: string,
  d: SessionDecision,
  // Keep the undo in the card's history (a step that recorded nothing, such as a Stage move on a card decided
  // already, records no undo).
  record = true,
): void {
  const { items, types } = plan;
  const item = items.get(itemId);
  if (!item) return;
  if (d.from && d.to && itemStatus(item) === d.to)
    // Back in its own place: in front of the card now ranked after where it was, else the column's end.
    plan.moveItem(itemId, {
      status: d.from,
      before: d.fromRank ? beforeRank(items.values(), d.from, d.fromRank, itemId) : null,
    });
  if (d.flagSet && isFlagged(item)) void plan.patchItem(itemId, { clear: ['flagged'] });
  const unlink =
    d.linked && d.duplicateOf ? duplicateUnlink(item, d.linked, d.duplicateOf, types) : null;
  if (unlink) void plan.patchItem(itemId, unlink);
  if (record) recordOutcome(plan, sessionKind, itemId, d.outcome, { undone: true });
}
