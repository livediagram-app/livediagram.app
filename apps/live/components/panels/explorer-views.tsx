'use client';

import { DiagramThumbnail } from '@/components/panels/DiagramThumbnail';

// Presentational primitives for the floating Explorer panel
// (apps/live/components/Explorer.tsx). Lifted here so the
// Explorer component itself can focus on data flow + the panel
// shell, and so this file can group the 5 row / node primitives
// that cross-reference each other (FolderNode renders DiagramRow,
// UnsortedNode renders DiagramRow). Same pattern as the route's
// app/explorer/views.tsx split: stateless or near-stateless
// renderers that take their data + callbacks via props.
//
// Mirror of (not duplicate with) app/explorer/views.tsx: the
// route's full-page list view has its own DiagramRow / FolderRow
// shape (grid layout, dropdown menu, no drag), whereas this file
// owns the floating-panel shape (pill rows, drag source / drop
// target, recursive tree). The two coexist by design.

import { useState } from 'react';
// Row data shapes come straight from the api client (the same rows
// apiListDiagrams / useFolders / apiListSharedWith return) so the
// panel and the /explorer route can't drift apart on what a list
// item carries.
import type { DiagramListItem, SharedWithItem } from '@/lib/api-client';
import { relativeSince, useRelativeTimeTick } from '@/lib/relative-time';
import { Tooltip } from '@/components/primitives/Tooltip';
import {
  ChevronIcon,
  OfflineFolderIcon,
  RemoveIcon,
  UnsortedIcon,
} from '@/components/panels/explorer-icons';
import { DIAGRAM_DRAG_MIME } from './explorer-drag-mime';
import { DiagramRow } from './DiagramRow';

export { FolderNode } from './FolderNode';
export { DiagramRow };

