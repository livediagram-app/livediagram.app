// A selection as a Library item to save (liveworkspace/docs/specs/006-media/libraries.md): the workbench's
// libraryDraft bound to liveknowledge's elements, so the copy, its bounds and its suggested name are this editor's own.
import {
  contentBounds,
  duplicateElements,
  elementKindLabel,
  type Element,
} from '@liveknowledge/document';
import { libraryDraft } from '@liveworkspace/workbench/lib/library/library-draft';
import type { LibrarySaveDraft } from '@liveworkspace/workbench/components/library/LibraryProvider';

export function libraryDraftOf(selection: readonly Element[]): LibrarySaveDraft | null {
  return libraryDraft<Element>(selection, {
    duplicate: (elements, ids, dx, dy) => duplicateElements(elements, ids, dx, dy).newElements,
    bounds: (elements) => contentBounds(elements),
    kindLabel: elementKindLabel,
  });
}
