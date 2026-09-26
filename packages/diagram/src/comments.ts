// Per-element comment threads: the Comment / CommentThread shapes plus the
// helpers that create a comment and count the active (unresolved) ones. Split
// out of index.ts so the comments model lives in one focused module. Re-exported
// from ./index, so the public `@livediagram/diagram` surface is unchanged.
// (The ./index import below is type-only — erased at compile — so it can't
// re-introduce the runtime module cycle this split avoided.)

import type { Element, ShapeElement, Tab } from './index';
import type { ElementAction } from './element-action';
import { isComment, keepLocalTicks } from './element-deltas';

// A single comment inside a thread. The author is the participant who
// wrote it (per `apps/live/lib/identity.ts`). The participant model is
// local-session-only today; the comment carries a denormalised copy of
// the name + colour so the badge keeps rendering even if the participant
// list later evolves (e.g. user renames themselves mid-session).
export type Comment = {
  id: string;
  text: string;
  createdAt: number; // unix ms
  authorName: string;
  authorColor: string;
  // Stable id of the participant who wrote it (their Clerk sub or guest
  // owner id). Server-stamped and server-trusted, never read from the
  // client. Lets a view-role visitor delete their OWN comments without
  // being able to touch anyone else's. When serving a diagram to a
  // non-owner the API blanks this on comments they didn't write (same
  // anti-claim redaction `redactOwner` applies to the diagram owner id),
  // so a visitor only ever sees their own author id. Optional so
  // comments written before this field existed still parse.
  authorId?: string;
};

// Threads live on elements (currently boxed only). `resolved` is sticky:
// users can resolve and unresolve a thread without losing the comments.
export type CommentThread = {
  comments: Comment[];
  resolved: boolean;
};

export function createComment(
  text: string,
  author: { id?: string; name: string; color: string },
): Comment {
  return {
    id: crypto.randomUUID(),
    text,
    createdAt: Date.now(),
    authorName: author.name,
    authorColor: author.color,
    authorId: author.id,
  };
}

// Count of comments shown on the badge. Resolved threads return 0 so the
// badge hides — the comments still exist and reappear on unresolve.
export function activeCommentCount(thread: CommentThread | undefined): number {
  if (!thread || thread.resolved) return 0;
  return thread.comments.length;
}

// A comment's `authorId` is its author's OWNER id, and for a guest that id is
// the credential their api calls carry. D1 keeps it (the delete-own check
// needs it) and a tab GET redacts it for everyone but the author, so the one
// place it could still escape is the realtime room, which fans every element
// op out to every socket. Everything the editor sends the room goes through
// this first (docs/specs/012-collaboration/collab-race-hardening.md); the author's own local copy keeps it.
export function withoutCommentAuthorId(comment: Comment): Comment {
  if (comment.authorId === undefined) return comment;
  const { authorId: _drop, ...rest } = comment;
  return rest;
}

export function withoutCommentAuthorIds<E extends Element>(el: E): E {
  const thread = (el as { commentThread?: CommentThread }).commentThread;
  if (!thread || !thread.comments.some((c) => c.authorId !== undefined)) return el;
  return {
    ...el,
    commentThread: { ...thread, comments: thread.comments.map(withoutCommentAuthorId) },
  };
}

// A room op with every comment author id taken out, whichever kind carries
// one: an element add / update, a whole tab, or a posted comment. The ONE
// definition of what may not reach the wire (docs/specs/012-collaboration/collab-race-hardening.md): the editor applies it
// to everything it sends, and the room to everything it relays, so neither a
// new send path nor an old client can leak one. Anything else passes through
// untouched (same object back).
export function opForTheWire(op: unknown): unknown {
  const o = op as {
    kind?: unknown;
    tab?: { elements?: Element[] };
    op?: { kind?: unknown; element?: Element };
    delta?: { kind?: unknown; comment?: unknown };
  } | null;
  if (!o || typeof o !== 'object') return op;
  if (o.kind === 'tab' && Array.isArray(o.tab?.elements)) {
    return { ...o, tab: { ...o.tab, elements: o.tab.elements.map(withoutCommentAuthorIds) } };
  }
  if (o.kind === 'el' && (o.op?.kind === 'add' || o.op?.kind === 'update') && o.op.element) {
    return { ...o, op: { ...o.op, element: withoutCommentAuthorIds(o.op.element) } };
  }
  if (o.kind === 'el-delta' && o.delta?.kind === 'comment-add' && isComment(o.delta.comment)) {
    return { ...o, delta: { ...o.delta, comment: withoutCommentAuthorId(o.delta.comment) } };
  }
  return op;
}

