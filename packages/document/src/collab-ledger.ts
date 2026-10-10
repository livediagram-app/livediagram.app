// The room's collaboration ledger (docs/specs/012-collaboration/collab-race-hardening.md, phase 3).
//
// Every client PUTs whole tabs, and D1 keeps whichever lands last, so a save
// snapshotted before somebody's answer arrived erased it from D1 even though
// the room had it. The Durable Object sequences every `el-delta` and `vote`
// op, so it records them here, and the api merges the ledger into each save
// before writing. Merging re-applies the entries through `applyElementDelta`,
// so the result is exactly what a peer receiving those deltas would hold.
//
// What is kept is the minimum that reproduces the state, not a log:
//   - answers: each participant's LATEST cast or withdraw, this round;
//   - ideas: the cards posted this round, in order;
//   - ticks: each checklist row's latest state, by index and text;
//   - dots: the round's votes map (a round starts empty, so its deltas are
//     the whole map).
//   - comments: each one posted (as the room stamped it, see
//     `stampCommentAuthor`), each one removed, and the thread's latest
//     resolve.
//   - a Plan board's set-up (phase 6): the latest value of each top-level
//     field and each column field, each column added or removed, and the
//     latest column order.
//
// Each answer, tick and the vote carry the room seq that last set them, and a
// merge only applies what the SAVING client had not yet seen (seq past the
// cursor it sent). Anything it had seen is already in its snapshot, or it
// changed it since: a withdraw made while its socket was down never reached
// the room, and re-applying the older cast would bring the answer back.
//
// Pure, and a LEAF module: the DO stores these values, it doesn't interpret
// them.

import type { Tab } from './index';
import type { Comment } from './comments';
import {
  applyElementDelta,
  COLLAB_ROUND_MAX,
  isComment,
  type ElementDelta,
} from './element-deltas';
import { RESPONSES_MAX, RESPONSE_VALUE_MAX } from './responses';
import { IDEA_MAX_CARDS, IDEA_MAX_TEXT } from './collab-shapes';
import { CHECKLIST_MAX_TEXT } from './data-shapes';
import { applyVoteDelta, type TabVote } from './session';
import { isPlanBoardPatch, type PlanBoardPatch } from './plan-board-patch';
import type { PlanColumn } from '@livediagram/items';

// One field's latest change: a value, or removed.
type FieldEntry = { value?: unknown; cleared?: true; seq: number };

export type BoardLedger = {
  set: Record<string, FieldEntry>;
  columns: Record<
    string,
    {
      set: Record<string, FieldEntry>;
      added?: { column: PlanColumn; seq: number };
      removed?: number;
    }
  >;
  order?: { ids: string[]; seq: number };
};

export type ElementLedger = {
  round?: string;
  // Rounds this element has moved past, newest last (see `retire`). An op
  // naming one is late and dropped. The round before the first one is '' here.
  retired?: string[];
  responses?: Record<string, { value: string | null; at: number; seq: number }>;
  ideas?: string[];
  // Keyed `${index}\u0000${text}`, the row name a `check` delta carries.
  ticks?: Record<string, { done: boolean; seq: number }>;
  // The thread's changes. Comments have no round: a clear doesn't touch them.
  comments?: {
    adds: Record<string, { comment: Comment; seq: number }>;
    removes: Record<string, number>;
    resolved?: { value: boolean; seq: number };
  };
  board?: BoardLedger;
};

export type VoteLedger = {
  round: string;
  votes: Record<string, string[]>;
  seq: number;
  // Vote rounds the tab has moved past, newest last (see `retire`).
  retired?: string[];
};

export type TabLedger = { vote?: VoteLedger; elements: Record<string, ElementLedger> };

// Bounds on what one ledger entry may hold, so a flood of hand-crafted ops
// can't grow a room's storage without end. Past a bound, new keys are dropped
// and the merge falls back to what the save carried.
const TICKS_MAX = 200;
const COMMENT_EVENTS_MAX = 500;
const DOTS_MAX = 5000;
const BOARD_COLUMNS_MAX = 64;
const ID_MAX = 200;
// How many past rounds an entry remembers, so a late op naming one of them is
// dropped instead of flipping the entry back to it (and wiping the current
// round's answers or dots). A round is retired by a clear or a new vote, a
// human action, so a late op is at most a few rounds stale; 16 ids of at most
// COLLAB_ROUND_MAX characters keep the entry around 1KB.
export const RETIRED_ROUNDS_MAX = 16;

const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;

