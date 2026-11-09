// The room's collaboration ledger (docs/specs/012-collaboration/collab-race-hardening.md, phase 3).
//
// Every client PUTs whole tabs, and D1 keeps whichever lands last, so a save
// snapshotted before somebody's answer arrived erased it from D1 even though
// the room had it. The Durable Object sequences every `el-delta`
// op, so it records them here, and the api merges the ledger into each save
// before writing. Merging re-applies the entries through `applyElementDelta`,
// so the result is exactly what a peer receiving those deltas would hold.
//
// What is kept is the minimum that reproduces the state, not a log:
//   - comments: each one posted (as the room stamped it, see
//     `stampCommentAuthor`), each one removed, the thread's latest
//     resolve, and each person's latest reaction per comment and emoji
//     (docs/specs/012-collaboration/comment-reactions.md);
//   - notes: each note pinned on a notice board and each one unpinned, by id
//     (docs/specs/009-elements/social-pieces.md "Notice Board");
//   - timer: a Timer's or Stopwatch's latest clock (docs/specs/009-elements/timer-and-stopwatch.md), last press wins;
//   - arcade: an Arcade Machine's latest clear and the ten best scores posted after it (docs/specs/009-elements/
//     social-pieces.md "High Scores"): a score cut from them would be cut from the machine too.
//
// Each entry carries the room seq that last set it, and a
// merge only applies what the SAVING client had not yet seen (seq past the
// cursor it sent). Anything it had seen is already in its snapshot, or it
// changed it since: a removal made while its socket was down never reached
// the room, and re-applying the older entry would bring it back.
//
// A room may still hold entries from the retired answer and idea cards (`round`, `retired`, `responses`, `ideas`,
// docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements"): nothing reads them, so a merge never writes
// them onto the element, which keeps its stored fields exactly as they were. Nor do a retired checklist's `ticks`
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine"), nor the dots of the retired Vote
// (a `ledger:<tab>:vote` entry, docs/specs/002-project-scope/not-in-livehuddle.md "The Vote"): the room no longer
// records them and a merge skips the entry.
//
// Pure, and a LEAF module: the DO stores these values, it doesn't interpret
// them.

import type { ShapeElement, Tab } from './index';
import type { Comment } from './comments';
import { applyElementDelta, isComment, type ElementDelta } from './element-deltas';
import { isNoticeNote, noteFields, NOTES_MAX, type NoticeNote } from './office-social';
import { isPieceTimer, type PieceTimer } from './timer-pieces';
import {
  ARCADE_SCORES_MAX,
  compareArcadeScores,
  isArcadeScore,
  type ArcadeScore,
} from './arcade-scores';
import {
  isReactionChange,
  type CommentReactionId,
} from '@liveworkspace/model-core/comment-reactions';

export type ElementLedger = {
  // A retired checklist's ticks (keyed `${index}\u0000${text}`): a stored ledger may still hold them; never replayed.
  ticks?: Record<string, { done: boolean; seq: number }>;
  // The thread's changes.
  comments?: {
    // A comment on a Sheet cell (Plan, now in liveplanner) carried a `cell`: stored ledgers may still hold one,
    // and it is never replayed onto the element's own thread.
    adds: Record<string, { comment: Comment; seq: number; cell?: string }>;
    removes: Record<string, number>;
    resolved?: { value: boolean; seq: number };
    // Reactions, keyed `${commentId}\u0000${emoji}\u0000${by}`: each person's latest on or off.
    reacts?: Record<string, { on: boolean; name: string; seq: number }>;
  };
  // A notice board's notes: each pinned note, and each unpin with the signer it named, by note id.
  notes?: {
    pins: Record<string, { note: NoticeNote; seq: number }>;
    unpins: Record<string, { by: string; seq: number }>;
  };
  // A Timer's or Stopwatch's clock: the latest press, whole.
  timer?: { state: PieceTimer; seq: number };
  // An Arcade Machine's High Scores: the ten best scores posted since the latest clear, by id, and that clear's seq.
  arcade?: { scores: Record<string, { score: ArcadeScore; seq: number }>; cleared?: number };
};

export type TabLedger = { elements: Record<string, ElementLedger> };

