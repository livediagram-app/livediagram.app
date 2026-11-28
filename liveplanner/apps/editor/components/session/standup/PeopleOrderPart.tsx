'use client';

// Set Up Stand-up's People Order (docs/specs/026-plan/session-tabs.md "Stand-up", "Making one"): Board Order (the
// default), Alphabetical or Shuffled Daily, as chips, with a line saying what the picked one means. Unassigned always
// speaks last.
import type { SessionSetup } from '@liveplanner/project';
import { ChoicePills } from '@/components/primitives/ChoicePills';

const HEADING = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

const ORDERS = [
  {
    id: 'board',
    label: 'Board Order',
    line: 'In the order their first card sits on the board.',
  },
  { id: 'alphabetical', label: 'Alphabetical', line: 'By name, the same every day.' },
  {
    id: 'shuffled',
    label: 'Shuffled Daily',
    line: 'A fresh order each day, the same on every screen.',
  },
] as const;

// The set-up with `order` picked: Board Order is the default, kept as no value.
export function withPersonOrder(s: SessionSetup, order: string): SessionSetup {
  const { personOrder: _was, ...rest } = s;
  return order === 'alphabetical' || order === 'shuffled' ? { ...rest, personOrder: order } : rest;
}

export function PeopleOrderPart({
  id,
  setup,
  onChange,
}: {
  // The dialog's id, the heading's id built from it.
  id: string;
  setup: SessionSetup;
  onChange: (change: (s: SessionSetup) => SessionSetup) => void;
}) {
  const picked = setup.personOrder ?? 'board';
  const line = ORDERS.find((o) => o.id === picked)!.line;
  return (
    <section className="flex flex-col gap-2" aria-labelledby={`${id}-people`}>
      <h3 id={`${id}-people`} className={HEADING}>
        People Order
      </h3>
      <ChoicePills
        label="People order"
        data="session-people-order"
        pills={ORDERS.map(({ id: o, label }) => ({ id: o, label }))}
        pressed={(o) => o === picked}
        onPick={(o) => onChange((s) => withPersonOrder(s, o))}
      />
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        {line} Cards with no assignee come last.
      </p>
    </section>
  );
}
