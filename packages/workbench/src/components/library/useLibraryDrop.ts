'use client';

// A Library tile dropped on the canvas (liveworkspace/docs/specs/006-media/libraries.md "Placing: a click or a drag"):
// the item, found in the list the Library holds, is asked of the door, and lands centred on the drop point in one
// commit once the answer comes back. A refused or failed fetch lands nothing (the Library says why), so nothing is
// ever half placed. Null in an editor without the Library, so its canvas takes no such drop.

import { useCallback, useLayoutEffect, useRef } from 'react';
import type { LibraryInsertItem } from '../../hooks/canvas/useLibraryItemInsert';
import { useLibrary } from './LibraryProvider';

type Point = { x: number; y: number };

export type LibraryItemDrop = (id: string, at: Point) => Promise<boolean>;

export function useLibraryDrop(
  insert: (item: LibraryInsertItem<unknown>, at: Point) => boolean,
): LibraryItemDrop | null {
  const library = useLibrary();
  // The latest of each, read when the answer arrives: the canvas may have changed while the fetch ran. Kept in a
  // layout effect so they are current the moment a render commits, not a frame later: a drop straight after the
  // list arrives must see that list.
  const insertRef = useRef(insert);
  const libraryRef = useRef(library);
  useLayoutEffect(() => {
    insertRef.current = insert;
    libraryRef.current = library;
  });
  const drop = useCallback<LibraryItemDrop>(async (id, at) => {
    const lib = libraryRef.current;
    const item = lib?.state.items.find((i) => i.id === id);
    if (!lib || !item) {
      console.warn('[library] drop ignored', { reason: lib ? 'unknown item' : 'no library' });
      return false;
    }
    const held = await lib.place(item);
    return held ? insertRef.current(held, at) : false;
  }, []);
  return library ? drop : null;
}
