// A Stand-up session's rules (docs/specs/026-plan/session-tabs.md "Stand-up", blueprint session-tabs.md "Behaviour and
// state"): the stages it starts from, the cards in board order, and the cards grouped into people (by Assignee,
// Unassigned last) in the set-up's people order. Pure: the caller passes the seed for Shuffled Daily.
import { byRank } from './apply';
import { itemAssignee, itemStatus, type Item, type ItemPerson } from './item';

// The person key of the cards with no Assignee: never a person id (24 hex, `n-`, `ai-`).
export const UNASSIGNED_KEY = 'unassigned';

// Stage names (lower case) a stand-up starts from, beside any stage in the Doing phase.
export const STANDUP_INFLIGHT_STAGES: readonly string[] = [
  'in progress',
  'doing',
  'started',
  'in development',
  'in dev',
  'development',
  'in review',
  'review',
  'code review',
  'testing',
  'in testing',
  'qa',
  'blocked',
];

// How a stand-up orders its people: Board Order (absent), Alphabetical or Shuffled Daily.
export const STANDUP_PERSON_ORDERS = ['alphabetical', 'shuffled'] as const;
export type StandupPersonOrder = (typeof STANDUP_PERSON_ORDERS)[number];
export const isStandupPersonOrder = (v: unknown): v is StandupPersonOrder =>
  (STANDUP_PERSON_ORDERS as readonly unknown[]).includes(v);

// One person in a stand-up: their key, who they are (null: Unassigned) and their cards in order.
export type StandupPerson = { key: string; person: ItemPerson | null; cards: Item[] };

// The person a card sits under: its Assignee's id, else Unassigned.
export const personKeyOf = (item: Pick<Item, 'fields'>): string =>
  itemAssignee(item)?.id ?? UNASSIGNED_KEY;

// The cards as the board reads them: by their stage's place in the plan's column order (a stage the plan does not
// list after those it does), then each column's hand order.
export function boardOrder(cards: readonly Item[], planStatuses: readonly string[]): Item[] {
  const at = new Map(planStatuses.map((s, i) => [s, i]));
  const place = (i: Item) => at.get(itemStatus(i) ?? '') ?? planStatuses.length;
  return [...cards].sort((a, b) => place(a) - place(b) || byRank(a, b));
}

// Shuffled Daily's seed: the tab and the day in UTC, so every screen agrees all day and the order changes tomorrow.
export const standupSeed = (tabId: string, now: number): string =>
  `${tabId}:${new Date(now).toISOString().slice(0, 10)}`;

// A person's place in a shuffle: an FNV-1a hash of the seed and their key.
export function seededRank(seed: string, key: string): number {
  let h = 0x811c9dc5;
  const text = `${seed}\u0000${key}`;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// The cards grouped into people, each person's cards in the order given (the caller's board order, held). People in
// Board Order (where their first card sits), by name, or shuffled by `seed`; Unassigned last in every order.
export function standupPeople(
  cards: readonly Item[],
  opts: { order?: StandupPersonOrder | undefined; seed?: string } = {},
): StandupPerson[] {
  const byKey = new Map<string, StandupPerson>();
  for (const card of cards) {
    const key = personKeyOf(card);
    const had = byKey.get(key);
    if (had) had.cards.push(card);
    else byKey.set(key, { key, person: itemAssignee(card) ?? null, cards: [card] });
  }
  const unassigned = byKey.get(UNASSIGNED_KEY);
  byKey.delete(UNASSIGNED_KEY);
  const people = [...byKey.values()];
  if (opts.order === 'alphabetical')
    people.sort(
      (a, b) => a.person!.name.localeCompare(b.person!.name) || a.key.localeCompare(b.key),
    );
  else if (opts.order === 'shuffled') {
    const seed = opts.seed ?? '';
    const rank = new Map(people.map((p) => [p.key, seededRank(seed, p.key)]));
    people.sort((a, b) => rank.get(a.key)! - rank.get(b.key)! || a.key.localeCompare(b.key));
  }
  return unassigned ? [...people, unassigned] : people;
}
