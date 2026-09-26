// The Q&A board (docs/specs/012-collaboration/qa-board.md): its note type, bounds, the pure reducer both the
// api worker and the editor run, the view sort, the voter id, and the rev
// merge every whole-element sync path goes through.
//
// A LEAF module (types only from './index'), for the same module-cycle reason
// collab-shapes.ts is one. Re-exported from './index'.

import type { Element, ShapeKind } from './index';

export type QaNoteState = 'discussing' | 'done';

export type QaNote = {
  id: string;
  text: string;
  // When it was submitted. The tie-break in the sort: of two notes with the
  // same votes, the one asked first holds its place.
  at: number;
  // Absent = anonymous. Stamped by the SERVER from the caller's participant
  // record, never read from the request (docs/specs/012-collaboration/qa-board.md, the docs/specs/012-collaboration/activity-and-audit.md rule).
  author?: { name: string; color: string };
  // Voter ids (see qaVoterId). One entry per person, so the count is the
  // length.
  voters: string[];
  state?: QaNoteState;
  doneAt?: number;
};

export const QA_MAX_NOTES = 200;
export const QA_MAX_TEXT = 280;
export const QA_MAX_VOTERS = 1000;
export const QA_MAX_ID = 64;
export const QA_MAX_NAME = 80;

export function isQaBoardShape(kind: ShapeKind): boolean {
  return kind === 'qa-board';
}

// --- Actions ---------------------------------------------------------------

// What one press asks for. `add` and `vote` are the audience's (any role,
// view links included); the rest run the board and need edit rights.
export type QaAction =
  | { type: 'add'; id: string; text: string; anonymous: boolean }
  // SET, not toggle, so a retried request can't flip a vote back off.
  | { type: 'vote'; noteId: string; on: boolean }
  // null clears the spotlight without closing anything.
  | { type: 'discuss'; noteId: string | null }
  | { type: 'done'; noteId: string }
  | { type: 'reopen'; noteId: string }
  | { type: 'remove'; noteId: string }
  | { type: 'clear' };

// The audience's two verbs. Everything else is gated on edit rights by the
// server and on the facilitator baton by the client (docs/specs/012-collaboration/qa-board.md).
export function isParticipantQaAction(action: QaAction): boolean {
  return action.type === 'add' || action.type === 'vote';
}

// Parse an action off an untrusted request body. Returns null for anything
// malformed, so the route can 400 without a ladder of checks of its own.
export function parseQaAction(raw: unknown): QaAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const noteId =
    typeof a.noteId === 'string' && a.noteId.length > 0 && a.noteId.length <= QA_MAX_ID
      ? a.noteId
      : null;
  switch (a.type) {
    case 'add': {
      if (typeof a.id !== 'string' || a.id.length === 0 || a.id.length > QA_MAX_ID) return null;
      if (typeof a.text !== 'string') return null;
      const text = a.text.trim();
      if (!text || text.length > QA_MAX_TEXT) return null;
      return { type: 'add', id: a.id, text, anonymous: a.anonymous === true };
    }
    case 'vote':
      return noteId && typeof a.on === 'boolean' ? { type: 'vote', noteId, on: a.on } : null;
    case 'discuss':
      if (a.noteId === null) return { type: 'discuss', noteId: null };
      return noteId ? { type: 'discuss', noteId } : null;
    case 'done':
    case 'reopen':
    case 'remove':
      return noteId ? { type: a.type, noteId } : null;
    case 'clear':
      return { type: 'clear' };
    default:
      return null;
  }
}

// Who is acting, as the reducer needs it. The server fills this from the
// authenticated caller; the client fills it from itself for the optimistic
// copy (the server's answer replaces it either way).
export type QaActor = {
  voterId: string;
  // null for an anonymous note, or when the caller has no participant row.
  author: { name: string; color: string } | null;
  now: number;
};