// The round being left joins the retired list, oldest dropped past the bound.
function retire(retired: string[] | undefined, round: string): string[] {
  const kept = (retired ?? []).filter((r) => r !== round);
  return [...kept, round].slice(-RETIRED_ROUNDS_MAX);
}

// The storage key an op's ledger entry lives under, or null for an op the
// ledger doesn't track. One key per element (and one for the tab's vote) so
// no single stored value grows with the size of the canvas.
export function ledgerKey(op: unknown): string | null {
  if (!op || typeof op !== 'object') return null;
  const o = op as { kind?: unknown; tabId?: unknown; elementId?: unknown };
  if (!isStr(o.tabId, ID_MAX)) return null;
  if (o.kind === 'vote') return `ledger:${o.tabId}:vote`;
  if (o.kind === 'el-delta' && isStr(o.elementId, ID_MAX)) {
    return `ledger:${o.tabId}:el:${o.elementId}`;
  }
  return null;
}

// Every key a tab's ledger may use starts with this.
export function ledgerPrefix(tabId: string): string {
  return `ledger:${tabId}:`;
}

// Record one op into the entry `ledgerKey(op)` names. Returns the new entry,
// or null when the op is malformed or not tracked (the caller then leaves
// storage alone).
export function recordInLedger(
  prev: ElementLedger | VoteLedger | undefined,
  op: unknown,
  seq: number,
): ElementLedger | VoteLedger | null {
  const o = op as { kind?: unknown };
  if (o.kind === 'vote') return recordVote(prev as VoteLedger | undefined, op, seq);
  if (o.kind === 'el-delta') {
    return recordElement(prev as ElementLedger | undefined, (op as { delta?: unknown }).delta, seq);
  }
  return null;
}

function recordVote(prev: VoteLedger | undefined, op: unknown, seq: number): VoteLedger | null {
  const v = op as { round?: unknown; elementId?: unknown; voter?: unknown; delta?: unknown };
  // A dot with no round is from a client before rounds: nothing to key it by.
  if (!isStr(v.round, COLLAB_ROUND_MAX) || !isStr(v.elementId, ID_MAX)) return null;
  if (!isStr(v.voter, ID_MAX) || (v.delta !== 1 && v.delta !== -1)) return null;
  // A late dot (or withdraw) from a round the tab has left: drop it.
  if (prev?.retired?.includes(v.round)) return null;
  const base: VoteLedger =
    prev && prev.round === v.round
      ? prev
      : {
          round: v.round,
          votes: {},
          seq,
          ...(prev ? { retired: retire(prev.retired, prev.round) } : {}),
        };
  if (v.delta === 1) {
    const dots = Object.values(base.votes).reduce((n, ids) => n + ids.length, 0);
    if (dots >= DOTS_MAX) return null;
  }
  // Borrow the one place a dot changes hands (docs/specs/012-collaboration/session-tools.md).
  const asVote: TabVote = { active: true, revealed: false, votesPerPerson: 0, votes: base.votes };
  const next = applyVoteDelta(asVote, v.elementId, v.voter, v.delta);
  return next === asVote ? base : { ...base, votes: next.votes, seq };
}

