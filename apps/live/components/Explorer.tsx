'use client';

import { useEffect, useRef, useState } from 'react';
import { useRelativeTimeTick } from '@/lib/relative-time';
import { MOBILE_BREAKPOINT_PX, isMobileViewportSync } from '@/lib/responsive';
import { MovablePanel } from './MovablePanel';
import { MenuItem, PortalMenu } from './PortalMenu';
import { SignInPrompt } from './SignInPrompt';
import { Tooltip } from './Tooltip';
import { ExpandIcon, FolderIcon, PlusIcon, UnsortedIcon } from './explorer-icons';
import {
  AccordionHeader,
  DiagramRow,
  FolderNode,
  SharedRow,
  UnsortedNode,
  type DiagramListItem,
  type FolderItem,
  type SharedItem,
} from './explorer-views';

type ExplorerProps = {
  position: { x: number; y: number } | null;
  // Every diagram known to the local store. Current diagram is marked
  // active; clicking any other navigates to it (preserving the
  // current's state via the auto-save).
  diagrams: DiagramListItem[];
  // Every folder for the owner. Empty array = no user folders, but
  // the synthetic Unsorted bucket still renders. See spec/15.
  folders: FolderItem[];
  // Diagrams shared with the current owner (read-only or edit
  // visitor entries). Empty array hides the section entirely so
  // pure-private users don't see an empty accordion.
  shared?: SharedItem[];
  // Dismiss a single Shared row — drops the shared_with reference
  // server-side so the row no longer surfaces. Optional so consumers
  // that haven't wired the api endpoint can omit it.
  onDismissShared?: (diagramId: string) => void;
  // Navigate to the standalone /live/explorer page. When set, the
  // panel header surfaces an "Expand" button next to the title.
  // Optional because pure-guest surfaces (no Clerk) could leave it
  // off — the standalone route gates itself with a sign-in CTA
  // either way, so passing it is safe even when the user isn't
  // signed in.
  onOpenFullExplorer?: () => void;
  // True while the initial diagram-list fetch is in flight. Shows a
  // skeleton in place of the list so the panel doesn't read as "no
  // diagrams" before the API call resolves.
  loading: boolean;
  currentDiagramId: string | null;
  onMoveTo: (x: number, y: number) => void;
  onReset: () => void;
  onOpenDiagram: (id: string, shareCode?: string) => void;
  // Optional so consumers that have nowhere to mint a new diagram
  // (e.g. the welcome route, which IS the new-diagram flow) can hide
  // the button entirely. When omitted the row isn't rendered.
  onNewDiagram?: () => void;
  // Optional row-level actions. When provided, each row renders an
  // ellipsis menu that delegates to these handlers.
  onRenameCurrent?: (name: string) => void;
  onDeleteDiagram?: (id: string) => void;
  onDuplicateDiagram?: (id: string) => void;
  // Folder mutations. Optional so read-only surfaces can omit them.
  onCreateFolder?: (input: { name: string; parentId: string | null }) => Promise<FolderItem | void>;
  onRenameFolder?: (id: string, name: string) => void;
  onDeleteFolder?: (id: string) => void;
  onMoveDiagramToFolder?: (diagramId: string, folderId: string | null) => void;
  // Initial open state for the Recent accordion. Defaults to
  // collapsed so the panel stays compact, but the welcome /
  // /live/new surface flips this to true when there are recent
  // diagrams so a returning user lands looking at their library.
  defaultRecentOpen?: boolean;
  // Callback the Canvas wires up to track Explorer's bottom edge so
  // the Palette can stack beneath it on mobile (where Explorer
  // banner-pins to the top of the viewport rather than the left
  // corner). Optional: desktop layout doesn't need it.
  onSize?: (size: { width: number; height: number; bottomY: number }) => void;
};