// Apply one action. Pure, and returns the SAME array when the action changes
// nothing (a vote you already cast, a note that has since been removed), so a
// caller can skip the write and the re-render.
export function applyQaAction(notes: QaNote[], action: QaAction, actor: QaActor): QaNote[] {
  const mapNote = (id: string, fn: (n: QaNote) => QaNote | null): QaNote[] => {
    const i = notes.findIndex((n) => n.id === id);
    if (i === -1) return notes;
    const next = fn(notes[i]!);
    if (next === notes[i]) return notes;
    const out = [...notes];
    if (next) out[i] = next;
    else out.splice(i, 1);
    return out;
  };

  switch (action.type) {
    case 'add': {
      // Idempotent by id: a retried add is not a second note.
      if (notes.some((n) => n.id === action.id)) return notes;
      if (notes.length >= QA_MAX_NOTES) return notes;
      const note: QaNote = {
        id: action.id,
        text: action.text.slice(0, QA_MAX_TEXT),
        at: actor.now,
        voters: [],
      };
      if (!action.anonymous && actor.author) {
        note.author = {
          name: actor.author.name.slice(0, QA_MAX_NAME),
          color: actor.author.color.slice(0, 32),
        };
      }
      return [...notes, note];
    }
    case 'vote':
      return mapNote(action.noteId, (n) => {
        // A closed note's count is frozen (docs/specs/012-collaboration/qa-board.md).
        if (n.state === 'done') return n;
        const has = n.voters.includes(actor.voterId);
        if (action.on === has) return n;
        if (action.on) {
          if (n.voters.length >= QA_MAX_VOTERS) return n;
          return { ...n, voters: [...n.voters, actor.voterId] };
        }
        return { ...n, voters: n.voters.filter((v) => v !== actor.voterId) };
      });
    case 'discuss': {
      // One spotlight at a time: whatever was being discussed goes back to
      // the queue (not to done; closing it is its own decision).
      let changed = false;
      const out = notes.map((n) => {
        if (n.id === action.noteId) {
          if (n.state === 'discussing') return n;
          changed = true;
          const { doneAt: _drop, ...rest } = n;
          return { ...rest, state: 'discussing' as const };
        }
        if (n.state === 'discussing') {
          changed = true;
          const { state: _s, ...rest } = n;
          return rest;
        }
        return n;
      });
      return changed ? out : notes;
    }
    case 'done':
      return mapNote(action.noteId, (n) =>
        n.state === 'done' ? n : { ...n, state: 'done', doneAt: actor.now },
      );
    case 'reopen':
      return mapNote(action.noteId, (n) => {
        if (n.state !== 'done') return n;
        const { state: _s, doneAt: _d, ...rest } = n;
        return rest;
      });
    case 'remove':
      return mapNote(action.noteId, () => null);
    case 'clear':
      return notes.length ? [] : notes;
  }
}

// --- The view ---------------------------------------------------------------

export type QaView = {
  // The spotlight: at most one.
  discussing: QaNote | null;
  // The live queue, most-voted first, oldest first on a tie.
  queue: QaNote[];
  // The drawer, most recently closed first.
  done: QaNote[];
};

export function qaView(notes: QaNote[] | undefined): QaView {
  const all = notes ?? [];
  let discussing: QaNote | null = null;
  const queue: QaNote[] = [];
  const done: QaNote[] = [];
  for (const n of all) {
    if (n.state === 'done') done.push(n);
    else if (n.state === 'discussing' && !discussing) discussing = n;
    else queue.push(n);
  }
  queue.sort((a, b) => b.voters.length - a.voters.length || a.at - b.at);
  done.sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  return { discussing, queue, done };
}

// --- Voter id -----------------------------------------------------------------

// sha256 of the owner id salted with the board's id, truncated (docs/specs/012-collaboration/qa-board.md).
// Computed by the SERVER from the authenticated caller, so a client can't vote
// as anyone else, and by the client from itself, so it knows which notes it
// voted for. One-way and per-board, so the published value is neither a
// credential nor a way to follow a person between boards.
export async function qaVoterId(ownerId: string, elementId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`livediagram:qa-vote:v1:${ownerId}:${elementId}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

// --- Consistency -----------------------------------------------------------------

// Pick the board state from whichever copy of an element has the higher
// `qaRev`, keeping `current` on a tie (docs/specs/012-collaboration/qa-board.md §Consistency). Every path that
// lands a WHOLE element over an existing one (the tab autosave on the server,
// the `el` and `tab` ops on a client) goes through this, so a snapshot taken
// before a vote landed can't erase it. Returns `incoming` untouched when it
// isn't a board or already carries the newer state.
export function preferNewerQa<T extends Element>(current: Element | undefined, incoming: T): T {
  if (!current || current.type !== 'shape' || incoming.type !== 'shape') return incoming;
  if (incoming.shape !== 'qa-board' || current.shape !== 'qa-board') return incoming;
  if ((incoming.qaRev ?? 0) > (current.qaRev ?? 0)) return incoming;
  // Same rev and the same content (the common case: a peer moved the board)
  // keeps the incoming object, so identity-based change checks see nothing.
  if (
    (incoming.qaRev ?? 0) === (current.qaRev ?? 0) &&
    (incoming.qaNotes === current.qaNotes ||
      JSON.stringify(incoming.qaNotes ?? []) === JSON.stringify(current.qaNotes ?? []))
  ) {
    return incoming;
  }
  return { ...incoming, qaNotes: current.qaNotes, qaRev: current.qaRev } as T;
}

// The same rule over a whole element list, matched by id.
export function preferNewerQaAll<T extends Element>(current: Element[], incoming: T[]): T[] {
  if (!incoming.some((el) => el.type === 'shape' && el.shape === 'qa-board')) return incoming;
  const byId = new Map(current.map((el) => [el.id, el]));
  let changed = false;
  const out = incoming.map((el) => {
    const next = preferNewerQa(byId.get(el.id), el);
    if (next !== el) changed = true;
    return next;
  });
  return changed ? out : incoming;
}