function recordElement(
  prev: ElementLedger | undefined,
  delta: unknown,
  seq: number,
): ElementLedger | null {
  if (!delta || typeof delta !== 'object') return null;
  const d = delta as Record<string, unknown>;
  if (d.round !== undefined && !isStr(d.round, COLLAB_ROUND_MAX)) return null;
  const round = d.round as string | undefined;
  // Answers and ideas belong to a round; a delta for another one starts it,
  // retiring the one it replaces. A delta naming a retired round is late and
  // dropped (null). Ticks and comments have no round and carry over.
  const inRound = (e: ElementLedger | undefined): ElementLedger | null => {
    if (e && (e.round ?? undefined) === round) return e;
    if (e?.retired?.includes(round ?? '')) return null;
    return {
      ...(round !== undefined ? { round } : {}),
      ...(e ? { retired: retire(e.retired, e.round ?? '') } : {}),
      ...(e?.ticks ? { ticks: e.ticks } : {}),
      ...(e?.comments ? { comments: e.comments } : {}),
      ...(e?.board ? { board: e.board } : {}),
    };
  };
  switch (d.kind) {
    case 'response': {
      if (!isStr(d.participantId, ID_MAX)) return null;
      if (d.value !== null && !isStr(d.value, RESPONSE_VALUE_MAX)) return null;
      if (typeof d.at !== 'number' || !Number.isFinite(d.at)) return null;
      const base = inRound(prev);
      if (!base) return null;
      const responses = base.responses ?? {};
      if (!(d.participantId in responses) && Object.keys(responses).length >= RESPONSES_MAX) {
        return null;
      }
      return {
        ...base,
        responses: {
          ...responses,
          [d.participantId]: { value: d.value as string | null, at: d.at, seq },
        },
      };
    }
    case 'idea': {
      if (!isStr(d.text, IDEA_MAX_TEXT) || !d.text.trim()) return null;
      const base = inRound(prev);
      if (!base) return null;
      const ideas = base.ideas ?? [];
      if (ideas.length >= IDEA_MAX_CARDS) return null;
      return { ...base, ideas: [...ideas, d.text.trim()] };
    }
    case 'check': {
      if (typeof d.index !== 'number' || !Number.isInteger(d.index) || d.index < 0) return null;
      if (!isStr(d.text, CHECKLIST_MAX_TEXT) || typeof d.done !== 'boolean') return null;
      const key = `${d.index}\u0000${d.text}`;
      const ticks = prev?.ticks ?? {};
      if (!(key in ticks) && Object.keys(ticks).length >= TICKS_MAX) return null;
      return { ...(prev ?? {}), ticks: { ...ticks, [key]: { done: d.done, seq } } };
    }
    case 'comment-add':
    case 'comment-remove':
    case 'comment-resolve': {
      const comments = prev?.comments ?? { adds: {}, removes: {} };
      const events = Object.keys(comments.adds).length + Object.keys(comments.removes).length;
      if (d.kind === 'comment-add') {
        if (!isComment(d.comment)) return null;
        const id = d.comment.id;
        if (id in comments.removes || id in comments.adds) return null;
        if (events >= COMMENT_EVENTS_MAX) return null;
        return {
          ...(prev ?? {}),
          comments: { ...comments, adds: { ...comments.adds, [id]: { comment: d.comment, seq } } },
        };
      }
      if (d.kind === 'comment-remove') {
        if (!isStr(d.commentId, ID_MAX)) return null;
        if (events >= COMMENT_EVENTS_MAX && !(d.commentId in comments.adds)) return null;
        const { [d.commentId]: _gone, ...adds } = comments.adds;
        return {
          ...(prev ?? {}),
          comments: { ...comments, adds, removes: { ...comments.removes, [d.commentId]: seq } },
        };
      }
      if (typeof d.resolved !== 'boolean') return null;
      return {
        ...(prev ?? {}),
        comments: { ...comments, resolved: { value: d.resolved, seq } },
      };
    }
    case 'board':
      return recordBoard(prev, d.patch, seq);
    default:
      return null;
  }
}

function fieldEntries(
  prev: Record<string, FieldEntry>,
  set: Record<string, unknown> | undefined,
  clear: string[] | undefined,
  seq: number,
): Record<string, FieldEntry> {
  const next = { ...prev };
  for (const [k, value] of Object.entries(set ?? {})) next[k] = { value, seq };
  for (const k of clear ?? []) next[k] = { cleared: true, seq };
  return next;
}

function recordBoard(
  prev: ElementLedger | undefined,
  patch: unknown,
  seq: number,
): ElementLedger | null {
  if (!isPlanBoardPatch(patch)) return null;
  const p: PlanBoardPatch = patch;
  const board: BoardLedger = prev?.board ?? { set: {}, columns: {} };
  const columns = { ...board.columns };
  const column = (id: string) => columns[id] ?? { set: {} };
  const touched = new Set([
    ...Object.keys(p.columns ?? {}),
    ...(p.add ?? []).map((c) => c.id),
    ...(p.remove ?? []),
  ]);
  const fresh = [...touched].filter((id) => !(id in columns)).length;
  if (Object.keys(columns).length + fresh > BOARD_COLUMNS_MAX) return null;
  for (const [id, change] of Object.entries(p.columns ?? {})) {
    const c = column(id);
    columns[id] = { ...c, set: fieldEntries(c.set, change.set, change.clear, seq) };
  }
  for (const added of p.add ?? []) columns[added.id] = { set: {}, added: { column: added, seq } };
  for (const id of p.remove ?? []) columns[id] = { ...column(id), removed: seq };
  return {
    ...(prev ?? {}),
    board: {
      set: fieldEntries(board.set, p.set, p.clear, seq),
      columns,
      ...(p.order ? { order: { ids: p.order, seq } } : board.order ? { order: board.order } : {}),
    },
  };
}

