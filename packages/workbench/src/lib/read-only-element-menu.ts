// The rows of the element menu a Participant or a Viewer opens (docs/specs/008-canvas/element-menu-quick-bar.md
// "Element menu for Participants and Viewers"): only what the role may do with the element, decided here once so
// every editor offers the same rows under the same gates. Pure: each editor reads the facts from its own element
// and session (`can`) and runs the rows with its own handlers.

export type ReadOnlyElementMenuKey = 'comment' | 'edit-text' | 'open-link' | 'note' | 'copy-text';

export type ReadOnlyElementMenuItem = { key: ReadOnlyElementMenuKey; label: string };

export type ReadOnlyElementMenuFacts = {
  // The session takes part (a Participant): it may comment (`can.takePart`).
  takePart: boolean;
  // Comments are shown at all (never in an embed's viewer).
  commentsShown: boolean;
  // The element takes comments, links and notes (a boxed element, never an arrow).
  attachments: boolean;
  hasComments: boolean;
  // The session may write this element's words now: `can.writeText(el)`, a kind that takes text, and nobody else
  // holding it selected.
  writeText: boolean;
  // The element's plain-text words, trimmed ('' when it has none).
  text: string;
  hasLink: boolean;
  hasNote: boolean;
};

// What every editor's elements carry in common for the menu: the plain-text `label` mirror, and on a boxed element
// its link, note and comment thread.
type MenuElement = {
  label?: string;
  link?: unknown;
  note?: string;
  commentThread?: { comments: readonly unknown[] };
};

/** Reads the facts the rows need from an element, given the session's gates for it. Only a boxed element
 *  (`attachments`) carries a link, a note or a thread. */
export function readOnlyElementMenuFacts(
  el: object,
  gates: Pick<ReadOnlyElementMenuFacts, 'takePart' | 'commentsShown' | 'attachments' | 'writeText'>,
): ReadOnlyElementMenuFacts {
  const e = el as MenuElement;
  return {
    ...gates,
    hasComments: gates.attachments && (e.commentThread?.comments.length ?? 0) > 0,
    text: (e.label ?? '').trim(),
    hasLink: gates.attachments && e.link != null,
    hasNote: gates.attachments && !!e.note,
  };
}

export function readOnlyElementMenuItems(
  facts: ReadOnlyElementMenuFacts,
): ReadOnlyElementMenuItem[] {
  const items: ReadOnlyElementMenuItem[] = [];
  const hasText = facts.text.length > 0;
  if (facts.attachments && facts.commentsShown) {
    // A Participant adds a comment anywhere; a Viewer only reads a thread there is.
    if (facts.takePart)
      items.push({ key: 'comment', label: facts.hasComments ? 'View Comments' : 'Add Comment' });
    else if (facts.hasComments) items.push({ key: 'comment', label: 'Show Comments' });
  }
  if (facts.writeText) items.push({ key: 'edit-text', label: hasText ? 'Edit Text' : 'Add Text' });
  if (facts.attachments && facts.hasLink) items.push({ key: 'open-link', label: 'Open Link' });
  if (facts.attachments && facts.hasNote) items.push({ key: 'note', label: 'View Note' });
  if (hasText) items.push({ key: 'copy-text', label: 'Copy Text' });
  return items;
}

// Writes `text` to the clipboard, resolving whether it landed (a page without clipboard access says no).
export async function copyElementText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
