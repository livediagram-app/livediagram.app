'use client';

import { useEffect, useRef, useState } from 'react';
import { PROJECT_DRAG_MIME, PROJECT_LOCAL_ONLY_DRAG_MIME } from './explorer-drag-mime';

// How long a dragged project rests on an expandable row before the row opens
// (or closes) under it (docs/specs/013-workspace/folders.md "Drag-and-drop").
// Spring-loaded folders in desktop file managers open after roughly half a
// second to a second; 800 ms sits in that range, long enough that a drag
// passing over a row on its way elsewhere never toggles it. Safe range
// 500-1500 ms.
export const DRAG_HOVER_TOGGLE_MS = 800;

// The brand-blue ring a place wears while a project is dragged over it.
export const DROP_TARGET_RING = 'ring-2 ring-brand-400';
// The same ring for a table row, which paints no box-shadow: an inset outline, and a tint.
export const DROP_TARGET_ROW =
  'bg-brand-50 outline-2 -outline-offset-2 outline-brand-400 dark:bg-brand-500/15';

// A place that takes a project dragged onto it (docs/specs/013-workspace/folders.md): a folder
// row, My Projects, a team, a folder card. Returns the hover-highlight flag plus the
// three drag handlers the element spreads on.
//
// - `onDropProject`: files the dropped project; absent = this place takes no drops.
// - `onLongHover`: called once when a drag has rested here for DRAG_HOVER_TOGGLE_MS; again
//   only after the drag has left and come back. An expandable row opens or closes with it.
// - `refuseLocalOnly`: a team's library can't take a project that lives only in this browser.
//
// dataTransfer.types is consulted rather than the data, which a target can't read until the
// drop; so a stray text drag from another application never triggers the hover styling.
// dropEffect is 'move' so the pointer shows a move cursor rather than the no-entry slash.
// A drag crossing into the element's own children fires enter (child) then leave (element):
// counting enters against leaves tells that apart from really leaving, where relatedTarget
// is unreliable on drag events.
export function useProjectDropTarget(
  onDropProject?: (projectId: string) => void,
  {
    onLongHover,
    refuseLocalOnly = false,
  }: { onLongHover?: () => void; refuseLocalOnly?: boolean } = {},
): {
  isDragOver: boolean;
  handlers: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
} {
  const [isDragOver, setIsDragOver] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether this hover has already toggled the row, so resting longer never toggles it back.
  const toggled = useRef(false);
  // Enters minus leaves while a drag is over the element or any of its children.
  const depth = useRef(0);
  const longHover = useRef(onLongHover);
  useEffect(() => {
    longHover.current = onLongHover;
  });

  const endHover = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    toggled.current = false;
    depth.current = 0;
    setIsDragOver(false);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const accepts = (e: React.DragEvent) =>
    !!onDropProject &&
    e.dataTransfer.types.includes(PROJECT_DRAG_MIME) &&
    !(refuseLocalOnly && e.dataTransfer.types.includes(PROJECT_LOCAL_ONLY_DRAG_MIME));

  return {
    isDragOver,
    handlers: {
      onDragEnter: (e) => {
        if (accepts(e)) depth.current += 1;
      },
      onDragOver: (e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!isDragOver) setIsDragOver(true);
        if (onLongHover && !timer.current && !toggled.current) {
          timer.current = setTimeout(() => {
            timer.current = null;
            toggled.current = true;
            longHover.current?.();
          }, DRAG_HOVER_TOGGLE_MS);
        }
      },
      onDragLeave: () => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) endHover();
      },
      onDrop: (e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        const id = e.dataTransfer.getData(PROJECT_DRAG_MIME);
        endHover();
        if (id) onDropProject?.(id);
      },
    },
  };
}