// The board changes the saver hadn't seen, as one patch: re-applied through the same delta a peer would
// receive. A column the save already has isn't re-added (its fields come from the field entries); one it
// lacks is added with its later field changes folded in.
function boardPatchSince(
  board: BoardLedger,
  has: ReadonlySet<string>,
  since: number,
): PlanBoardPatch | null {
  const patch: PlanBoardPatch = {};
  const split = (entries: Record<string, FieldEntry>) => {
    const set: Record<string, unknown> = {};
    const clear: string[] = [];
    for (const [k, e] of Object.entries(entries)) {
      if (e.seq <= since) continue;
      if (e.cleared) clear.push(k);
      else set[k] = e.value;
    }
    return { set, clear };
  };
  const top = split(board.set);
  if (Object.keys(top.set).length) patch.set = top.set;
  if (top.clear.length) patch.clear = top.clear;
  const remove: string[] = [];
  const add: PlanColumn[] = [];
  const columns: Record<string, { set?: Record<string, unknown>; clear?: string[] }> = {};
  for (const [id, c] of Object.entries(board.columns)) {
    if (c.removed !== undefined) {
      if (c.removed > since) remove.push(id);
      continue;
    }
    const f = split(c.set);
    if (c.added && c.added.seq > since && !has.has(id)) {
      const col = { ...c.added.column, ...f.set } as Record<string, unknown>;
      for (const k of f.clear) delete col[k];
      add.push(col as unknown as PlanColumn);
      continue;
    }
    if (Object.keys(f.set).length || f.clear.length) {
      columns[id] = {
        ...(Object.keys(f.set).length ? { set: f.set } : {}),
        ...(f.clear.length ? { clear: f.clear } : {}),
      };
    }
  }
  if (remove.length) patch.remove = remove;
  if (add.length) patch.add = add;
  if (Object.keys(columns).length) patch.columns = columns;
  if (board.order && board.order.seq > since) patch.order = board.order.ids;
  return Object.keys(patch).length ? patch : null;
}

// Assemble a tab's ledger from its stored entries (keys under ledgerPrefix).
export function tabLedgerFrom(tabId: string, entries: Iterable<[string, unknown]>): TabLedger {
  const prefix = ledgerPrefix(tabId);
  const ledger: TabLedger = { elements: {} };
  for (const [key, value] of entries) {
    if (!key.startsWith(prefix) || !value || typeof value !== 'object') continue;
    const rest = key.slice(prefix.length);
    if (rest === 'vote') ledger.vote = value as VoteLedger;
    else if (rest.startsWith('el:')) ledger.elements[rest.slice(3)] = value as ElementLedger;
  }
  return ledger;
}

// Fold the ledger into a tab a client is saving, given the room seq that
// client had caught up to (`since`). Everything the save carries stays, except
// where the room knows something the saver didn't: answers and ticks set after
// `since` are re-applied, ideas the snapshot is missing are appended (ideas are
// only ever added, so there is nothing of the saver's to overrule), and the
// round's dots replace the snapshot's if any changed after `since`. An entry
// for a different round than the element (or vote) is ignored: the save
// carries a clear the ledger hasn't seen a delta for yet.
export function mergeLedgerIntoTab(tab: Tab, ledger: TabLedger, since: number): Tab {
  let changed = false;
  const elements = tab.elements.map((el) => {
    const entry = ledger.elements[el.id];
    if (!entry) return el;
    // A thread can sit on any boxed element, not only a shape.
    let next = applyCommentEvents(el, entry, since);
    if (el.type !== 'shape') {
      if (next !== el) changed = true;
      return next;
    }
    const round = el.collabRound;
    if ((entry.round ?? undefined) === (round ?? undefined)) {
      for (const [participantId, r] of Object.entries(entry.responses ?? {})) {
        if (r.seq <= since) continue;
        next = applyElementDelta(next, {
          kind: 'response',
          participantId,
          value: r.value,
          at: r.at,
          ...(round ? { round } : {}),
        }) as typeof el;
      }
      next = appendMissingIdeas(next, entry.ideas ?? [], round);
    }
    for (const [key, tick] of Object.entries(entry.ticks ?? {})) {
      if (tick.seq <= since) continue;
      const done = tick.done;
      const cut = key.indexOf('\u0000');
      next = applyElementDelta(next, {
        kind: 'check',
        index: Number(key.slice(0, cut)),
        text: key.slice(cut + 1),
        done,
      }) as typeof el;
    }
    const setup = next.type === 'shape' ? next.planBoard : undefined;
    if (entry.board && setup) {
      const patch = boardPatchSince(entry.board, new Set(setup.columns.map((c) => c.id)), since);
      if (patch) next = applyElementDelta(next, { kind: 'board', patch }) as typeof el;
    }
    if (next !== el) changed = true;
    return next;
  });
  let vote = tab.vote;
  if (vote?.round !== undefined && ledger.vote?.round === vote.round && ledger.vote.seq > since) {
    if (JSON.stringify(vote.votes) !== JSON.stringify(ledger.vote.votes)) {
      vote = { ...vote, votes: ledger.vote.votes };
      changed = true;
    }
  }
  if (!changed) return tab;
  return { ...tab, elements, ...(vote ? { vote } : {}) };
}