// Stamp a comment an editor posts with the name and colour of the session
// that sent it, the identity everyone already sees on that person's cursor
// (docs/specs/012-collaboration/collab-race-hardening.md). The room holds no verified identity (docs/specs/015-api/public-api-and-tokens.md §6); this makes
// the comment's name agree with the session it came from rather than with
// whatever the frame said. Run after `opForTheWire`, which has already taken
// any author id out.
export function stampCommentAuthor(
  op: unknown,
  presence: { name: string; color: string },
): unknown {
  const o = op as { kind?: unknown; delta?: { kind?: unknown; comment?: unknown } };
  if (o?.kind !== 'el-delta' || o.delta?.kind !== 'comment-add') return op;
  if (!isComment(o.delta.comment)) return op;
  return {
    ...o,
    delta: {
      ...o.delta,
      comment: { ...o.delta.comment, authorName: presence.name, authorColor: presence.color },
    },
  };
}

// The per-element fields that mutate OUTSIDE undo history and therefore
// need re-grafting onto restored snapshots: comment threads (docs/specs/008-canvas/canvas-and-palette.md),
// assigned actions (docs/specs/012-collaboration/assigned-actions.md: Cmd+Z must never silently unassign work), and
// everything a collaborative press writes (docs/specs/012-collaboration/collab-race-hardening.md): answers, reveals, idea
// cards, the roll, the agenda's current row and the picker's result. A
// snapshot from before somebody answered would otherwise take their answer
// away from the whole room the moment anyone pressed undo.
const LIVE_ELEMENT_FIELDS = [
  'commentThread',
  'action',
  'responses',
  'responsesRevealed',
  'collabRound',
  'ideaCards',
  'ideasRevealed',
  'rollCall',
  'agendaCurrent',
  'pickerResult',
  // The Q&A board's notes (docs/specs/012-collaboration/qa-board.md) are written by its endpoint, never by
  // an undoable edit, so a snapshot's copy is only ever older.
  'qaNotes',
  'qaRev',
] as const;
type LiveFieldBag = { commentThread?: CommentThread; action?: ElementAction } & Pick<
  ShapeElement,
  | 'responses'
  | 'responsesRevealed'
  | 'collabRound'
  | 'ideaCards'
  | 'ideasRevealed'
  | 'rollCall'
  | 'agendaCurrent'
  | 'pickerResult'
  | 'qaNotes'
  | 'qaRev'
>;

function applyLiveField<K extends keyof LiveFieldBag>(
  target: LiveFieldBag,
  field: K,
  value: LiveFieldBag[K],
): void {
  if (value === undefined) delete target[field];
  else target[field] = value;
}

// Full live-state graft for undo/redo: comment threads + assigned actions
// (above) PLUS the per-tab session tools (docs/specs/012-collaboration/session-tools.md `timer` / `vote`), which
// also mutate outside undo history — a timer start or a vote dot isn't
// undoable, so a restored snapshot predates them and would silently wipe
// them for the whole room (autosave persists + broadcasts the restored tab).
export function graftLiveTabState(
  from: Tab[],
  onto: Tab[],
  opts: { sessionFields?: boolean } = {},
): Tab[] {
  const sessionFields = opts.sessionFields !== false;
  return onto.map((tab) => {
    const src = from.find((t) => t.id === tab.id);
    if (!src) return tab;
    const srcById = new Map(src.elements.map((el) => [el.id, el] as const));
    const liveFields = new Map<string, LiveFieldBag>(
      src.elements.map((el) => {
        const bag: LiveFieldBag = {};
        for (const field of LIVE_ELEMENT_FIELDS) {
          if (field in el) applyLiveField(bag, field, (el as LiveFieldBag)[field]);
        }
        return [el.id, bag];
      }),
    );
    let changed = false;
    const elements = tab.elements.map((el): Element => {
      const live = liveFields.get(el.id);
      if (!live) return el;
      let next = el;
      for (const field of LIVE_ELEMENT_FIELDS) {
        const liveValue = live[field];
        const current = (el as LiveFieldBag)[field];
        if (liveValue === current) continue;
        changed = true;
        if (next === el) next = { ...el };
        applyLiveField(next as LiveFieldBag, field, liveValue);
      }
      // Checklist ticks are live too (docs/specs/012-collaboration/collab-race-hardening.md), but the rows themselves are
      // authored and undoable, so only the `done` flags carry over, row by row.
      const liveEl = srcById.get(el.id);
      if (
        next.type === 'shape' &&
        liveEl?.type === 'shape' &&
        liveEl.checklistItems &&
        next.checklistItems
      ) {
        const items = keepLocalTicks(liveEl.checklistItems, next.checklistItems);
        if (items !== next.checklistItems) {
          changed = true;
          next = { ...next, checklistItems: items };
        }
      }
      return next;
    });
    let next = changed ? { ...tab, elements } : tab;
    if (sessionFields && (src.timer !== tab.timer || src.vote !== tab.vote)) {
      next = next === tab ? { ...tab } : next;
      if (src.timer !== undefined) next.timer = src.timer;
      else delete next.timer;
      if (src.vote !== undefined) next.vote = src.vote;
      else delete next.vote;
    }
    return next;
  });
}
