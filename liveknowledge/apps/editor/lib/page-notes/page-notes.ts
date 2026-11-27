// The page's comments and actions on its words (docs/specs/030-knowledgebase/page-comments.md "Comments on the
// writing", Work Tracker 1484), as the Comments list and the writing's look read them: each note that holds a
// conversation, in the writing's order (detached ones after), its words, and whether it is open; and the one small
// style sheet that takes a resolved note's tint off and a detached note's marker out of the margin. Pure: derived
// from the page as this editor draws it (its lens), once a change of its elements or writing.
import {
  articlesOf,
  elementActions,
  isOpenAction,
  noteAnchorTexts,
  noteHoldsConversation,
  type Comment,
  type CommentThread,
  type Element,
  type ElementAction,
} from '@liveknowledge/document';

export type PageNoteKind = 'comment' | 'action';

export type PageNote = {
  id: string;
  kind: PageNoteKind;
  // The words it is on, or null once they were deleted (detached).
  quote: string | null;
  open: boolean;
  // A comment note's thread: how many comments, and the newest.
  count: number;
  latest: Comment | null;
  action: ElementAction | null;
};

type NoteTab = { elements: readonly Element[]; articles?: unknown };

const threadOf = (el: Element): CommentThread | undefined =>
  (el as { commentThread?: CommentThread }).commentThread;

/** Every note holding a comment or an action, anchored ones in the writing's order, then the detached. */
export function pageNotesOf(tab: NoteTab): PageNote[] {
  const markers = tab.elements.filter(
    (el) => el.type === 'article-note' && noteHoldsConversation(el),
  );
  if (markers.length === 0) return [];
  const quotes = noteAnchorTexts(articlesOf(tab));
  const order = [...quotes.keys()];
  const rank = new Map(order.map((id, i) => [id, i]));
  const notes = markers.map((el): PageNote => {
    const thread = threadOf(el);
    const action = elementActions(el)[0] ?? null;
    const kind: PageNoteKind =
      (el as { articleNote?: PageNoteKind }).articleNote === 'action' ? 'action' : 'comment';
    const comments = thread?.comments ?? [];
    const open = action ? isOpenAction(action) : !thread?.resolved;
    return {
      id: el.id,
      kind,
      quote: quotes.get(el.id) ?? null,
      open,
      count: comments.length,
      latest: comments[comments.length - 1] ?? null,
      action,
    };
  });
  return notes.sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || 0);
}

/**
 * The style sheet for the page's notes: a resolved thread's, or a closed action's, words read as plain writing; a
 * detached note's marker is not drawn. '' when no note needs either, so nothing is written for most pages.
 */
export function noteMarkStyles(tab: NoteTab): string {
  let anchored: ReadonlyMap<string, string> | null = null;
  const plain: string[] = [];
  const hidden: string[] = [];
  for (const el of tab.elements) {
    if (el.type !== 'article-note') continue;
    anchored ??= noteAnchorTexts(articlesOf(tab));
    const id = cssString(el.id);
    if (!anchored.has(el.id)) {
      hidden.push(`[data-article-note][data-element-id="${id}"]`);
      continue;
    }
    const action = elementActions(el)[0];
    const closed = action ? !isOpenAction(action) : threadOf(el)?.resolved === true;
    if (closed) plain.push(`.article-flow [data-note-id="${id}"]`);
  }
  const out: string[] = [];
  if (plain.length) out.push(`${plain.join(',')}{background:none;border-bottom-color:transparent}`);
  if (hidden.length) out.push(`${hidden.join(',')}{visibility:hidden}`);
  return out.join('\n');
}

// An id as a CSS string's contents: ids are UUIDs, but anything else is escaped rather than trusted.
function cssString(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c.codePointAt(0)!.toString(16)} `);
}
