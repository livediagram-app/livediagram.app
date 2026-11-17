'use client';

// A Gantt Chart's dependency clashes (docs/specs/026-plan/plan-views.md "Dependency clashes", "Moving the cards that
// follow"): the amber mark on a blocked card's mark that starts before an open blocker is due, named in its tooltip,
// and, after a date drag or draw leaves cards that follow clashing, the offer to move them, as one change.
import { useCallback } from 'react';
import {
  blockingIndexOf,
  clashText,
  donePhase,
  followingShifts,
  ganttClashDays,
  itemTitle,
  phaseOf,
  type FollowingShift,
  type GanttArrow,
  type GanttRow,
  type Item,
  type ItemPatch,
  type ViewDates,
} from '@liveplanner/items';
import { Tooltip } from '@liveplanner/ui';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useToast } from '@/hooks/ui/useToast';
import { track } from '@/lib/telemetry';
import type { PlanContextValue } from '../PlanContext';
import { CLASH_AMBER } from './view-frame';

// Each blocked row's clashes with its open blockers, as drawn (a dragged mark's preview applied), worst first: what
// its clash mark says.
export function ganttClashTexts(
  arrows: readonly GanttArrow[],
  shownOf: (row: GanttRow) => GanttRow,
): Map<string, string[]> {
  const found = new Map<string, { days: number; text: string }[]>();
  for (const a of arrows) {
    const days = ganttClashDays({ ...shownOf(a.from.row), isDone: a.done }, shownOf(a.to.row));
    if (days === null) continue;
    const id = a.to.row.item.id;
    const list = found.get(id) ?? [];
    list.push({ days, text: clashText(days, a.from.row.item) });
    found.set(id, list);
  }
  const out = new Map<string, string[]>();
  for (const [id, list] of found)
    out.set(
      id,
      list.sort((x, y) => y.days - x.days).map((c) => c.text),
    );
  return out;
}

// The amber mark at the left end of a clashing card's mark (`at`, a percentage along the timeline), named by its
// clashes.
export function GanttClashMark({ texts, at }: { texts: readonly string[]; at: number }) {
  const label = texts.join('; ');
  return (
    <Tooltip label={label}>
      <span
        role="img"
        aria-label={label}
        data-gantt-clash=""
        className="absolute top-0.5 z-10 flex h-3 w-3 -translate-x-1/2 items-center justify-center rounded-full text-[9px] font-bold leading-none text-white shadow-sm ring-1 ring-white dark:ring-slate-900"
        style={{ left: `${at}%`, backgroundColor: CLASH_AMBER }}
      >
        !
      </span>
    </Tooltip>
  );
}

// The card with a patch's fields applied (a date drag's write, before the store has it back).
function patched(item: Item, patch: ItemPatch | undefined): Item {
  if (!patch) return item;
  const fields = { ...item.fields, ...patch.set };
  for (const k of patch.clear ?? []) delete fields[k];
  return { ...item, fields };
}

// The cards that follow `itemId` that its dates (with `patch` applied) leave clashing, shifted just enough.
export function shiftsAfter(
  plan: Pick<PlanContextValue, 'items' | 'types' | 'statusPhases'>,
  itemId: string,
  patch: ItemPatch | undefined,
  dates: ViewDates,
): { moved: Item; shifts: FollowingShift[] } | null {
  const was = plan.items.get(itemId);
  if (!was) return null;
  const moved = patched(was, patch);
  const items = new Map(plan.items);
  items.set(itemId, moved);
  const index = blockingIndexOf(items.values(), plan.types, donePhase(plan.statusPhases));
  const isDone = (i: Item) => phaseOf(i, plan.statusPhases) === 'done';
  return { moved, shifts: followingShifts(index, isDone, [itemId], { dates }) };
}

const cards = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`;

// After a date drag or draw: when cards that follow now clash, offer to move them. Pressed, the shifts are worked
// out again from the plan as it is then and sent as one change (one undo step).
export function useGanttMoveFollowing(
  plan: PlanContextValue | undefined,
  dates: ViewDates,
): (itemId: string, patch: ItemPatch) => void {
  const toast = useToast();
  const latest = useLatest(plan);
  const latestDates = useLatest(dates);
  return useCallback(
    (itemId, patch) => {
      const p = latest.current;
      if (!p?.patchItems || !p.canEditCards) return;
      const found = shiftsAfter(p, itemId, patch, latestDates.current);
      if (!found?.shifts.length) return;
      const n = found.shifts.length;
      const name = `#${found.moved.key} ${itemTitle(found.moved).trim() || 'Untitled'}`;
      toast.offer({
        message:
          n === 1
            ? `1 card that follows ${name} now starts before it is due.`
            : `${n} cards that follow ${name} now start before it is due.`,
        confirmLabel: `Move ${n === 1 ? '1 Card' : `${n} Cards`}`,
        declineLabel: 'Leave Them',
        onConfirm: () => {
          const q = latest.current;
          if (!q?.patchItems) return;
          const now = shiftsAfter(q, itemId, undefined, latestDates.current);
          if (!now?.shifts.length) return;
          q.patchItems(now.shifts.map((s) => ({ id: s.item.id, patch: { set: s.set } })));
          q.announce(`Moved ${cards(now.shifts.length)} that follow ${name}`);
          track('Plan', 'Changed', 'GanttMoveFollowing');
        },
        onDecline: () => {},
      });
    },
    [latest, latestDates, toast],
  );
}
