'use client';

import { PRIORITY_LABELS, isPriority, type Item } from '@liveplanner/items';
import { PRIORITY_COLOURS } from '@liveplanner/project';

// A queue row's priority (docs/specs/026-plan/session-tabs.md "Bug Triage"): its name in a pill of its colour, or a
// dashed "?" for none, so an unprioritised bug shows before it is accepted.
export function PriorityPill({ item }: { item: Item }) {
  const p = item.fields['priority'];
  if (!isPriority(p))
    return (
      <span
        className="shrink-0 rounded-full border border-dashed border-amber-400 px-1.5 text-[11px] font-medium text-amber-700 dark:border-amber-500 dark:text-amber-400"
        data-priority-pill="none"
      >
        <span className="text-optical-centre">
          <span aria-hidden>?</span>
          <span className="sr-only">No priority</span>
        </span>
      </span>
    );
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      data-priority-pill={p}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ backgroundColor: PRIORITY_COLOURS[p] }}
      />
      <span className="text-optical-centre">{PRIORITY_LABELS[p]}</span>
    </span>
  );
}