// Floating "Explorer" panel pinned to the top-left of the canvas by
// default. Symmetric to the Palette in shape and behaviour.
export function Explorer({
  position,
  diagrams,
  folders,
  loading,
  currentDiagramId,
  onMoveTo,
  onReset,
  onOpenDiagram,
  onNewDiagram,
  onRenameCurrent,
  onDeleteDiagram,
  onDuplicateDiagram,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveDiagramToFolder,
  shared = [],
  onDismissShared,
  onOpenFullExplorer,
  defaultRecentOpen = false,
  onSize,
}: ExplorerProps) {
  // Mobile viewport ⇒ render nothing. Mobile users reach the
  // Explorer from the AuthControls "Explorer" menu item (spec/07)
  // instead, freeing the small canvas of the floating panel and
  // its bottom-dock entry point. Tracked in state + a media-query
  // listener so a desktop → mobile resize / device-rotate flips
  // the panel without a page reload. Initial value reads sync so
  // the static-export build doesn't paint a desktop-shaped panel
  // a tick before the effect runs.
  // Mobile-aware flag, kept up-to-date via a matchMedia listener so a
  // device rotation / desktop-to-mobile resize repositions correctly.
  // Previously Explorer was hidden entirely on mobile (the canvas is
  // small enough that the panel ate the whole screen), but signed-out
  // users had no other way to switch diagrams, so the panel now also
  // shows on mobile, banner-collapsed at the very top of the viewport
  // above the Palette + Editor stack.
  const [isMobile, setIsMobile] = useState(isMobileViewportSync);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    if (!mq) return;
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const [sharedOpen, setSharedOpen] = useState(false);
  // Re-render every 30s so the "Updated X ago" strings stay fresh
  // while the panel is open. Cheap when the panel is minimised (this
  // function returns early below before the interval is set up).
  useRelativeTimeTick();
  // Default to collapsed so the panel stays compact when the user
  // has lots of diagrams. The header badge surfaces the count even
  // when the list isn't visible.
  const [recentOpen, setRecentOpen] = useState(defaultRecentOpen);
  // Auto-open Recent the first time `defaultRecentOpen` flips true.
  // The /new page passes `defaultRecentOpen={diagramList.length > 0}`,
  // but diagramList only populates after the API roundtrip, so the
  // initial useState fires with `false` and Recent stays closed.
  // Watching the prop with a one-shot guard means a returning user
  // sees their library expanded the moment it loads, while a manual
  // close later sticks (the ref blocks re-opens).
  const autoOpenedRecentRef = useRef(defaultRecentOpen);
  useEffect(() => {
    if (defaultRecentOpen && !autoOpenedRecentRef.current) {
      autoOpenedRecentRef.current = true;
      setRecentOpen(true);
    }
  }, [defaultRecentOpen]);
  const [foldersOpen, setFoldersOpen] = useState(false);
  // Expansion state for each folder node + Unsorted (keyed by
  // folder id, or the literal 'unsorted' for the synthetic bucket).
  // Defaults to all collapsed so the panel stays compact on load.
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  // When set, the diagram row whose Move menu is open. Stored here
  // (vs. in DiagramRow) so the picker portals don't nest.
  const [moveTargetDiagramId, setMoveTargetDiagramId] = useState<string | null>(null);
  const moveAnchorRef = useRef<HTMLElement | null>(null);
  // Folder id newly created via the New folder button — used to drop
  // the row into rename mode immediately after the API returns.
  const [pendingRenameFolderId, setPendingRenameFolderId] = useState<string | null>(null);
  // Diagrams currently mid slide-out animation. Adding the id to this
  // set switches the row's <li> className from animate-slide-row-in to
  // animate-slide-row-out for ~220ms, then we forward the real delete
  // to the parent so the row is removed from the underlying
  // `diagrams` prop. Without the delay the row disappears instantly
  // and a fresh "5 with the same name" Explorer feels unresponsive.
  const [exitingDiagramIds, setExitingDiagramIds] = useState<Set<string>>(new Set());
  const wrappedDeleteDiagram = onDeleteDiagram
    ? (id: string) => {
        setExitingDiagramIds((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        window.setTimeout(() => {
          onDeleteDiagram(id);
          setExitingDiagramIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 220);
      }
    : undefined;

  // (Previously: `if (hideOnMobile) return null;` — Explorer now
  // renders on mobile too, banner-collapsed by default. The panel
  // sits at the top of the canvas above Palette + Editor.)

  const current = currentDiagramId
    ? (diagrams.find((d) => d.id === currentDiagramId) ?? null)
    : null;
  // Cap the recents list at 5 so the accordion stays compact.
  const RECENT_LIMIT = 5;
  const allOthers = [...diagrams]
    .filter((d) => d.id !== currentDiagramId)
    .sort((a, b) => b.savedAt - a.savedAt);
  const recents = allOthers.slice(0, RECENT_LIMIT);

  // Folder tree: index folders by parentId so the recursive renderer
  // can ask for children by id without rescanning the full list.
  const foldersByParent = new Map<string | null, FolderItem[]>();
  for (const f of folders) {
    const bucket = foldersByParent.get(f.parentId) ?? [];
    bucket.push(f);
    foldersByParent.set(f.parentId, bucket);
  }
  for (const bucket of foldersByParent.values())
    bucket.sort((a, b) => a.name.localeCompare(b.name));

  const diagramsByFolder = new Map<string | null, DiagramListItem[]>();
  for (const d of diagrams) {
    const bucket = diagramsByFolder.get(d.folderId) ?? [];
    bucket.push(d);
    diagramsByFolder.set(d.folderId, bucket);
  }
  for (const bucket of diagramsByFolder.values()) bucket.sort((a, b) => b.savedAt - a.savedAt);

  // Flat list of every folder with its breadcrumb path. Used as the
  // "Move to folder…" picker options. Built depth-first so children
  // appear under their parents in the dropdown.
  const folderPathPicker: { id: string; path: string }[] = [];
  const walk = (parentId: string | null, prefix: string[]) => {
    for (const f of foldersByParent.get(parentId) ?? []) {
      const path = [...prefix, f.name];
      folderPathPicker.push({ id: f.id, path: path.join(' / ') });
      walk(f.id, path);
    }
  };
  walk(null, []);

  const toggleFolder = (key: string) =>
    setExpandedFolders((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleCreateRoot = async () => {
    if (!onCreateFolder) return;
    const folder = await onCreateFolder({ name: 'New folder', parentId: null });
    if (folder) {
      setFoldersOpen(true);
      setPendingRenameFolderId(folder.id);
    }
  };

  const handleCreateChild = async (parentId: string) => {
    if (!onCreateFolder) return;
    const folder = await onCreateFolder({ name: 'New folder', parentId });
    if (folder) {
      setExpandedFolders((prev) => ({ ...prev, [parentId]: true }));
      setPendingRenameFolderId(folder.id);
    }
  };

  const openMovePicker = (diagramId: string, anchor: HTMLElement | null) => {
    moveAnchorRef.current = anchor;
    setMoveTargetDiagramId(diagramId);
  };

  return (
    <MovablePanel
      title="Explorer"
      position={position}
      // On mobile the panel becomes a full-width top banner (matches
      // the Palette / Editor pattern) so users can switch diagrams
      // without leaving the canvas. On desktop it stays in the
      // top-left corner.
      defaultCorner={isMobile ? 'top-banner' : 'top-left'}
      width={isMobile ? 'w-auto' : 'w-64'}
      onReset={onReset}
      onMoveTo={onMoveTo}
      onSize={onSize}
      collapsible
    >
      <div className="flex flex-col gap-2.5 px-3 pb-3 pt-1">
        {onNewDiagram ? (
          <button
            type="button"
            onClick={onNewDiagram}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:border-brand-400 hover:bg-brand-100 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-200 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20"
          >
            <PlusIcon />
            New diagram
          </button>
        ) : null}

        {current ? (
          <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200/60 dark:bg-slate-800/50 dark:ring-slate-700/60">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Current Diagram
            </p>
            <ul className="flex flex-col gap-0.5 overflow-hidden">
              <li
                className={
                  exitingDiagramIds.has(current.id)
                    ? 'animate-slide-row-out overflow-hidden'
                    : 'animate-slide-row-in overflow-hidden'
                }
              >
                <DiagramRow
                  item={current}
                  active
                  draggable={!!onMoveDiagramToFolder}
                  onOpen={() => onOpenDiagram(current.id)}
                  onRename={onRenameCurrent}
                  onDelete={
                    wrappedDeleteDiagram ? () => wrappedDeleteDiagram(current.id) : undefined
                  }
                  onDuplicate={
                    onDuplicateDiagram ? () => onDuplicateDiagram(current.id) : undefined
                  }
                  onMoveRequest={
                    onMoveDiagramToFolder
                      ? (anchor) => openMovePicker(current.id, anchor)
                      : undefined
                  }
                />
              </li>
            </ul>
          </div>
        ) : null}

        {loading || recents.length > 0 ? (
          <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200/60 dark:bg-slate-800/50 dark:ring-slate-700/60">
            <AccordionHeader
              label="Recent"
              badge={loading ? null : recents.length}
              open={recentOpen}
              onToggle={() => setRecentOpen((v) => !v)}
            />
            {recentOpen ? (
              loading ? (
                <ul className="flex flex-col gap-1" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <li
                      key={i}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1.5"
                      aria-hidden
                    >
                      <span className="h-3 w-3 shrink-0 animate-pulse rounded-sm bg-slate-200" />
                      <span
                        className="h-3 animate-pulse rounded bg-slate-200"
                        style={{ width: `${70 - i * 12}%` }}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="scrollbar-slim flex max-h-60 flex-col gap-0.5 overflow-y-auto">
                  {recents.map((d) => (
                    <li
                      key={d.id}
                      className={
                        exitingDiagramIds.has(d.id)
                          ? 'animate-slide-row-out overflow-hidden'
                          : 'animate-slide-row-in overflow-hidden'
                      }
                    >
                      <DiagramRow
                        item={d}
                        active={false}
                        draggable={!!onMoveDiagramToFolder}
                        onOpen={() => onOpenDiagram(d.id)}
                        onDelete={
                          wrappedDeleteDiagram ? () => wrappedDeleteDiagram(d.id) : undefined
                        }
                        onDuplicate={
                          onDuplicateDiagram ? () => onDuplicateDiagram(d.id) : undefined
                        }
                        onMoveRequest={
                          onMoveDiagramToFolder
                            ? (anchor) => openMovePicker(d.id, anchor)
                            : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        ) : null}

        {/* Shared-with-you accordion. Only renders when the api has
            surfaced at least one entry — empty state would just be
            a noisy "Shared (0)" line on every user's first ever
            session. Entries come from the shared_with table
            (migration 0010) — bumped every time the visitor opens
            a share link for a diagram they don't own. */}
        {shared.length > 0 ? (
          <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200/60 dark:bg-slate-800/50 dark:ring-slate-700/60">
            <AccordionHeader
              label="Shared with you"
              badge={shared.length}
              open={sharedOpen}
              onToggle={() => setSharedOpen((v) => !v)}
            />
            {sharedOpen ? (
              <ul className="flex flex-col gap-0.5">
                {shared.map((s) => (
                  <SharedRow
                    key={s.id}
                    item={s}
                    active={s.id === currentDiagramId}
                    onOpen={() => onOpenDiagram(s.id, s.shareCode)}
                    onDismiss={onDismissShared ? () => onDismissShared(s.id) : undefined}
                  />
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {/* Folders section (spec/15). Hidden entirely when the
            owner has no diagrams AND no folders — an empty
            Unsorted bucket inside an empty Folders accordion was
            pure noise on a fresh account. Once any diagram exists
            the section comes back so Unsorted has a home; user-
            created folders also bring it back even before the
            first diagram so the create-folder action sticks. */}
        {diagrams.length === 0 && folders.length === 0 ? null : (
          <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200/60 dark:bg-slate-800/50 dark:ring-slate-700/60">
            <AccordionHeader
              label="Folders"
              badge={folders.length}
              open={foldersOpen}
              onToggle={() => setFoldersOpen((v) => !v)}
              trailing={
                onCreateFolder ? (
                  <Tooltip title="New folder" description="Add a root-level folder.">
                    <button
                      type="button"
                      aria-label="New folder"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleCreateRoot();
                      }}
                      className="flex h-4 w-4 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    >
                      <PlusIcon />
                    </button>
                  </Tooltip>
                ) : null
              }
            />
            {foldersOpen ? (
              <ul className="flex flex-col gap-0.5">
                {(foldersByParent.get(null) ?? []).map((f) => (
                  <FolderNode
                    key={f.id}
                    folder={f}
                    depth={0}
                    foldersByParent={foldersByParent}
                    diagramsByFolder={diagramsByFolder}
                    expanded={expandedFolders}
                    onToggleExpanded={toggleFolder}
                    currentDiagramId={currentDiagramId}
                    pendingRenameId={pendingRenameFolderId}
                    onRenameFolderCommitted={() => setPendingRenameFolderId(null)}
                    onOpenDiagram={onOpenDiagram}
                    onRenameFolder={onRenameFolder}
                    onDeleteFolder={onDeleteFolder}
                    onCreateChild={handleCreateChild}
                    onDeleteDiagram={wrappedDeleteDiagram}
                    exitingDiagramIds={exitingDiagramIds}
                    onDuplicateDiagram={onDuplicateDiagram}
                    onMoveDiagramRequest={
                      onMoveDiagramToFolder ? (id, anchor) => openMovePicker(id, anchor) : undefined
                    }
                    onMoveDiagramToFolder={onMoveDiagramToFolder}
                  />
                ))}
                {(diagramsByFolder.get(null) ?? []).length > 0 ? (
                  <UnsortedNode
                    expanded={expandedFolders}
                    onToggleExpanded={toggleFolder}
                    diagrams={diagramsByFolder.get(null) ?? []}
                    currentDiagramId={currentDiagramId}
                    onOpenDiagram={onOpenDiagram}
                    onDeleteDiagram={wrappedDeleteDiagram}
                    exitingDiagramIds={exitingDiagramIds}
                    onDuplicateDiagram={onDuplicateDiagram}
                    onMoveDiagramRequest={
                      onMoveDiagramToFolder ? (id, anchor) => openMovePicker(id, anchor) : undefined
                    }
                    onMoveDiagramToFolder={onMoveDiagramToFolder}
                  />
                ) : null}
              </ul>
            ) : null}
          </div>
        )}

        {onOpenFullExplorer ? (
          <button
            type="button"
            onClick={onOpenFullExplorer}
            className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15 dark:hover:text-brand-200"
          >
            <ExpandIcon />
            Open Explorer
          </button>
        ) : null}

        <SignInPrompt />
      </div>

      {moveTargetDiagramId && onMoveDiagramToFolder ? (
        <PortalMenu
          anchor={moveAnchorRef.current}
          placement="below"
          onClose={() => setMoveTargetDiagramId(null)}
        >
          <MenuItem
            icon={<UnsortedIcon />}
            label="Unsorted"
            onClick={() => {
              onMoveDiagramToFolder(moveTargetDiagramId, null);
              setMoveTargetDiagramId(null);
            }}
          />
          {folderPathPicker.map((f) => (
            <MenuItem
              key={f.id}
              icon={<FolderIcon />}
              label={f.path}
              onClick={() => {
                onMoveDiagramToFolder(moveTargetDiagramId, f.id);
                setMoveTargetDiagramId(null);
              }}
            />
          ))}
        </PortalMenu>
      ) : null}
    </MovablePanel>
  );
}
