// What the pointer and the keyboard are doing in the page tree, held outside React
// (docs/specs/030-knowledgebase/blueprints/page-tree.md "Performance and limits"): the row under the pointer, the
// row holding focus, the row being dragged and where it would land. A drag over 500 rows moves these on every
// pointer move; each row reads only its own part (`rowMark`), so a move renders the two rows it changes, never the
// list.
import { useSyncExternalStore } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import type { DropZone } from './page-tree-view';

export type TreeDrop = { id: string; zone: DropZone } | null;

export type PageTreeUi = {
  subscribe: (listener: () => void) => () => void;
  /** One row's part of the state, as a short string a row compares by value. */
  rowMark: (id: string) => string;
  hover: (id: string | null) => void;
  focus: (id: string | null) => void;
  focusedId: () => string | null;
  drag: (id: string | null) => void;
  draggedId: () => string | null;
  drop: (drop: TreeDrop) => void;
  dropAt: () => TreeDrop;
};

export function createPageTreeUi(): PageTreeUi {
  let hoverId: string | null = null;
  let focusId: string | null = null;
  let dragId: string | null = null;
  let drop: TreeDrop = null;
  const listeners = createListeners();
  const set = (changed: boolean) => {
    if (changed) listeners.notify();
  };
  return {
    subscribe: listeners.subscribe,
    rowMark: (id) =>
      `${hoverId === id ? 'h' : ''}${focusId === id ? 'f' : ''}${dragId === id ? 'd' : ''}${
        drop?.id === id ? drop.zone : ''
      }`,
    hover: (id) => {
      const changed = hoverId !== id;
      hoverId = id;
      set(changed);
    },
    focus: (id) => {
      const changed = focusId !== id;
      focusId = id;
      set(changed);
    },
    focusedId: () => focusId,
    drag: (id) => {
      const changed = dragId !== id;
      dragId = id;
      set(changed);
    },
    draggedId: () => dragId,
    drop: (next) => {
      const changed = drop?.id !== next?.id || drop?.zone !== next?.zone;
      drop = next;
      set(changed);
    },
    dropAt: () => drop,
  };
}

const NO_MARK = () => '';

/** A row's own part of the tree's pointer and keyboard state: it renders only when this changes. */
export function useRowMark(ui: PageTreeUi, id: string): string {
  return useSyncExternalStore(ui.subscribe, () => ui.rowMark(id), NO_MARK);
}
