// A Session tab's queue (docs/specs/026-plan/session-tabs.md "The queue", blueprint session-tabs.md "Behaviour and
// state"): the cards a session works through, in order, and where Refined takes each. Pure: the tab's state lives in
// @liveplanner/project's session-tab.ts; this reads the plan's cards against it.
import { byRank } from './apply';
import { isArchived, isTrashed } from './board-model';
import { sortCards, type BoardSortLevel } from './board-sort';
import { itemStatus, type Item } from './item';
import { itemStatusSince } from './status-since';
import type { ItemTypeDef } from './item-types';
import { typeIn } from './type-catalogue';
import { typeStatusesOf } from './type-statuses';

// What a session is run for. Stand-up comes later and joins this list with its own outcomes.
export const SESSION_KIND_IDS = ['refinement', 'planning', 'triage', 'review'] as const;
export type SessionKindId = (typeof SESSION_KIND_IDS)[number];

// What a session decided for a card: each kind offers some of these (SESSION_KIND_OUTCOMES).
export const SESSION_OUTCOMES = [
  'refined',
  'skipped',
  'flagged',
  'committed',
  'accepted',
  'closed',
  'reviewed',
] as const;
export type SessionOutcome = (typeof SESSION_OUTCOMES)[number];

// The outcomes each kind's action bar offers, its completing one (the fill button) first.
export const SESSION_KIND_OUTCOMES: Readonly<Record<SessionKindId, readonly SessionOutcome[]>> = {
  refinement: ['refined', 'skipped', 'flagged'],
  planning: ['committed', 'skipped'],
  triage: ['accepted', 'closed', 'skipped', 'flagged'],
  review: ['reviewed', 'skipped'],
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
  // Sprint Review's done range: only cards that entered their stage from `since` and up to `until` (ms), by their
  // status stamp, never their last edit.
  since?: number | undefined;
  until?: number | undefined;
  // Archived cards are read too (Sprint Review: finished work may be archived), never restored or moved.
  archived?: boolean | undefined;
};

export type SessionQueue = {
  // Cards already decided, in the order they were decided.
  decided: Item[];
  // Cards still to go, in the set-up's order.
  toGo: Item[];
  // More cards matched than SESSION_QUEUE_MAX; the rest are left out.
  capped: boolean;
};

// Whether a card can sit in a queue: never a trashed one; an archived one only for a kind that reads them.
const readable = (item: Item, archived: boolean | undefined) =>
  !isTrashed(item) && (!!archived || !isArchived(item));

// Whether `item` entered its stage within `since`..`until` (either absent: open).
export const inDoneRange = (item: Item, since?: number, until?: number): boolean => {
  if (since === undefined && until === undefined) return true;
  const at = itemStatusSince(item);
  return (since === undefined || at >= since) && (until === undefined || at <= until);
};

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
    if (!readable(item, pick.archived)) continue;
    if (Object.hasOwn(decidedAt, item.id)) decided.push(item);
    else if (
      typeIds.has(item.type) &&
      statuses.has(itemStatus(item) ?? '') &&
      inDoneRange(item, pick.since, pick.until)
    )
      matched.push(item);
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

// The cards still to go in the order the screen first queued them (docs/specs/026-plan/session-tabs.md "The queue"):
// a card already in `order` keeps its place, so editing the shown card never re-sorts it to the end; a newly matching
// card comes after, in the board's order. Answers the cards and the order to keep next time (the old one plus the new
// ids, at most SESSION_QUEUE_MAX * 4, the oldest dropped first).
export function holdOrder(
  order: readonly string[],
  cards: readonly Item[],
): { cards: Item[]; order: string[] } {
  const at = new Map(order.map((id, i) => [id, i]));
  const known: Item[] = [];
  const fresh: Item[] = [];
  for (const c of cards) (at.has(c.id) ? known : fresh).push(c);
  known.sort((a, b) => at.get(a.id)! - at.get(b.id)!);
  const next = fresh.length ? [...order, ...fresh.map((c) => c.id)] : [...order];
  return { cards: [...known, ...fresh], order: next.slice(-SESSION_QUEUE_MAX * 4) };
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
  // Stage names (lower case) a kind's Next Stage also steps past, as it does a Backlog-like one (Bug Triage's waiting
  // stages: Needs Info, On Hold).
  pass?: readonly string[] | undefined;
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
  const isOpen = (s: string) =>
    s !== own &&
    !isDone(s) &&
    !BACKLOG_LIKE.includes(nameOf(s)) &&
    !(stages.pass?.includes(nameOf(s)) ?? false);
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
