'use client';

import { useState } from 'react';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import type { DiagramListItem } from '@/lib/api-client';
import { relativeSince } from '@/lib/relative-time';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { DiagramActionsMenu } from '@/app/explorer/diagram-row-shared';
import { DiagramThumbnail } from '@/components/panels/DiagramThumbnail';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { DIAGRAM_DRAG_MIME } from './explorer-drag-mime';

export function DiagramRow({
  item,
  ownerId,
  active,
  onOpen,
  onRename,
  onDelete,
  onDuplicate,
  onMoveRequest,
  recentExcluded,
  onToggleRecentExclusion,
  onShowHistory,
  favourite,
  onToggleFavourite,
  thumbnailShareCode,
  draggable: isDraggable,
}: {
  item: DiagramListItem;
  // The VIEWER's owner id (self/participant id) for the authenticated
  // thumbnail fetch — NOT item.ownerId (that's the diagram's owner, and
  // it's blanked for shared rows).
  ownerId: string | null;
  // Share code used ONLY to authorise the thumbnail fetch (spec/67) when
  // it isn't carried on item.shareCode — e.g. the "currently open shared
  // diagram" row, where item.shareCode is intentionally nulled. Falls
  // back to item.shareCode.
  thumbnailShareCode?: string | null;
  active: boolean;
  onOpen: () => void;
  onRename?: (name: string) => void;
  // Asks the parent to open the delete-confirm popover anchored to the
  // passed element (the row's menu button) — see onMoveRequest.
  onDelete?: (anchor: HTMLElement | null) => void;
  onDuplicate?: () => void;
  // Asks the parent Explorer to open the "Move to folder…" picker
  // anchored to the supplied element. Stored at the panel level so
  // the portal isn't nested inside another PortalMenu.
  onMoveRequest?: (anchor: HTMLElement | null) => void;
  // Hide / show in Recent (spec/93). Per-user, so the label reflects THIS
  // viewer's state; absent where the surface can't offer it.
  recentExcluded?: boolean;
  onToggleRecentExclusion?: () => void;
  // Opens this diagram's own Timeline (spec/138 §3.4) — who changed
  // what, and when. Absent on surfaces that can't host the dialog.
  onShowHistory?: () => void;
  // Per-user star (spec/95).
  favourite?: boolean;
  onToggleFavourite?: () => void;
  // Set true on rows the user can drag into folders. The actual
  // drop handling lives on FolderNode + UnsortedNode; this row just
  // sets the custom MIME data so a drop target knows what was
  // dragged.
  draggable?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const hasMenu = Boolean(onRename || onDelete || onDuplicate || onMoveRequest);
  // Right-click opens the menu too, except mid-rename or on a row without one.
  const menu = useRowMenu({ disabled: !hasMenu || editing });

  const commitRename = (name: string) => {
    const next = name.trim();
    if (next && next !== item.name && onRename) onRename(next);
    setEditing(false);
  };

  const relative = relativeSince(item.savedAt);
  // Offline Mode (spec/76): an offline diagram's row carries ownerId
  // 'offline', which drives the fixed offline thumbnail.
  const offline = item.ownerId === OFFLINE_OWNER_ID;

  const pillClasses = active
    ? 'group flex items-stretch rounded-md bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-100'
    : 'group flex items-stretch rounded-md text-slate-700 transition hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800';

  // The row's main area is a clickable <button> when not editing
  // (clicking the row opens the diagram). When editing it has to
  // become a plain <div>: nesting an <input> inside a <button> is
  // invalid HTML and browsers redirect focus to the parent button,
  // which is the original cause of the "rename input won't take
  // focus" bug.
  const mainClass = `flex min-w-0 flex-1 items-start gap-1.5 rounded-md bg-transparent px-2 py-1.5 text-left text-xs ${active ? 'font-medium' : ''}`;
  const mainInner = (
    <>
      <DiagramThumbnail
        ownerId={ownerId}
        diagramId={item.id}
        version={item.savedAt}
        shareCode={thumbnailShareCode ?? item.shareCode}
        offline={offline}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        {editing ? (
          <InlineRenameInput
            initial={item.name}
            onCommit={commitRename}
            onCancel={() => setEditing(false)}
            className="w-full rounded border border-brand-300 bg-white px-1 py-0.5 text-xs text-slate-800 dark:border-brand-400 dark:bg-slate-800 dark:text-slate-100"
          />
        ) : (
          <span className="min-w-0 truncate">{item.name}</span>
        )}
        <span
          className={
            active
              ? 'truncate text-[10px] font-normal text-brand-700/80 dark:text-brand-200/80'
              : 'truncate text-[10px] text-slate-400 dark:text-white'
          }
        >
          Updated {relative}
        </span>
      </span>
    </>
  );

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(DIAGRAM_DRAG_MIME, item.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className={pillClasses}
      draggable={isDraggable && !editing}
      onDragStart={isDraggable && !editing ? handleDragStart : undefined}
      // Right-click anywhere on the row opens the same actions menu as the
      // ellipsis button (anchored to it).
      onContextMenu={menu.onContextMenu}
    >
      {editing ? (
        <div className={mainClass}>{mainInner}</div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          aria-current={active ? 'true' : undefined}
          className={mainClass}
        >
          {mainInner}
        </button>
      )}
      {hasMenu && !editing ? (
        <EllipsisTriggerButton
          {...menu.triggerProps}
          size="md"
          reveal
          className="mr-1 self-center"
          label="Diagram menu"
        />
      ) : null}
      {/* The same actions menu as the Explorer page's rows and cards
          (spec/67), so a diagram has one menu wherever it's listed. The
          panel used to carry its own toolbar-and-accordion menu with a
          Share section; sharing is the editor header's job, and a menu
          that looked like no other was one people had to learn twice.
          What this surface can't offer (a star, history, Recent) is
          simply not passed, and the menu leaves those tiles out. */}
      {menu.open ? (
        <DiagramActionsMenu
          diagram={item}
          anchor={menu.triggerRef.current}
          ownerId={ownerId}
          onClose={menu.close}
          isOpen={active}
          onOpen={onOpen}
          // Only the open diagram's row renames inline (its title is the
          // editor's), so only it offers Rename; the menu leaves out any
          // verb this row has no handler for.
          onStartRename={onRename ? () => setEditing(true) : undefined}
          onDuplicate={onDuplicate}
          // Hand the menu button up as the anchor so the panel can open the
          // move picker / delete-confirm popover beside it.
          onMove={
            onMoveRequest ? (anchor) => onMoveRequest(anchor ?? menu.triggerRef.current) : undefined
          }
          onDelete={onDelete ? () => onDelete(menu.triggerRef.current) : undefined}
          favourite={favourite}
          onToggleFavourite={onToggleFavourite}
          recentExcluded={recentExcluded}
          onToggleRecentExclusion={onToggleRecentExclusion}
          onShowHistory={onShowHistory}
        />
      ) : null}
    </div>
  );
}
