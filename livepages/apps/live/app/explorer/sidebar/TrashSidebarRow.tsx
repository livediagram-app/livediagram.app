'use client';

import { useEffect, useRef, useState } from 'react';
import { TrashIcon } from '@/components/primitives/explorer-icons';
import {
  DOCUMENT_DRAG_MIME,
  FOLDER_DRAG_MIME,
  explorerDragKind,
} from '@/components/panels/explorer-drag-mime';
import { useExplorer } from '../ExplorerContext';
import { useExplorerDragging } from '../useExplorerDragging';
import { SIDEBAR_LABELS } from './sidebar-structure';
import { trackSidebar } from './sidebar-telemetry';
import { SidebarRow } from './SidebarRow';

// The sidebar's Trash row (docs/specs/013-workspace/explorer-structure.md "Dragging to the Trash"): it opens the Trash,
// and while a document or folder is dragged anywhere on the page it wakes as a target, the way Plan mode's Trash takes
// a card. Dashed with "Drop to Trash" while the drag is elsewhere; filled with the brand colour, its bin's lid tipped
// and "Let go to trash it" while the drag is over it; one short bounce as it swallows the drop. A drop goes through
// the item's own Delete: a document to the Trash (with its Undo toast), a folder through Delete Folder (with its
// confirmation, the bounce waiting on it: a cancelled folder is not swallowed). Never red: the Trash is undoable. Motion settles within the 250 ms budget; under reduced motion only
// the colours and words change.

/** How long the bin's swallow bounce lasts (the motion budget's ceiling). */
export const TRASH_GULP_MS = 250;

export const TRASH_DROP_COPY = { waiting: 'Drop to Trash', over: 'Let go to trash it' } as const;

const DRAGGING_ROW =
  'border-dashed border-amber-400 bg-amber-50/70 dark:border-amber-400/60 dark:bg-amber-400/10';
const OVER_ROW =
  'border-brand-700 bg-brand-700 shadow-[0_10px_24px_-10px_rgba(163,74,12,0.7)] motion-safe:scale-[1.03] dark:border-brand-600 dark:bg-brand-600';

export function TrashSidebarRow() {
  const { selected, go, folders, folderActions, deleteDocument } = useExplorer();
  const dragging = useExplorerDragging();
  const [over, setOver] = useState(false);
  const [gulp, setGulp] = useState(false);
  // Enters minus leaves while a drag is over the row or any of its children (useDocumentDropTarget's count).
  const depth = useRef(0);

  // A drag that ends anywhere leaves the row as it was.
  const [lastDragging, setLastDragging] = useState(dragging);
  if (lastDragging !== dragging) {
    setLastDragging(dragging);
    if (!dragging && over) setOver(false);
  }
  useEffect(() => {
    if (!dragging) depth.current = 0;
  }, [dragging]);
  useEffect(() => {
    if (!gulp) return;
    const timer = setTimeout(() => setGulp(false), TRASH_GULP_MS);
    return () => clearTimeout(timer);
  }, [gulp]);

  const accepts = (e: React.DragEvent) => explorerDragKind([...e.dataTransfer.types]) !== null;

  const drop = (e: React.DragEvent) => {
    const kind = explorerDragKind([...e.dataTransfer.types]);
    if (!kind) return;
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    if (kind === 'document') {
      const id = e.dataTransfer.getData(DOCUMENT_DRAG_MIME);
      if (!id) return;
      trackSidebar('TrashDropDocument');
      setGulp(true);
      void deleteDocument(id);
      return;
    }
    const folder = folders.find((f) => f.id === e.dataTransfer.getData(FOLDER_DRAG_MIME));
    if (!folder) {
      console.warn('[explorer-trash-drop] unknown folder; nothing deleted');
      return;
    }
    trackSidebar('TrashDropFolder');
    void folderActions(folder, null)
      .delete()
      .then((deleted) => {
        if (deleted) setGulp(true);
      });
  };

  const target = dragging !== null;
  const words = over
    ? TRASH_DROP_COPY.over
    : target
      ? TRASH_DROP_COPY.waiting
      : SIDEBAR_LABELS.trash;
  return (
    <SidebarRow
      icon={
        <span
          data-trash-bin={gulp ? 'gulp' : over ? 'tipped' : 'rest'}
          className={`flex transition-transform duration-short ease-out ${over ? 'text-white' : ''} ${
            gulp
              ? 'motion-safe:scale-125'
              : over
                ? 'motion-safe:-rotate-12 motion-safe:scale-110'
                : ''
          }`}
        >
          <TrashIcon />
        </span>
      }
      label={
        <>
          <span
            className={
              over ? 'font-semibold text-white' : target ? 'text-amber-800 dark:text-amber-200' : ''
            }
          >
            {words}
          </span>
          {/* The target's words for assistive technology, as they change; the row keeps its name, Trash. */}
          <span role="status" aria-live="polite" className="sr-only">
            {target ? words : ''}
          </span>
        </>
      }
      textLabel={SIDEBAR_LABELS.trash}
      selected={selected.kind === 'trash'}
      onActivate={() => {
        trackSidebar('Trash');
        go({ kind: 'trash' });
      }}
      depth={0}
      rowClassName={over ? OVER_ROW : target ? DRAGGING_ROW : undefined}
      rowProps={{
        // Entering opens it up at once; dragover keeps it open and makes the drop allowed.
        onDragEnter: (e) => {
          if (!accepts(e)) return;
          depth.current += 1;
          if (!over) setOver(true);
        },
        onDragOver: (e) => {
          if (!accepts(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (!over) setOver(true);
        },
        onDragLeave: () => {
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) setOver(false);
        },
        onDrop: drop,
      }}
    />
  );
}
