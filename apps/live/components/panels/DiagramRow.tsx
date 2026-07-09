'use client';

import { useRef, useState } from 'react';
import type { DiagramListItem } from '@/lib/api-client';
import { relativeSince } from '@/lib/relative-time';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import {
  MenuAccordionSection,
  MenuGroupSeparator,
  MenuTile,
  MenuToolbar,
  MenuToolButton,
  PortalMenu,
} from '@/components/primitives/PortalMenu';
import {
  DuplicateIcon,
  FolderIcon,
  OpenIcon,
  PencilIcon,
  SharedDiagramIcon,
  TrashIcon,
} from '@/components/panels/explorer-icons';
import { DiagramThumbnail } from '@/components/panels/DiagramThumbnail';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { saveOfflineToCloud, takeCloudOffline } from '@/lib/offline/offline-convert';
import { DIAGRAM_DRAG_MIME } from './explorer-drag-mime';

// Icons for the Offline section, matching the explorer-icons style
// (12×12, viewBox 14, 1.4 stroke) so the tiles read like the rest.
function OfflineDotIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 10.5h5.4a2.2 2.2 0 0 0 .3-4.4 3 3 0 0 0-5.2-1.1A2.1 2.1 0 0 0 4 10.5Z" />
      <path d="M2.5 2.5l9 9" />
    </svg>
  );
}

function CloudUpIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4.2 11h5.4a2.3 2.3 0 0 0 .3-4.6 3.1 3.1 0 0 0-5.8-.7A2.2 2.2 0 0 0 4.2 11Z" />
      <path d="M7 9.5V6m0 0L5.7 7.3M7 6l1.3 1.3" />
    </svg>
  );
}

function TakeOfflineIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 2v5.5m0 0L4.9 5.4M7 7.5l2.1-2.1" />
      <path d="M2.75 9.25v1.5a1 1 0 0 0 1 1h6.5a1 1 0 0 0 1-1v-1.5" />
    </svg>
  );
}

