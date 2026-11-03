// The people on the plan (docs/specs/026-plan/plan-overview.md "Header"): its owner, everyone who made or last changed
// one of its cards, and anyone here now. Pure. Ids differ between the places a person shows up (an owner's account,
// a card's hashed person, a room participant), so one person is told apart by id, else by name and colour together.
import type { Item } from '@liveplanner/items';

export const PEOPLE_SHOWN = 5;

export type PlanPerson = { id: string; name: string; color: string };

// A template's example people are no one.
const isExample = (id: string) => id.startsWith('example-');

export function planPeopleOf(input: {
  owner: PlanPerson | null;
  items: Iterable<Item>;
  present: Iterable<PlanPerson>;
}): PlanPerson[] {
  const latest = new Map<string, { person: PlanPerson; at: number }>();
  const note = (p: PlanPerson, at: number) => {
    if (!p.name || isExample(p.id)) return;
    const seen = latest.get(p.id);
    if (!seen || seen.at < at) latest.set(p.id, { person: p, at });
  };
  for (const it of input.items) {
    note(it.createdBy, it.createdAt);
    note(it.updatedBy, it.updatedAt);
  }
  // Here now: newer than any card change.
  for (const p of input.present) note(p, Number.MAX_SAFE_INTEGER);
  const ranked = [...latest.values()].sort((a, b) => b.at - a.at).map((e) => e.person);
  const out: PlanPerson[] = [];
  const names = new Set<string>();
  const add = (p: PlanPerson) => {
    const nameKey = `${p.name}|${p.color.toLowerCase()}`;
    if (out.some((o) => o.id === p.id) || names.has(nameKey)) return;
    names.add(nameKey);
    out.push(p);
  };
  if (input.owner?.name) add(input.owner);
  for (const p of ranked) add(p);
  return out;
}
