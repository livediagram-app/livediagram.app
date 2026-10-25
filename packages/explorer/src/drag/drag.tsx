'use client';

// Drag and drop in the Explorer (liveplanner's explorer-drag-mime, useProjectDropTarget, useExplorerDropTarget and
// TrashSidebarRow, docs/specs/013-workspace/folders.md "Drag-and-drop" and explorer-structure.md "Dragging to the
// Trash"). An item the person can manage drags from its row or card and drops on a folder (in the sidebar, the
// pane or the panel's rail), on My Work (its root) or on a team; the drop takes the Change Folder path (the same
// optimistic move and rollback) and says where it went, with an Undo. Anything that drags also drops on the Trash,
// which wakes as a target for the whole drag: an item through its own Delete (with its Undo), one of the person's
// folders through Delete Folder (with its confirmation). Folders are not moved by dragging.
//
// Drags carry custom types, so dropping one outside any target (the page, the URL bar, another app) does nothing
// rather than navigating. A target can read only a drag's types until the drop, so what is being dragged is held
// here, for this Explorer, from dragstart to dragend; a drag from another tab or window carries the types but no
// session, and nothing takes it. The session is an external store, so a drag's start and end re-render only the
// targets (the Trash wakes while anything drags), never the rows and cards it starts from.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
} from 'react';
import type { Folder, Item } from '@liveworkspace/index-client';
import { useExplorer } from '../explorer/context';
import { canManage } from '../explorer/menus';
import { useDragging, useDragStore } from './store';

export { useDragging } from './store';

export const ITEM_DRAG_MIME = 'application/x-liveworkspace-item';
export const FOLDER_DRAG_MIME = 'application/x-liveworkspace-folder';

// How long a drag rests on an expandable row before it opens under it (spring-loaded folders open after about half
// a second to a second; long enough that a drag passing over a row on its way elsewhere never opens it).
export const DRAG_HOVER_OPEN_MS = 800;
// How long the Trash's swallow bounce lasts (the motion budget's ceiling).
export const TRASH_GULP_MS = 250;
export const TRASH_DROP_COPY = { waiting: 'Drop to Trash', over: 'Let go to trash it' } as const;

export type DropPlace = { teamId: string | null; folderId: string | null };

type SourceProps = {
  draggable?: true;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: () => void;
};

/** What a row or card spreads to drag its item: only one the person manages, live, and not being renamed. */
export function useItemDrag(item: Item, renaming = false): SourceProps {
  const store = useDragStore();
  if (renaming || item.trashedAt !== null || !canManage(item)) return {};
  return {
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.setData(ITEM_DRAG_MIME, item.id);
      e.dataTransfer.effectAllowed = 'move';
      store.set({ kind: 'item', item });
    },
    onDragEnd: () => store.set(null),
  };
}

/** What a folder card or row spreads to drag it to the Trash: one of the person's own, not being renamed. */
export function useFolderDrag(folder: Folder | null, renaming = false): SourceProps {
  const store = useDragStore();
  if (!folder || renaming || folder.teamId) return {};
  return {
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.setData(FOLDER_DRAG_MIME, folder.id);
      e.dataTransfer.effectAllowed = 'move';
      store.set({ kind: 'folder', folder });
    },
    onDragEnd: () => store.set(null),
  };
}

const hasType = (e: DragEvent, type: string) => Array.from(e.dataTransfer.types).includes(type);

type DropHandlers = {
  onDragEnter: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
};

/**
 * Enter/leave bookkeeping for a target: a drag crossing into the target's own children fires enter (child) then
 * leave (target), so enters are counted against leaves to tell that from really leaving (relatedTarget is
 * unreliable on drag events).
 */
function useHover(accepts: (e: DragEvent) => boolean) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const reset = useCallback(() => {
    depth.current = 0;
    setOver(false);
  }, []);
  return {
    over,
    reset,
    enter: (e: DragEvent) => {
      if (!accepts(e)) return false;
      depth.current += 1;
      return true;
    },
    overIt: (e: DragEvent) => {
      if (!accepts(e)) return false;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!over) setOver(true);
      return true;
    },
    // True once the drag has really left.
    leave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current > 0) return false;
      setOver(false);
      return true;
    },
  };
}

/** Moves a dropped item to a place, the way Change Folder does; the move says so, with an Undo. */
export function useDropMove() {
  const { actions, overlay } = useExplorer();
  return useCallback(
    async (dragged: Item, to: DropPlace): Promise<boolean> => {
      const item = overlay.apply(dragged);
      if (item.teamId === to.teamId && item.folderId === to.folderId) return false;
      return actions.move(item, to);
    },
    [actions, overlay],
  );
}

/**
 * A place that takes a dragged item: a folder, My Work, or a team (null takes nothing). While an item is over it,
 * `over` is true for the highlight; `onLongHover` runs once when the drag rests there DRAG_HOVER_OPEN_MS (a closed
 * row opens under it), and again only after the drag has left and come back.
 */