// Bounds on what one ledger entry may hold, so a flood of hand-crafted ops
// can't grow a room's storage without end. Past a bound, new keys are dropped
// and the merge falls back to what the save carried.
const COMMENT_EVENTS_MAX = 500;
const ID_MAX = 200;
// A board holds NOTES_MAX notes; room for them to turn over a few times before the oldest events give way.
const NOTE_EVENTS_MAX = NOTES_MAX * 4;

const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;

// The storage key an op's ledger entry lives under, or null for an op the
// ledger doesn't track. One key per element so
// no single stored value grows with the size of the canvas.
export function ledgerKey(op: unknown): string | null {
  if (!op || typeof op !== 'object') return null;
  const o = op as { kind?: unknown; tabId?: unknown; elementId?: unknown };
  if (!isStr(o.tabId, ID_MAX)) return null;
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
  prev: ElementLedger | undefined,
  op: unknown,
  seq: number,
): ElementLedger | null {
  const o = op as { kind?: unknown };
  if (o.kind === 'el-delta') {
    return recordElement(prev, (op as { delta?: unknown }).delta, seq);
  }
  return null;
}

function recordElement(
  prev: ElementLedger | undefined,
  delta: unknown,
  seq: number,
): ElementLedger | null {
  if (!delta || typeof delta !== 'object') return null;
  const d = delta as Record<string, unknown>;
  switch (d.kind) {
    case 'comment-add':
    case 'comment-remove':
    case 'comment-resolve':
    case 'comment-react': {
      const comments = prev?.comments ?? { adds: {}, removes: {} };
      const events =
        Object.keys(comments.adds).length +
        Object.keys(comments.removes).length +
        Object.keys(comments.reacts ?? {}).length;
      // A Sheet cell's thread went with Plan: a delta naming one is refused.
      if (d.cell !== undefined) return null;
      if (d.kind === 'comment-add') {
        if (!isComment(d.comment)) return null;
        const id = d.comment.id;
        if (id in comments.removes || id in comments.adds) return null;
        if (events >= COMMENT_EVENTS_MAX) return null;
        const add = { comment: d.comment, seq };
        return {
          ...(prev ?? {}),
          comments: { ...comments, adds: { ...comments.adds, [id]: add } },
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
      if (d.kind === 'comment-react') {
        const commentId = d.commentId;
        if (!isStr(commentId, ID_MAX) || !isReactionChange(d)) return null;
        const key = reactKey(commentId, d.emoji, d.by);
        const reacts = comments.reacts ?? {};
        if (!(key in reacts) && events >= COMMENT_EVENTS_MAX) return null;
        return {
          ...(prev ?? {}),
          comments: {
            ...comments,
            reacts: { ...reacts, [key]: { on: d.on, name: d.name, seq } },
          },
        };
      }
      if (typeof d.resolved !== 'boolean') return null;
      return {
        ...(prev ?? {}),
        comments: { ...comments, resolved: { value: d.resolved, seq } },
      };
    }
    case 'notice-pin':
    case 'notice-unpin':
      return recordNote(prev, d, seq);
    case 'piece-timer': {
      // Which piece it is for is the element's business; either kind's clock is a valid entry.
      if (!isPieceTimer(d.state, 'timer') && !isPieceTimer(d.state, 'stopwatch')) return null;
      return { ...(prev ?? {}), timer: { state: d.state, seq } };
    }
    case 'arcade-score':
    case 'arcade-clear':
      return recordArcade(prev, d, seq);
    default:
      return null;
  }
}

function recordNote(
  prev: ElementLedger | undefined,
  d: Record<string, unknown>,
  seq: number,
): ElementLedger | null {
  const notes = prev?.notes ?? { pins: {}, unpins: {} };
  if (d.kind === 'notice-pin') {
    if (!isNoticeNote(d.note)) return null;
    const id = d.note.id;
    if (id in notes.pins || id in notes.unpins) return null;
    const room = withRoomForOneNote(notes);
    return {
      ...(prev ?? {}),
      notes: { ...room, pins: { ...room.pins, [id]: { note: noteFields(d.note), seq } } },
    };
  }
  if (!isStr(d.noteId, ID_MAX) || !isStr(d.by, ID_MAX)) return null;
  // An unpin of a pin the entry holds, by its signer, takes its place: a merge that replays the pin then the unpin
  // lands the same as one that replays the unpin alone, and the unpin still stops a replayed pin of that id. One
  // naming another signer removes nothing anywhere, so the pin stays.
  const pinned = notes.pins[d.noteId];
  const pins = { ...notes.pins };
  if (pinned && pinned.note.by === d.by) delete pins[d.noteId];
  const room = withRoomForOneNote({ pins, unpins: notes.unpins }, d.noteId);
  return {
    ...(prev ?? {}),
    notes: { ...room, unpins: { ...room.unpins, [d.noteId]: { by: d.by, seq } } },
  };
}

// The notes entry with room for one more event: at NOTE_EVENTS_MAX the oldest events (lowest seq) go, never the
// newest, so a busy board's latest pins keep reaching the store (the room writes a Participant's pins from here). A
// saver that missed an event this old missed hundreds since, and its save is long overtaken. `replacing` names an
// event the caller is about to overwrite, which needs no room.
function withRoomForOneNote(
  notes: NonNullable<ElementLedger['notes']>,
  replacing?: string,
): NonNullable<ElementLedger['notes']> {
  const events = Object.keys(notes.pins).length + Object.keys(notes.unpins).length;
  if (events < NOTE_EVENTS_MAX || (replacing !== undefined && replacing in notes.unpins))
    return notes;
  const bySeq = [
    ...Object.entries(notes.pins).map(([id, e]) => ({ id, pin: true, seq: e.seq })),
    ...Object.entries(notes.unpins).map(([id, e]) => ({ id, pin: false, seq: e.seq })),
  ].sort((a, b) => a.seq - b.seq);
  const pins = { ...notes.pins };
  const unpins = { ...notes.unpins };
  for (const e of bySeq.slice(0, events - NOTE_EVENTS_MAX + 1)) {
    if (e.pin) delete pins[e.id];
    else delete unpins[e.id];
  }
  return { pins, unpins };
}

// A posted score joins the entry and the entry is cut to the ten best; a clear drops them all and keeps its seq.
function recordArcade(
  prev: ElementLedger | undefined,
  d: Record<string, unknown>,
  seq: number,
): ElementLedger | null {
  if (d.kind === 'arcade-clear') return { ...(prev ?? {}), arcade: { scores: {}, cleared: seq } };
  if (!isArcadeScore(d.score)) return null;
  const arcade = prev?.arcade ?? { scores: {} };
  if (d.score.id in arcade.scores) return null;
  const kept = [...Object.values(arcade.scores), { score: d.score, seq }]
    .sort((a, b) => compareArcadeScores(a.score, b.score))
    .slice(0, ARCADE_SCORES_MAX);
  const scores = Object.fromEntries(kept.map((e) => [e.score.id, e]));
  return { ...(prev ?? {}), arcade: { ...arcade, scores } };
}

// The ledger key of one person's reaction on one comment.
function reactKey(commentId: string, emoji: string, by: string): string {
  return `${commentId}\u0000${emoji}\u0000${by}`;
}

// Assemble a tab's ledger from its stored entries (keys under ledgerPrefix).
export function tabLedgerFrom(tabId: string, entries: Iterable<[string, unknown]>): TabLedger {
  const prefix = ledgerPrefix(tabId);
  const ledger: TabLedger = { elements: {} };
  for (const [key, value] of entries) {
    if (!key.startsWith(prefix) || !value || typeof value !== 'object') continue;
    const rest = key.slice(prefix.length);
    // A retired Vote's `vote` entry is skipped (see the header).
    if (rest.startsWith('el:')) ledger.elements[rest.slice(3)] = value;
  }
  return ledger;
}

// Fold the ledger into a tab a client is saving, given the room seq that
// client had caught up to (`since`). Everything the save carries stays, except
// where the room knows something the saver didn't: thread and piece changes set
// after `since` are re-applied.
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
    next = applyNoteEvents(next, entry, since);
    next = applyArcadeEvents(next, entry, since);
    if (entry.timer && entry.timer.seq > since) {
      next = applyElementDelta(next, {
        kind: 'piece-timer',
        state: entry.timer.state,
      }) as typeof el;
    }
    if (next !== el) changed = true;
    return next;
  });
  if (!changed) return tab;
  return { ...tab, elements };
}

