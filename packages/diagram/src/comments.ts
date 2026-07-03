// Per-element comment threads: the Comment / CommentThread shapes plus the
// helpers that create a comment and count the active (unresolved) ones. Split
// out of index.ts so the comments model lives in one focused module. Re-exported
// from ./index, so the public `@livediagram/diagram` surface is unchanged.
// (The ./index import below is type-only — erased at compile — so it can't
// re-introduce the runtime module cycle this split avoided.)

import type { Element, Tab } from './index';
import type { ElementAction } from './element-action';

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

// The per-element fields that mutate OUTSIDE undo history and therefore
// need re-grafting onto restored snapshots: comment threads (spec/09) and
// assigned actions (spec/68 — Cmd+Z must never silently unassign work).
const LIVE_ELEMENT_FIELDS = ['commentThread', 'action'] as const;
type LiveFieldBag = { commentThread?: CommentThread; action?: ElementAction };

function applyLiveField<K extends keyof LiveFieldBag>(
  target: LiveFieldBag,
  field: K,
  value: LiveFieldBag[K],
): void {
  if (value === undefined) delete target[field];
  else target[field] = value;
}

// Carry the LIVE comment threads from one tab list onto another. Comment
// mutations bypass undo history (spec/09: typing a comment then Ctrl+Z
// mustn't wipe it), so every history snapshot's threads are stale the
// moment a comment lands — restoring a snapshot verbatim on undo/redo
// would silently drop comments added since it was taken. This grafts the
// current threads (from `from`) onto the restored elements (in `onto`),
// per element id; elements that only exist in the snapshot (an undone
// delete) keep the snapshot's thread. Assigned actions (spec/68) graft
// the same way, for the same reason.
export function graftCommentThreads(from: Tab[], onto: Tab[]): Tab[] {
  return graftLiveTabState(from, onto, { sessionFields: false });
}

// Full live-state graft for undo/redo: comment threads + assigned actions
// (above) PLUS the per-tab session tools (spec/39 `timer` / `vote`), which
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
