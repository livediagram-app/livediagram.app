// A Session tab's queue (docs/specs/026-plan/session-tabs.md "The queue", blueprint session-tabs.md "Behaviour and
// state"): the cards a session works through, in order, and where Refined takes each. Pure: the tab's state lives in
// @liveplanner/project's session-tab.ts; this reads the plan's cards against it.
import { byRank } from './apply';
import { isArchived, isTrashed } from './board-model';
import { sortCards, type BoardSortLevel } from './board-sort';
import { itemStatus, type Item } from './item';
import type { ItemTypeDef } from './item-types';
import { typeIn } from './type-catalogue';
import { typeStatusesOf } from './type-statuses';

// What a session is run for. Stand-up, Bug Triage and Sprint Review come later and join this list with their own
// outcomes.
export const SESSION_KIND_IDS = ['refinement', 'planning'] as const;
export type SessionKindId = (typeof SESSION_KIND_IDS)[number];

// What a session decided for a card: each kind offers some of these (SESSION_KIND_OUTCOMES).
export const SESSION_OUTCOMES = ['refined', 'skipped', 'flagged', 'committed'] as const;
export type SessionOutcome = (typeof SESSION_OUTCOMES)[number];

// The outcomes each kind's action bar offers, its completing one (the fill button) first.
export const SESSION_KIND_OUTCOMES: Readonly<Record<SessionKindId, readonly SessionOutcome[]>> = {
  refinement: ['refined', 'skipped', 'flagged'],
  planning: ['committed', 'skipped'],
};

export const isSessionKindId = (v: unknown): v is SessionKindId =>
  (SESSION_KIND_IDS as readonly unknown[]).includes(v);
export const isSessionOutcome = (v: unknown): v is SessionOutcome =>
  (SESSION_OUTCOMES as readonly unknown[]).includes(v);
// Whether `outcome` is one a session of `kind` decides (Committed is Sprint Planning's alone, Refined Refinement's).
export const outcomeFits = (kind: SessionKindId, outcome: SessionOutcome): boolean =>
  SESSION_KIND_OUTCOMES[kind].includes(outcome);

// The most cards one queue holds.
export const SESSION_QUEUE_MAX = 500;

// What a session picks and how: the part of its set-up the queue reads.
export type SessionPick = {
  typeIds: readonly string[];
  statuses: readonly string[];
  sortBy?: readonly BoardSortLevel[] | undefined;
};

export type SessionQueue = {
  // Cards already decided, in the order they were decided.
  decided: Item[];
  // Cards still to go, in the set-up's order.
  toGo: Item[];
  // More cards matched than SESSION_QUEUE_MAX; the rest are left out.
  capped: boolean;
};

const live = (item: Item) => !isArchived(item) && !isTrashed(item);

// The queue: every decided card still on the plan (by when it was decided), then every card of a picked type in a
// picked stage not yet decided, sorted as a board sorts (rank breaking ties).
export function sessionQueue(input: {
  items: Iterable<Item>;
  types: readonly ItemTypeDef[];
  pick: SessionPick;
  decided?: Readonly<Record<string, { at: number }>> | undefined;
}): SessionQueue {
  const { pick } = input;
  const decidedAt = input.decided ?? {};
  const typeIds = new Set(pick.typeIds);
  const statuses = new Set(pick.statuses);
  const decided: Item[] = [];
  const matched: Item[] = [];
  for (const item of input.items) {
    if (!live(item)) continue;
    if (Object.hasOwn(decidedAt, item.id)) decided.push(item);
    else if (typeIds.has(item.type) && statuses.has(itemStatus(item) ?? '')) matched.push(item);
  }
  decided.sort((a, b) => decidedAt[a.id]!.at - decidedAt[b.id]!.at || byRank(a, b));
  const sorted = sortCards(matched.sort(byRank), pick.sortBy, input.types);
  const room = Math.max(0, SESSION_QUEUE_MAX - decided.length);
  return {
    decided: decided.slice(0, SESSION_QUEUE_MAX),
    toGo: sorted.slice(0, room),
    capped: sorted.length > room || decided.length > SESSION_QUEUE_MAX,
  };
}

// Stage names, compared without case, that are never Next Stage: finished work, and the pile work waits in.
const DONE_LIKE = [
  'done',
  'closed',
  'complete',
  'completed',
  'shipped',
  'released',
  'cancelled',
  'canceled',
];
const BACKLOG_LIKE = ['backlog', 'icebox', 'inbox', 'ideas', 'idea', 'someday'];

// What a stage is, as Next Stage reads it: its name (the plan's, else its id) and its phase when the plan knows it.
export type SessionStageInfo = {
  names?: ReadonlyMap<string, string> | undefined;
  phases?: ReadonlyMap<string, 'todo' | 'doing' | 'done'> | undefined;
};

// Where a kind's completing outcome (Refined, Committed) takes a card (docs/specs/026-plan/session-tabs.md "Making
// one", D146): the stage the set-up names for its type (when the type uses it), else Next Stage, else null (the card
// stays). Next Stage is the stage after the card's own in its type's order when that one is open work (neither
// Done-like nor Backlog-like). A type that lists its waiting stages after Done (the Sprint Board's To Do, Doing, Done,
// Backlog, Ready) wraps round: from a stage after a Done-like one with no open stage after it, Next Stage is the
// type's first open stage (To Do).
export function sessionTarget(
  item: Item,
  types: readonly ItemTypeDef[],
  planStatuses: readonly string[],
  targets?: Readonly<Record<string, string>>,
  stages: SessionStageInfo = {},
): string | null {
  const order = typeStatusesOf(typeIn(types, item.type), planStatuses);
  const own = itemStatus(item) ?? '';
  const named = targets?.[item.type];
  if (named && order.includes(named)) return named === own ? null : named;
  const at = order.indexOf(own);
  if (at < 0) return null;
  const nameOf = (s: string) => (stages.names?.get(s) ?? s).trim().toLowerCase();
  const isDone = (s: string) => stages.phases?.get(s) === 'done' || DONE_LIKE.includes(nameOf(s));
  const isOpen = (s: string) => s !== own && !isDone(s) && !BACKLOG_LIKE.includes(nameOf(s));
  // The first open stage after the card's own, past any Backlog-like one, before a Done-like one.
  for (const s of order.slice(at + 1)) {
    if (isDone(s)) break;
    if (isOpen(s)) return s;
  }
  // None, and the card's stage sits after a Done-like one: the type lists its waiting stages after its finished ones,
  // so the work starts at its first open stage. Else the card stays.
  if (order.slice(0, at).some(isDone)) return order.find(isOpen) ?? null;
  return null;
}

// The card after `currentId` among those still to go (the first when it is not among them), or null when none is
// left: the session is complete.
export function nextToGo(toGo: readonly Item[], currentId?: string | null): Item | null {
  // Not among them (at -1): the first.
  const at = currentId ? toGo.findIndex((i) => i.id === currentId) : -1;
  return toGo[at + 1] ?? toGo[at - 1] ?? null;
}