// A Participant's answers into the STORED tab (docs/specs/013-workspace/share-roles.md "Integrity"): the room
// writes a Participant's comment reactions, notice board notes, Timer presses and arcade scores itself, since a Participant never
// saves a whole tab (a clock is the latest press, so re-applying it is a no-op). Only those are taken from the ledger, every one the room holds (they are idempotent: a reaction is the latest
// per person, a pin whose id the board holds is a no-op, and an unpin follows its pin in the room's order, checked
// against the stored note's signer); the rest of a thread stays with an Editor's save.
export function mergeLedgerAnswersIntoTab(tab: Tab, ledger: TabLedger): Tab {
  const elements: Record<string, ElementLedger> = {};
  for (const [id, entry] of Object.entries(ledger.elements)) {
    const reacts = entry.comments?.reacts;
    const notes = entry.notes;
    const timer = entry.timer;
    const arcade = entry.arcade;
    if (!reacts && !notes && !timer && !arcade) continue;
    elements[id] = {
      ...(reacts ? { comments: { adds: {}, removes: {}, reacts } } : {}),
      ...(notes ? { notes } : {}),
      ...(timer ? { timer } : {}),
      ...(arcade ? { arcade } : {}),
    };
  }
  return mergeLedgerIntoTab(tab, { elements }, 0);
}

