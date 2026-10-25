// How a margin note looks and what it is called (docs/specs/007-editor/article-pages.md "Comments and actions"):
// a comment and an action are told apart by colour, by the marker's outline and by its glyph, and
// each says where it stands (open, resolved, done, Won't Do). Pure, so the face, the chip variant
// and the screen-reader name read one answer.
import {
  activeCommentCount,
  elementActions,
  type ArticleNoteElement,
} from '@livedocuments/document';
import { colorForKey, initialsOf } from '@/lib/identity';

/** The note's fixed colours, never themed: a sticky keeps its own the same way. Contrast in the spec. */
export const NOTE_INK = {
  comment: { ink: '#4f46e5', chip: '#eef2ff', rim: '#6366f1' }, // indigo-600 / -50 / -500
  action: { ink: '#047857', chip: '#ecfdf5', rim: '#059669' }, // emerald-700 / -50 / -600
  wontDo: '#64748b', // slate-500, as Collaborate wears Won't Do
} as const;

export type NoteAssignee = { name: string; initials: string; color: string };

export type NoteLook =
  | { face: 'comment'; open: number }
  | { face: 'comment-resolved' }
  | { face: 'action-open'; assignee: NoteAssignee | null }
  | { face: 'action-done'; assignee: NoteAssignee }
  | { face: 'action-wont-do'; assignee: NoteAssignee };

export function noteLook(element: ArticleNoteElement): NoteLook {
  if (element.articleNote === 'action') {
    const action = elementActions(element)[0];
    if (!action) return { face: 'action-open', assignee: null };
    const name = action.assignee.name?.trim() || 'a teammate';
    const assignee = {
      name,
      initials: initialsOf(name),
      color: colorForKey(action.assignee.userId ?? action.assignee.memberId ?? name),
    };
    if (action.status === 'done') return { face: 'action-done', assignee };
    if (action.status === 'wont-do') return { face: 'action-wont-do', assignee };
    return { face: 'action-open', assignee };
  }
  if (element.commentThread?.resolved) return { face: 'comment-resolved' };
  return { face: 'comment', open: activeCommentCount(element.commentThread) };
}

/** The marker's screen-reader name (spec "Its name"). */
export function noteAriaLabel(element: ArticleNoteElement): string {
  const look = noteLook(element);
  switch (look.face) {
    case 'comment':
      return look.open > 0 ? `Comment, ${look.open} open` : 'Comment, no comments yet';
    case 'comment-resolved':
      return 'Comment, resolved';
    case 'action-open':
      return look.assignee ? `Action for ${look.assignee.name}` : 'Action, not assigned yet';
    case 'action-done':
      return `Action for ${look.assignee.name}, done`;
    case 'action-wont-do':
      return `Action for ${look.assignee.name}, won't do`;
  }
}
