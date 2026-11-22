import { Selection, TextSelection } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';

/** Where a request for the caret puts it: the writing's start, its end, or the end of its Title. */
export type FocusAt = 'start' | 'end' | 'title';

/**
 * The selection a focus request makes. `title` is the end of the writing's first block when that is text (a page's
 * Title, docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Add"): its start while it is empty, after the name
 * of a page made with one. Writing that opens on no text block takes its start.
 */
export function focusSelection(doc: PMNode, at: FocusAt): Selection {
  if (at === 'end') return Selection.atEnd(doc);
  const first = doc.firstChild;
  if (at === 'title' && first?.isTextblock)
    return TextSelection.create(doc, 1 + first.content.size);
  return Selection.atStart(doc);
}