// The note pins and unpins the saver hadn't seen, in the room's order, each through `applyElementDelta`: a pin on
// a full board or an unpin naming another signer lands as it did live, which is to say not at all.
function applyNoteEvents<E extends Tab['elements'][number]>(
  el: E,
  entry: ElementLedger,
  since: number,
): E {
  const n = entry.notes;
  if (!n) return el;
  const events: { seq: number; delta: ElementDelta }[] = [];
  for (const { note, seq } of Object.values(n.pins)) {
    if (seq > since) events.push({ seq, delta: { kind: 'notice-pin', note } });
  }
  for (const [noteId, { by, seq }] of Object.entries(n.unpins)) {
    if (seq > since) events.push({ seq, delta: { kind: 'notice-unpin', noteId, by } });
  }
  events.sort((a, b) => a.seq - b.seq);
  return events.reduce<E>((acc, e) => applyElementDelta(acc, e.delta) as E, el);
}

// The clear and the scores the saver hadn't seen, in the room's order, each through `applyElementDelta`, so a score
// that does not make the table lands as it did live, which is to say not at all.
function applyArcadeEvents<E extends Tab['elements'][number]>(
  el: E,
  entry: ElementLedger,
  since: number,
): E {
  const a = entry.arcade;
  if (!a) return el;
  const events: { seq: number; delta: ElementDelta }[] = [];
  if (a.cleared !== undefined && a.cleared > since)
    events.push({ seq: a.cleared, delta: { kind: 'arcade-clear' } });
  for (const { score, seq } of Object.values(a.scores)) {
    if (seq > since) events.push({ seq, delta: { kind: 'arcade-score', score } });
  }
  events.sort((x, y) => x.seq - y.seq);
  const next = events.reduce<E>((acc, e) => applyElementDelta(acc, e.delta) as E, el);
  // A replayed clear drops the table and the scores rebuild the same one as new objects: the element itself, so an
  // answers flush that changes nothing never rewrites the stored tab. Ten rows at most, so the compare is cheap.
  const table = (e: E) => JSON.stringify((e as ShapeElement).arcadeScores ?? []);
  return next !== el && table(next) === table(el) ? el : next;
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
  for (const { comment, seq, cell } of Object.values(c.adds)) {
    if (seq > since && cell === undefined)
      events.push({ seq, delta: { kind: 'comment-add', comment } });
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
  for (const [key, r] of Object.entries(c.reacts ?? {})) {
    if (r.seq <= since) continue;
    const [commentId, emoji, by] = key.split('\u0000') as [string, CommentReactionId, string];
    events.push({
      seq: r.seq,
      delta: { kind: 'comment-react', commentId, emoji, by, name: r.name, on: r.on },
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