// A Participant's answers into the STORED tab (docs/specs/013-workspace/share-roles.md "Integrity"): the room
// writes a Participant's dots, responses and ideas itself, since a Participant never saves a whole tab. Only those
// three are taken from the ledger, every one the room holds (they are idempotent: a response is the latest per
// person, an idea is added once, the dots are the round's whole map), and only while the stored round still
// matches; ticks, threads and board changes stay with an Editor's save.
export function mergeLedgerAnswersIntoTab(tab: Tab, ledger: TabLedger): Tab {
  const elements: Record<string, ElementLedger> = {};
  for (const [id, entry] of Object.entries(ledger.elements)) {
    if (!entry.responses && !entry.ideas) continue;
    elements[id] = {
      ...(entry.round !== undefined ? { round: entry.round } : {}),
      ...(entry.responses ? { responses: entry.responses } : {}),
      ...(entry.ideas ? { ideas: entry.ideas } : {}),
    };
  }
  return mergeLedgerIntoTab(tab, { ...(ledger.vote ? { vote: ledger.vote } : {}), elements }, 0);
}

// The thread changes the saver hadn't seen, in the order the room took them,
// so an add after a resolve re-opens the thread and a resolve after it closes
// it again, exactly as it went live. Comments aren't a shape field, so this
// runs for any element kind that carries a thread.
function applyCommentEvents<E extends Tab['elements'][number]>(
  el: E,
  entry: ElementLedger,
  since: number,
): E {
  const c = entry.comments;
  if (!c) return el;
  const events: { seq: number; delta: ElementDelta }[] = [];
  for (const { comment, seq } of Object.values(c.adds)) {
    if (seq > since) events.push({ seq, delta: { kind: 'comment-add', comment } });
  }
  for (const [commentId, seq] of Object.entries(c.removes)) {
    if (seq > since) events.push({ seq, delta: { kind: 'comment-remove', commentId } });
  }
  if (c.resolved && c.resolved.seq > since) {
    events.push({
      seq: c.resolved.seq,
      delta: { kind: 'comment-resolve', resolved: c.resolved.value },
    });
  }
  events.sort((a, b) => a.seq - b.seq);
  return events.reduce<E>((acc, e) => applyElementDelta(acc, e.delta) as E, el);
}

// The name a comment was posted under, for every comment the room has seen
// posted, by id. The api uses it when a save carries somebody else's comment
// that D1 doesn't have yet: without it the save credited the comment to
// whoever happened to save first (docs/specs/012-collaboration/collab-race-hardening.md).
export function ledgerCommentAuthors(
  ledger: TabLedger,
): Map<string, { authorName: string; authorColor: string }> {
  const out = new Map<string, { authorName: string; authorColor: string }>();
  for (const entry of Object.values(ledger.elements)) {
    for (const { comment } of Object.values(entry.comments?.adds ?? {})) {
      out.set(comment.id, { authorName: comment.authorName, authorColor: comment.authorColor });
    }
  }
  return out;
}

// Cards have no ids, so the snapshot's cards are matched to the ledger's by
// text: for each text, the ledger's count of it is how many the round holds
// at least, and the shortfall is appended.
function appendMissingIdeas<E extends Tab['elements'][number]>(
  el: E,
  ideas: string[],
  round: string | undefined,
): E {
  if (el.type !== 'shape' || ideas.length === 0) return el;
  const have = new Map<string, number>();
  for (const text of el.ideaCards ?? []) have.set(text, (have.get(text) ?? 0) + 1);
  let next: E = el;
  for (const text of ideas) {
    const n = have.get(text) ?? 0;
    if (n > 0) {
      have.set(text, n - 1);
      continue;
    }
    next = applyElementDelta(next, { kind: 'idea', text, ...(round ? { round } : {}) }) as E;
  }
  return next;
}