export function useDropTarget(
  to: DropPlace | null,
  { onLongHover }: { onLongHover?: () => void } = {},
): { over: boolean; handlers: DropHandlers | Record<string, never> } {
  const store = useDragStore();
  const move = useDropMove();
  const accepts = (e: DragEvent) =>
    to !== null && hasType(e, ITEM_DRAG_MIME) && store.get()?.kind === 'item';
  const hover = useHover(accepts);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opened = useRef(false);
  const longHover = useRef(onLongHover);
  useEffect(() => {
    longHover.current = onLongHover;
  });
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => () => clearTimer(), []);
  // A drag that ends anywhere leaves the target as it was.
  const dragging = useSyncExternalStore(
    store.subscribe,
    () => store.get() !== null,
    () => false,
  );
  const { over, reset } = hover;
  useEffect(() => {
    if (!dragging && over) {
      clearTimer();
      opened.current = false;
      reset();
    }
  }, [dragging, over, reset]);

  if (to === null) return { over: false, handlers: {} };
  return {
    over: hover.over,
    handlers: {
      onDragEnter: (e) => void hover.enter(e),
      onDragOver: (e) => {
        if (!hover.overIt(e)) return;
        if (longHover.current && !timer.current && !opened.current) {
          timer.current = setTimeout(() => {
            timer.current = null;
            opened.current = true;
            longHover.current?.();
          }, DRAG_HOVER_OPEN_MS);
        }
      },
      onDragLeave: () => {
        if (!hover.leave()) return;
        clearTimer();
        opened.current = false;
      },
      onDrop: (e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        // Take it so a host's own drop handling (a canvas under a floating panel) stands aside.
        e.stopPropagation();
        const payload = store.get();
        clearTimer();
        opened.current = false;
        reset();
        store.set(null);
        if (payload?.kind === 'item') void move(payload.item, to);
      },
    },
  };
}

export type TrashTargetState = 'rest' | 'waiting' | 'over' | 'gulp';

/**
 * The Trash as a target: waiting (dashed, "Drop to Trash") while anything drags anywhere in this Explorer, open
 * ("Let go to trash it") while the drag is over it, and one short bounce as it swallows an item. Never red: the Trash
 * is undoable.
 */
export function useTrashTarget(): {
  state: TrashTargetState;
  words: string | null;
  handlers: DropHandlers;
} {
  const store = useDragStore();
  const { actions, openDialog } = useExplorer();
  const dragging = useDragging();
  const accepts = (e: DragEvent) =>
    store.get() !== null && (hasType(e, ITEM_DRAG_MIME) || hasType(e, FOLDER_DRAG_MIME));
  const hover = useHover(accepts);
  const [gulp, setGulp] = useState(false);
  const { over, reset } = hover;
  useEffect(() => {
    if (!dragging && over) reset();
  }, [dragging, over, reset]);
  useEffect(() => {
    if (!gulp) return;
    const t = setTimeout(() => setGulp(false), TRASH_GULP_MS);
    return () => clearTimeout(t);
  }, [gulp]);

  const state: TrashTargetState = gulp
    ? 'gulp'
    : dragging && over
      ? 'over'
      : dragging
        ? 'waiting'
        : 'rest';
  const words =
    state === 'over' ? TRASH_DROP_COPY.over : state === 'waiting' ? TRASH_DROP_COPY.waiting : null;
  return {
    state,
    words,
    handlers: {
      onDragEnter: (e) => {
        if (hover.enter(e)) hover.overIt(e);
      },
      onDragOver: (e) => void hover.overIt(e),
      onDragLeave: () => void hover.leave(),
      onDrop: (e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.stopPropagation();
        const payload = store.get();
        reset();
        store.set(null);
        if (!payload) return;
        if (payload.kind === 'item') {
          setGulp(true);
          void actions.trash(payload.item);
        } else {
          openDialog({ kind: 'delete-folder', folderId: payload.folder.id });
        }
      },
    },
  };
}

// The highlight a table row wears while an item is over it (a box wears DROP_TARGET_RING): a row paints no
// box-shadow, so an inset outline and a tint.
export const DROP_ROW =
  'bg-brand-50 outline-2 -outline-offset-2 outline-brand-400 dark:bg-brand-500/15';

// The Trash row's looks while it waits and while a drag is over it.
export const TRASH_WAITING =
  'border-dashed !border-brand-400 bg-brand-50/70 dark:!border-brand-400/60 dark:bg-brand-400/10';
export const TRASH_OVER =
  '!border-brand-700 !bg-brand-700 shadow-[0_10px_24px_-10px_color-mix(in_oklab,var(--color-brand-700)_70%,transparent)] motion-safe:scale-[1.03] dark:!border-brand-600 dark:!bg-brand-600';
export const TRASH_BIN: Record<TrashTargetState, string> = {
  rest: '',
  waiting: '',
  over: 'text-white motion-safe:-rotate-12 motion-safe:scale-110',
  gulp: 'motion-safe:scale-125',
};
