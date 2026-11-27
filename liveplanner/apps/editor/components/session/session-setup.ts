// Set Up Refinement's rules (docs/specs/026-plan/session-tabs.md "Making one"): which card types and stages it picks
// first, the stages the picked types offer with how many cards each holds, and the set-up in words. Pure.
import {
  boardSortText,
  isArchived,
  isTrashed,
  itemStatus,
  typeStatusesOf,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import type { SessionKindId } from '@liveplanner/items';
import type { SessionSetup } from '@liveplanner/project';
import { SESSION_KIND_LOOKS } from './session-kinds';

const live = (i: Item) => !isArchived(i) && !isTrashed(i);

// The stages the picked types use, once each, in the plan's column order (a type's own order where it keeps one).
export function stagesFor(
  typeIds: readonly string[],
  types: readonly ItemTypeDef[],
  planStatuses: readonly string[],
): string[] {
  const used = new Set<string>();
  for (const id of typeIds) {
    const type = types.find((t) => t.id === id);
    if (type) for (const s of typeStatusesOf(type, planStatuses)) used.add(s);
  }
  const inPlan = planStatuses.filter((s) => used.has(s));
  return [...inPlan, ...[...used].filter((s) => !inPlan.includes(s))];
}

// How many live cards of the picked types each stage holds now.
export function stageCounts(
  items: Iterable<Item>,
  typeIds: readonly string[],
): Map<string, number> {
  const picked = new Set(typeIds);
  const out = new Map<string, number>();
  for (const i of items) {
    if (!live(i) || !picked.has(i.type)) continue;
    const s = itemStatus(i) ?? '';
    out.set(s, (out.get(s) ?? 0) + 1);
  }
  return out;
}

// What a set-up starts on: the types with cards in a stage the kind starts from (Refinement's Backlog-like stages,
// Sprint Planning's Reviewed-like ones; else every type with cards, else the first type), and those types' stages
// the kind starts from (else each one's first stage).
export function defaultSessionSetup(input: {
  sessionKind: SessionKindId;
  items: Iterable<Item>;
  types: readonly ItemTypeDef[];
  planStatuses: readonly string[];
  statusNames: ReadonlyMap<string, string>;
}): SessionSetup {
  const { types, planStatuses, statusNames } = input;
  const starts = SESSION_KIND_LOOKS[input.sessionKind].startStages;
  const isStartLike = (name: string | undefined) =>
    !!name && starts.includes(name.trim().toLowerCase());
  const items = [...input.items].filter(live);
  const nameOf = (s: string) => statusNames.get(s) ?? s;
  const refining = types.filter((t) =>
    items.some((i) => i.type === t.id && isStartLike(nameOf(itemStatus(i) ?? ''))),
  );
  const withCards = types.filter((t) => items.some((i) => i.type === t.id));
  const picked = (
    refining.length ? refining : withCards.length ? withCards : types.slice(0, 1)
  ).map((t) => t.id);
  const stages = stagesFor(picked, types, planStatuses);
  const firsts = picked.flatMap((id) => {
    const t = types.find((x) => x.id === id)!;
    return typeStatusesOf(t, planStatuses).slice(0, 1);
  });
  const statuses = stages.filter((s) => isStartLike(nameOf(s)));
  return { typeIds: picked, statuses: statuses.length ? statuses : [...new Set(firsts)] };
}

// The set-up in words, for the sidebar's header: its stages, then its order.
export function setupWords(
  setup: SessionSetup,
  types: readonly ItemTypeDef[],
  statusNames: ReadonlyMap<string, string>,
): string {
  const stages = setup.statuses.map((s) => statusNames.get(s) ?? s).join(', ');
  const order = boardSortText(setup.sortBy, types);
  return order.length ? `${stages} · ${order.join(', then ')}` : stages;
}

// A count of cards, as the preview says it.
export const cardsWord = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`;