// Synthetic root-level "Unsorted" folder. Holds every diagram with
// folder_id IS NULL. Can't be renamed or deleted.
export function UnsortedNode({
  ownerId,
  expanded,
  onToggleExpanded,
  diagrams,
  currentDiagramId,
  onOpenDiagram,
  onDeleteDiagram,
  exitingDiagramIds,
  onDuplicateDiagram,
  onMoveDiagramRequest,
  onMoveDiagramToFolder,
}: {
  // The VIEWER's owner id, threaded down to each DiagramRow for its
  // authenticated thumbnail fetch.
  ownerId: string | null;
  expanded: Record<string, boolean>;
  onToggleExpanded: (key: string) => void;
  diagrams: DiagramListItem[];
  currentDiagramId: string | null;
  onOpenDiagram: (id: string, shareCode?: string) => void;
  onDeleteDiagram?: (id: string, anchor: HTMLElement | null) => void;
  exitingDiagramIds: Set<string>;
  onDuplicateDiagram?: (id: string) => void;
  onMoveDiagramRequest?: (diagramId: string, anchor: HTMLElement | null) => void;
  // Drop target callback; receives `null` as the folder id to drop
  // the diagram back to root (Unsorted is the synthetic null folder).
  onMoveDiagramToFolder?: (diagramId: string, folderId: string | null) => void;
}) {
  const isExpanded = expanded['unsorted'] ?? false;
  const [isDragOver, setIsDragOver] = useState(false);

  // Same drop wiring as FolderNode but the move callback gets a
  // null folderId so the diagram lands in Unsorted (the root
  // bucket).
  const acceptsDrop = (e: React.DragEvent) =>
    !!onMoveDiagramToFolder && e.dataTransfer.types.includes(DIAGRAM_DRAG_MIME);
  const handleDragOver = (e: React.DragEvent) => {
    if (!acceptsDrop(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };
  const handleDragLeave = () => {
    if (isDragOver) setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    if (!acceptsDrop(e)) return;
    e.preventDefault();
    const id = e.dataTransfer.getData(DIAGRAM_DRAG_MIME);
    setIsDragOver(false);
    if (id && onMoveDiagramToFolder) onMoveDiagramToFolder(id, null);
  };

  return (
    <li>
      <div
        className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800 ${
          isDragOver ? 'ring-2 ring-brand-400 ring-inset bg-brand-50 dark:bg-brand-500/15' : ''
        }`}
        onDragOver={onMoveDiagramToFolder ? handleDragOver : undefined}
        onDragLeave={onMoveDiagramToFolder ? handleDragLeave : undefined}
        onDrop={onMoveDiagramToFolder ? handleDrop : undefined}
      >
        <button
          type="button"
          onClick={() => onToggleExpanded('unsorted')}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse Unsorted' : 'Expand Unsorted'}
          className="flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <span
            className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
            aria-hidden
          >
            <ChevronIcon />
          </span>
        </button>
        <span className="text-slate-400 dark:text-slate-400">
          <UnsortedIcon />
        </span>
        <button
          type="button"
          onClick={() => onToggleExpanded('unsorted')}
          className="flex min-w-0 flex-1 items-center gap-1 truncate text-left"
        >
          <span className="truncate italic text-slate-500 dark:text-white">Unsorted</span>
          <span className="inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-white">
            {diagrams.length}
          </span>
        </button>
      </div>
      {isExpanded ? (
        <ul className="flex flex-col gap-0.5">
          {diagrams.map((d) => (
            <li
              key={d.id}
              style={{ paddingLeft: 16 }}
              className={
                exitingDiagramIds.has(d.id)
                  ? 'animate-slide-row-out overflow-hidden'
                  : 'animate-slide-row-in overflow-hidden'
              }
            >
              <DiagramRow
                item={d}
                ownerId={ownerId}
                active={d.id === currentDiagramId}
                draggable={!!onMoveDiagramToFolder}
                onOpen={() => onOpenDiagram(d.id)}
                onDelete={onDeleteDiagram ? (anchor) => onDeleteDiagram(d.id, anchor) : undefined}
                onDuplicate={onDuplicateDiagram ? () => onDuplicateDiagram(d.id) : undefined}
                onMoveRequest={
                  onMoveDiagramRequest ? (anchor) => onMoveDiagramRequest(d.id, anchor) : undefined
                }
              />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

// Synthetic "Offline" folder (spec/76): every diagram saved only in this
// browser, mirroring the /explorer route's dynamic Offline folder. Always
// rendered (even empty) so the local-only bucket stays discoverable. Not a
// drop target: moving a cloud diagram offline is the explicit, confirmed
// Take Offline action, never a drag.
export function OfflineNode({
  ownerId,
  expanded,
  onToggleExpanded,
  diagrams,
  currentDiagramId,
  onOpenDiagram,
  onDeleteDiagram,
  exitingDiagramIds,
  onDuplicateDiagram,
  onMoveDiagramRequest,
}: {
  ownerId: string | null;
  expanded: Record<string, boolean>;
  onToggleExpanded: (key: string) => void;
  diagrams: DiagramListItem[];
  currentDiagramId: string | null;
  onOpenDiagram: (id: string, shareCode?: string) => void;
  onDeleteDiagram?: (id: string, anchor: HTMLElement | null) => void;
  exitingDiagramIds: Set<string>;
  onDuplicateDiagram?: (id: string) => void;
  onMoveDiagramRequest?: (diagramId: string, anchor: HTMLElement | null) => void;
}) {
  const isExpanded = expanded['offline'] ?? false;
  return (
    <li>
      <div className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800">
        <button
          type="button"
          onClick={() => onToggleExpanded('offline')}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse Offline' : 'Expand Offline'}
          className="flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <span
            className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
            aria-hidden
          >
            <ChevronIcon />
          </span>
        </button>
        <span className="text-amber-500">
          <OfflineFolderIcon />
        </span>
        <button
          type="button"
          onClick={() => onToggleExpanded('offline')}
          className="flex min-w-0 flex-1 items-center gap-1 truncate text-left"
        >
          <span className="truncate italic text-slate-500 dark:text-white">Offline</span>
          <span className="inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-white">
            {diagrams.length}
          </span>
        </button>
      </div>
      {isExpanded ? (
        diagrams.length === 0 ? (
          <p className="px-8 py-1.5 text-[10px] text-slate-400 dark:text-slate-500">
            Diagrams saved only in this browser collect here.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {diagrams.map((d) => (
              <li
                key={d.id}
                style={{ paddingLeft: 16 }}
                className={
                  exitingDiagramIds.has(d.id)
                    ? 'animate-slide-row-out overflow-hidden'
                    : 'animate-slide-row-in overflow-hidden'
                }
              >
                <DiagramRow
                  item={d}
                  ownerId={ownerId}
                  active={d.id === currentDiagramId}
                  onOpen={() => onOpenDiagram(d.id)}
                  onDelete={onDeleteDiagram ? (anchor) => onDeleteDiagram(d.id, anchor) : undefined}
                  onDuplicate={onDuplicateDiagram ? () => onDuplicateDiagram(d.id) : undefined}
                  onMoveRequest={
                    onMoveDiagramRequest
                      ? (anchor) => onMoveDiagramRequest(d.id, anchor)
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )
      ) : null}
    </li>
  );
}

// One row in the "Shared with you" accordion. Visually similar to
// the recents list but stripped of folder / move / duplicate menu
// affordances: the visitor doesn't own these diagrams, so the
// only meaningful actions are "open" and "dismiss this row from my
// list." A small role pill ("View" / "Edit") communicates what they
// can do once they're in.
export function SharedRow({
  item,
  active,
  ownerId,
  onOpen,
  onDismiss,
}: {
  item: SharedWithItem;
  active: boolean;
  // Viewer identity for the thumbnail fetch (the share code authorises
  // the read; see DiagramThumbnail).
  ownerId: string | null;
  onOpen: () => void;
  onDismiss?: () => void;
}) {
  useRelativeTimeTick();
  const relative = relativeSince(item.savedAt);
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition ${
          active
            ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
            : 'hover:bg-slate-50 text-slate-700 dark:text-white dark:hover:bg-slate-800'
        }`}
      >
        {/* The real preview, like every owned row — the share code
            authorises the snapshot read, so shared rows are no longer a
            generic glyph while the full-page Shared list shows previews. */}
        <DiagramThumbnail
          ownerId={ownerId}
          diagramId={item.id}
          version={item.savedAt}
          shareCode={item.shareCode}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{item.name}</span>
          {/* Tight meta line: just the role + relative-time.
              Owner attribution + "Updated" lived here before but
              read too dense in a narrow column; role is the load-
              bearing affordance and the timestamp grounds it. */}
          <span className="block truncate text-[10px] text-slate-500 dark:text-white">
            {item.role === 'edit' ? 'Edit' : 'View'} · {relative}
          </span>
        </span>
      </button>
      {onDismiss ? (
        <div className="absolute right-1.5 top-1.5 block sm:hidden sm:group-hover:block sm:group-focus-within:block">
          <Tooltip title="Remove" description="Drop this from your Shared list.">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              aria-label={`Remove ${item.name} from Shared`}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1 text-slate-500 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
            >
              <RemoveIcon />
            </button>
          </Tooltip>
        </div>
      ) : null}
    </li>
  );
}

// --- Teams accordion nodes (spec/35) ---------------------------------