export function DiagramRow({
  item,
  ownerId,
  active,
  onOpen,
  onRename,
  onDelete,
  onDuplicate,
  onMoveRequest,
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
  // Set true on rows the user can drag into folders. The actual
  // drop handling lives on FolderNode + UnsortedNode; this row just
  // sets the custom MIME data so a drop target knows what was
  // dragged.
  draggable?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  // Which menu category is open — at most one at a time (matches the tab /
  // element context menus).
  const [openSection, setOpenSection] = useState<string | null>(null);
  const sectionProps = (id: string) => ({
    open: openSection === id,
    onToggle: () => setOpenSection((s) => (s === id ? null : id)),
    flush: true,
  });
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const commitRename = (name: string) => {
    const next = name.trim();
    if (next && next !== item.name && onRename) onRename(next);
    setEditing(false);
  };

  // "Manage Sharing…" opens the diagram with the Share dialog already up
  // (the editor reads `?share=1`); sharing lives in the editor's full Share
  // dialog rather than being reimplemented in the panel.
  const openShareSettings = () => {
    if (typeof window === 'undefined') return;
    window.location.assign(`${window.location.origin}/diagram/${item.id}?share=1`);
  };

  // Offline Mode conversions (spec/76). Reload after so the list reflects the
  // moved diagram. Guarded on a resolved viewer id.
  const [converting, setConverting] = useState(false);
  const handleSaveToCloud = async () => {
    if (!ownerId || converting) return;
    setMenuOpen(false);
    setConverting(true);
    try {
      await saveOfflineToCloud(item.id, ownerId);
      window.location.reload();
    } catch {
      setConverting(false);
    }
  };
  const handleTakeOffline = async () => {
    if (!ownerId || converting) return;
    setMenuOpen(false);
    const ok = window.confirm(
      `Take “${item.name}” offline?\n\nThis removes it from your account and every other device. It will exist only in this browser, with no backup.`,
    );
    if (!ok) return;
    setConverting(true);
    try {
      await takeCloudOffline(item.id, ownerId, item.shareCode ?? null);
      window.location.reload();
    } catch {
      setConverting(false);
    }
  };

  const hasMenu = Boolean((onRename && active) || onDelete || onDuplicate || onMoveRequest);
  const relative = relativeSince(item.savedAt);
  // Offline Mode (spec/76): an offline diagram's row carries ownerId
  // 'offline'. Drives the fixed offline thumbnail, the "Offline" chip, and
  // hiding the Share action (there's nothing on a server to share).
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
      // ellipsis button (anchored to it). Guarded so it's a no-op while
      // renaming or when the row has no menu.
      onContextMenu={
        hasMenu && !editing
          ? (e) => {
              e.preventDefault();
              setMenuOpen(true);
            }
          : undefined
      }
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
        <button
          ref={menuButtonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          aria-label="Diagram menu"
          aria-expanded={menuOpen}
          className={`mr-1 flex w-6 shrink-0 items-center justify-center self-center rounded text-slate-400 opacity-100 transition hover:bg-slate-200/70 hover:text-slate-700 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 ${
            menuOpen ? 'opacity-100' : ''
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <circle cx="3" cy="7" r="1.25" fill="currentColor" />
            <circle cx="7" cy="7" r="1.25" fill="currentColor" />
            <circle cx="11" cy="7" r="1.25" fill="currentColor" />
          </svg>
        </button>
      ) : null}
      {menuOpen ? (
        <PortalMenu
          anchor={menuButtonRef.current}
          placement="below"
          onClose={() => {
            setMenuOpen(false);
            setOpenSection(null);
          }}
        >
          {/* Quick-action toolbar (matches the tab context menu): the verbs
              reached for most often as a compact icon row, Delete pinned to
              the right edge. The verbose actions group into the categories
              below. */}
          <MenuToolbar>
            {!active ? (
              <MenuToolButton
                icon={<OpenIcon />}
                label="Open"
                description="Open this diagram."
                onClick={() => {
                  onOpen();
                  setMenuOpen(false);
                }}
              />
            ) : null}
            {active && onRename ? (
              <MenuToolButton
                icon={<PencilIcon />}
                label="Rename"
                description="Rename this diagram."
                onClick={() => {
                  setEditing(true);
                  setMenuOpen(false);
                }}
              />
            ) : null}
            {onDuplicate ? (
              <MenuToolButton
                icon={<DuplicateIcon />}
                label="Duplicate"
                description="Create a copy of this diagram."
                onClick={() => {
                  onDuplicate();
                  setMenuOpen(false);
                }}
              />
            ) : null}
            {onDelete ? (
              <div className="ml-auto">
                <MenuToolButton
                  icon={<TrashIcon />}
                  label="Delete"
                  description="Delete this diagram. It can't be recovered."
                  danger
                  onClick={() => {
                    // Hand the menu button up as the anchor so the panel can
                    // open the delete-confirm popover beside it (same pattern
                    // as Move to folder…).
                    onDelete(menuButtonRef.current);
                    setMenuOpen(false);
                  }}
                />
              </div>
            ) : null}
          </MenuToolbar>
          {/* Separator under the toolbar (matches the tab context menu). */}
          <MenuGroupSeparator />
          {onMoveRequest ? (
            <MenuAccordionSection
              title="Organise"
              icon={<FolderIcon />}
              {...sectionProps('organise')}
            >
              <div className="px-2 py-1.5">
                <MenuTile
                  icon={<FolderIcon />}
                  label="Change Folder"
                  onClick={() => {
                    onMoveRequest(menuButtonRef.current);
                    setMenuOpen(false);
                  }}
                />
              </div>
            </MenuAccordionSection>
          ) : null}
          {/* Offline diagrams (spec/76) can't be shared — hide the section. */}
          {offline ? null : (
            <MenuAccordionSection
              title="Share"
              icon={<SharedDiagramIcon />}
              {...sectionProps('share')}
            >
              <div className="px-2 py-1.5">
                <MenuTile
                  icon={<SharedDiagramIcon />}
                  label={item.shareCode ? 'Manage Sharing' : 'Share'}
                  onClick={() => {
                    openShareSettings();
                    setMenuOpen(false);
                  }}
                />
              </div>
            </MenuAccordionSection>
          )}
          {/* Offline Mode conversions (spec/76): move this diagram between the
              cloud and this browser. Needs a resolved viewer id. */}
          {ownerId ? (
            <MenuAccordionSection
              title="Offline"
              icon={<OfflineDotIcon />}
              {...sectionProps('offline')}
            >
              <div className="px-2 py-1.5">
                {offline ? (
                  <MenuTile
                    icon={<CloudUpIcon />}
                    label="Sync Diagram"
                    onClick={() => void handleSaveToCloud()}
                  />
                ) : (
                  <MenuTile
                    icon={<TakeOfflineIcon />}
                    label="Take Offline"
                    onClick={() => void handleTakeOffline()}
                  />
                )}
              </div>
            </MenuAccordionSection>
          ) : null}
        </PortalMenu>
      ) : null}
    </div>
  );
}

// --- Teams accordion nodes (spec/35) ---------------------------------
