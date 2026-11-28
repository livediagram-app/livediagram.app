// Set Up Refinement's rules (docs/specs/026-plan/session-tabs.md "Making one"): which card types and stages it picks
// first, the stages the picked types offer with how many cards each holds, and the set-up in words. Pure.
import {
  REVIEW_RANGE_DEFAULT_DAYS,
  DAY_MS,
  boardSortText,
  isArchived,
  isTrashed,
  itemStatus,
  typeStatusesOf,
  type Item,
  type ItemTypeDef,
  type StatusPhase,
} from '@liveplanner/items';
import { SESSION_KINDS } from '@liveplanner/project';
import type { SessionKindId } from '@liveplanner/items';
import type { SessionSetup } from '@liveplanner/project';
import { SESSION_KIND_LOOKS } from './session-kinds';

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

// How many live cards of the picked types each stage holds now (archived ones too for a kind that reads them).
export function stageCounts(
  items: Iterable<Item>,
  typeIds: readonly string[],
  archived = false,
): Map<string, number> {
  const picked = new Set(typeIds);
  const out = new Map<string, number>();
  for (const i of items) {
    if (isTrashed(i) || (!archived && isArchived(i)) || !picked.has(i.type)) continue;
    const s = itemStatus(i) ?? '';
    out.set(s, (out.get(s) ?? 0) + 1);
  }
  return out;
}

// What a set-up starts on: the types with cards in a stage the kind starts from (Refinement's Backlog-like stages,
// Sprint Planning's Reviewed-like ones, Bug Triage's intake ones; else every type with cards, else the first type),
// narrowed to the kind's preferred types when any of them is among those (Bug Triage's bug-like ones), and those
// types' stages the kind starts from (else each one's first stage), in the kind's starting order (Bug Triage's oldest
// first).
export function defaultSessionSetup(input: {
  sessionKind: SessionKindId;
  items: Iterable<Item>;
  types: readonly ItemTypeDef[];
  planStatuses: readonly string[];
  statusNames: ReadonlyMap<string, string>;
  // The plan's stage phases (Sprint Review starts from a Done-phase stage, Stand-up a Doing one), the newest decision of another
  // review session (its Since Last Review) and the time now.
  statusPhases?: ReadonlyMap<string, StatusPhase> | undefined;
  lastReviewAt?: number | null | undefined;
  now?: number | undefined;
}): SessionSetup {
  const { types, planStatuses, statusNames } = input;
  const look = SESSION_KIND_LOOKS[input.sessionKind];
  const starts = look.startStages;
  const isStartStage = (s: string) => {
    const name = (statusNames.get(s) ?? s).trim().toLowerCase();
    return (
      starts.includes(name) ||
      (!!look.startPhase &&
        input.statusPhases?.get(s) === look.startPhase &&
        !look.notStartStages?.includes(name))
    );
  };
  // A finished-work kind reads archived cards too.
  const archived = !!SESSION_KINDS[input.sessionKind].archived;
  const items = [...input.items].filter((i) => !isTrashed(i) && (archived || !isArchived(i)));
  const refining = types.filter((t) =>
    items.some((i) => i.type === t.id && isStartStage(itemStatus(i) ?? '')),
  );
  const withCards = types.filter((t) => items.some((i) => i.type === t.id));
  const pool = refining.length ? refining : withCards.length ? withCards : types.slice(0, 1);
  const preferred = pool.filter(
    (t) =>
      !!look.startTypes &&
      (look.startTypes.includes(t.label.trim().toLowerCase()) ||
        (!!t.glyph && look.startTypes.includes(t.glyph))),
  );
  const picked = (preferred.length ? preferred : pool).map((t) => t.id);
  const stages = stagesFor(picked, types, planStatuses);
  const firsts = picked.flatMap((id) => {
    const t = types.find((x) => x.id === id)!;
    return typeStatusesOf(t, planStatuses).slice(0, 1);
  });
  const statuses = stages.filter(isStartStage);
  // Since the last review when there was one, else the last REVIEW_RANGE_DEFAULT_DAYS days.
  const now = input.now ?? Date.now();
  const since = archived
    ? (input.lastReviewAt ?? now - REVIEW_RANGE_DEFAULT_DAYS * DAY_MS)
    : undefined;
  return {
    typeIds: picked,
    statuses: statuses.length ? statuses : [...new Set(firsts)],
    ...(look.startSort ? { sortBy: look.startSort.map((l) => ({ ...l })) } : {}),
    ...(since !== undefined ? { since } : {}),
  };
}

// Stand-up's people order in words; Board Order, the default, goes unsaid.
const PERSON_ORDER_WORDS = { alphabetical: 'Alphabetical', shuffled: 'Shuffled daily' } as const;

// The set-up in words, for the sidebar's header: its stages, then its order (a Stand-up's people order).
export function setupWords(
  setup: SessionSetup,
  types: readonly ItemTypeDef[],
  statusNames: ReadonlyMap<string, string>,
): string {
  const stages = setup.statuses.map((s) => statusNames.get(s) ?? s).join(', ');
  const range = rangeWords(setup);
  const order = setup.personOrder
    ? [PERSON_ORDER_WORDS[setup.personOrder]]
    : boardSortText(setup.sortBy, types);
  const head = range ? `${stages} · ${range}` : stages;
  return order.length ? `${head} · ${order.join(', then ')}` : head;
}

const day = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// A done range in words ("since 14 Nov", "14 Nov to 21 Nov", "until 21 Nov"), or '' with none.
export function rangeWords(setup: Pick<SessionSetup, 'since' | 'until'>): string {
  const { since, until } = setup;
  if (since !== undefined && until !== undefined) return `${day(since)} to ${day(until)}`;
  if (since !== undefined) return `since ${day(since)}`;
  return until !== undefined ? `until ${day(until)}` : '';
}

// A count of cards, as the preview says it.
export const cardsWord = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`;
