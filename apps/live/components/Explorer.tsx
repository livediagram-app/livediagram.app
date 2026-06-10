'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRelativeTimeTick } from '@/lib/relative-time';
import { MOBILE_BREAKPOINT_PX, isMobileViewportSync } from '@/lib/responsive';
import { MovablePanel } from './MovablePanel';
import { MoveToFolderDialog } from './MoveToFolderDialog';
import { SignInPrompt } from './SignInPrompt';
import { ConfirmPopover } from './ConfirmPopover';
import { Tooltip } from './Tooltip';
import { ExpandIcon, PlusIcon } from './explorer-icons';
import type { DiagramListItem, Folder, SharedWithItem } from '@/lib/api-client';
import type { TeamDiagramRow, TeamFolderRow } from '@/hooks/useTeamLibrariesSweep';
import {
  AccordionHeader,
  DiagramRow,
  FolderNode,
  SharedRow,
  TeamNode,
  UnsortedNode,
} from './explorer-views';

type ExplorerProps = {
  position: { x: number; y: number } | null;
  // Every diagram known to the local store. Current diagram is marked
  // active; clicking any other navigates to it (preserving the
  // current's state via the auto-save).
  diagrams: DiagramListItem[];
  // Every folder for the owner. Empty array = no user folders, but
  // the synthetic Unsorted bucket still renders. See spec/15.
  folders: Folder[];
  // Diagrams shared with the current owner (read-only or edit
  // visitor entries). Empty array hides the section entirely so
  // pure-private users don't see an empty accordion.
  shared?: SharedWithItem[];
  // Teams the signed-in user belongs to + their swept libraries
  // (spec/35). Drive the Teams accordion, team rows in Recent, and the
  // current-team-diagram row. Empty / omitted = no Teams section (the
  // common guest / no-teams case).
  teams?: { id: string; name: string }[];
  teamFolders?: TeamFolderRow[];
  teamDiagrams?: TeamDiagramRow[];
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
  // `beforeRemove` runs after the delete is confirmed and before the row is
  // pulled from the list, so the caller (Explorer) can slide it out first.
  // `opts.skipConfirm` is passed by the panel because it confirms inline
  // via ConfirmPopover (the modal would double-prompt).
  onDeleteDiagram?: (
    id: string,
    beforeRemove?: () => Promise<void> | void,
    opts?: { skipConfirm?: boolean },
  ) => void;
  onDuplicateDiagram?: (id: string) => void;
  // Folder mutations. Optional so read-only surfaces can omit them.
  onCreateFolder?: (input: { name: string; parentId: string | null }) => Promise<Folder | void>;
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
  // Mobile dock control — forwarded to the inner MovablePanel.
  mobileOpenOverride?: boolean;
  mobileTopOverridePx?: number;
  onMobileClose?: () => void;
  mobileDockAnchor?: { left: number; top: number; arrowOffset: number };
  forceDockMode?: boolean;
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
  teams = [],
  teamFolders = [],
  teamDiagrams = [],
  onDismissShared,
  onOpenFullExplorer,
  defaultRecentOpen = false,
  onSize,
  mobileOpenOverride,
  mobileTopOverridePx,
  onMobileClose,
  mobileDockAnchor,
  forceDockMode,
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
  // Teams accordion (spec/35), collapsed by default like Folders.
  const [teamsOpen, setTeamsOpen] = useState(false);
  // Expansion state for each folder node + Unsorted (keyed by
  // folder id, or the literal 'unsorted' for the synthetic bucket).
  // Team rows + team folders share this map too (ids are globally
  // unique). Defaults to all collapsed so the panel stays compact.
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  // When set, the diagram row whose Move dialog is open. Stored here
  // (vs. in DiagramRow) so the modal doesn't nest inside row portals.
  const [moveTargetDiagramId, setMoveTargetDiagramId] = useState<string | null>(null);
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
  // Inline delete confirmation: the row's menu hands up the id + its menu
  // button as the anchor; we open a ConfirmPopover beside it. Confirming
  // runs the delete (skipping the modal — the popover IS the confirm) and
  // slides the row out first via the beforeRemove hook.
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string } | null>(null);
  const deleteAnchorRef = useRef<HTMLElement | null>(null);
  const openDeleteConfirm = onDeleteDiagram
    ? (id: string, anchor: HTMLElement | null) => {
        deleteAnchorRef.current = anchor;
        setDeleteConfirm({ id });
      }
    : undefined;
  const runDelete = (id: string) => {
    if (!onDeleteDiagram) return;
    void onDeleteDiagram(
      id,
      () =>
        new Promise<void>((resolve) => {
          setExitingDiagramIds((prev) => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
          });
          window.setTimeout(resolve, 220);
        }),
      { skipConfirm: true },
    );
  };

  // Once a deleted diagram actually leaves the list, drop its id from the
  // exiting set. Pruning here (rather than clearing on the timeout) avoids a
  // one-frame flicker where the row would slide back in just before unmount,
  // and keeps the set from growing across repeated deletes.
  useEffect(() => {
    setExitingDiagramIds((prev) => {
      if (prev.size === 0) return prev;
      const present = new Set(diagrams.map((d) => d.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (present.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [diagrams]);

  // (Previously: `if (hideOnMobile) return null;` — Explorer now
  // renders on mobile too, banner-collapsed by default. The panel
  // sits at the top of the canvas above Palette + Editor.)

  // All derived collections below are useMemo'd against their real
  // inputs (diagrams, folders, currentDiagramId): Explorer holds a
  // pile of internal state (accordion open flags, expandedFolders,
  // moveTargetDiagramId, exitingDiagramIds, the 30s relative-time
  // tick from useRelativeTimeTick) that re-renders the component
  // frequently without changing the underlying lists. Without these
  // memos every accordion toggle rebuilt foldersByParent +
  // diagramsByFolder + sorted both, and re-walked the folder tree
  // just to render a different chevron.
  const current = useMemo(
    () => (currentDiagramId ? (diagrams.find((d) => d.id === currentDiagramId) ?? null) : null),
    [diagrams, currentDiagramId],
  );
  // When the open diagram lives in a team library it won't be in
  // `diagrams` (those are personal only). Fall back to the swept team
  // diagrams so the Current Diagram section renders for team diagrams.
  const currentTeam = useMemo(
    () =>
      !current && currentDiagramId
        ? (teamDiagrams.find((d) => d.id === currentDiagramId) ?? null)
        : null,
    [current, teamDiagrams, currentDiagramId],
  );
  // When the open diagram is shared (not owned / not team), it won't
  // appear in `diagrams` either. Fall back to the shared list so the
  // Current Diagram section still renders for visitors.
  const currentShared = useMemo(
    () =>
      !current && !currentTeam && currentDiagramId
        ? (shared.find((s) => s.id === currentDiagramId) ?? null)
        : null,
    [current, currentTeam, shared, currentDiagramId],
  );
  // Cap the recents list at 5 so the accordion stays compact.
  const RECENT_LIMIT = 5;
  // Recent mirrors the /explorer page (spec/35): personal + team +
  // shared diagrams, interleaved by recency, the current one excluded.
  // Tagged so the render picks the right row component per source.
  const recents = useMemo(() => {
    type RecentEntry =
      | {
          kind: 'own' | 'team';
          savedAt: number;
          d: DiagramListItem & { team?: { id: string; name: string } };
        }
      | { kind: 'shared'; savedAt: number; s: SharedWithItem };
    const own: RecentEntry[] = diagrams
      .filter((d) => d.id !== currentDiagramId)
      .map((d) => ({ kind: 'own', savedAt: d.savedAt, d }));
    const team: RecentEntry[] = teamDiagrams
      .filter((d) => d.id !== currentDiagramId)
      .map((d) => ({ kind: 'team', savedAt: d.savedAt, d }));
    const sharedEntries: RecentEntry[] = shared
      .filter((s) => s.id !== currentDiagramId)
      .map((s) => ({ kind: 'shared', savedAt: s.savedAt, s }));
    return [...own, ...team, ...sharedEntries]
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, RECENT_LIMIT);
  }, [diagrams, teamDiagrams, shared, currentDiagramId]);
  // This team's folder rows, indexed by team, for the Teams accordion.
  const foldersByTeam = useMemo(() => {
    const map = new Map<string, { id: string; name: string; parentId: string | null }[]>();
    for (const f of teamFolders) {
      const bucket = map.get(f.teamId) ?? [];
      bucket.push({ id: f.id, name: f.name, parentId: f.parentId });
      map.set(f.teamId, bucket);
    }
    return map;
  }, [teamFolders]);
  // This team's diagrams, indexed by team, so the Teams accordion can
  // show the diagrams inside each team folder (spec/35).
  const diagramsByTeam = useMemo(() => {
    const map = new Map<string, DiagramListItem[]>();
    for (const d of teamDiagrams) {
      const bucket = map.get(d.team.id) ?? [];
      bucket.push(d);
      map.set(d.team.id, bucket);
    }
    return map;
  }, [teamDiagrams]);

  // Folder tree: index folders by parentId so the recursive renderer
  // can ask for children by id without rescanning the full list.
  const foldersByParent = useMemo(() => {
    const map = new Map<string | null, Folder[]>();
    for (const f of folders) {
      const bucket = map.get(f.parentId) ?? [];
      bucket.push(f);
      map.set(f.parentId, bucket);
    }
    for (const bucket of map.values()) bucket.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [folders]);

  const diagramsByFolder = useMemo(() => {
    const map = new Map<string | null, DiagramListItem[]>();
    for (const d of diagrams) {
      const bucket = map.get(d.folderId) ?? [];
      bucket.push(d);
      map.set(d.folderId, bucket);
    }
    for (const bucket of map.values()) bucket.sort((a, b) => b.savedAt - a.savedAt);
    return map;
  }, [diagrams]);

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

  // The anchor argument survives in the row-callback signature (the
  // delete flow's ConfirmPopover still anchors), but the move flow is
  // a centred modal now (spec/15) and ignores it.
  const openMovePicker = (diagramId: string) => {
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
      mobileOpenOverride={mobileOpenOverride}
      mobileTopOverridePx={mobileTopOverridePx}
      onMobileClose={onMobileClose}
      mobileDockAnchor={mobileDockAnchor}
      forceDockMode={forceDockMode}
      // Mobile auto-collapse fires on any tap outside the panel's
      // DOM. Ellipsis menus (PortalMenu, role="menu") and confirm
      // modals (ConfirmDialog, role="dialog") render via React
      // portals into document.body, so a tap on "Rename" or "Delete"
      // counts as outside and would collapse the panel just as the
      // rename input is about to mount. Treat both ARIA roles as
      // "inside" so the user can finish the action they started.
      outsideExceptSelector='[role="menu"],[role="dialog"]'
      collapsible
    >
      <div className="flex flex-col gap-2 px-2.5 pb-2.5 pt-1">
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

        {(current ?? currentTeam ?? currentShared) ? (
          <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200/60 dark:bg-slate-800/50 dark:ring-slate-700/60">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white">
              Current Diagram
            </p>
            <ul className="flex flex-col gap-0.5 overflow-hidden">
              {current ? (
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
                      openDeleteConfirm
                        ? (anchor) => openDeleteConfirm(current.id, anchor)
                        : undefined
                    }
                    onDuplicate={
                      onDuplicateDiagram ? () => onDuplicateDiagram(current.id) : undefined
                    }
                    onMoveRequest={
                      onMoveDiagramToFolder ? () => openMovePicker(current.id) : undefined
                    }
                  />
                </li>
              ) : currentTeam ? (
                <li className="animate-slide-row-in overflow-hidden">
                  <DiagramRow
                    item={currentTeam}
                    active
                    onOpen={() => onOpenDiagram(currentTeam.id)}
                    onRename={onRenameCurrent}
                  />
                </li>
              ) : currentShared ? (
                <li className="animate-slide-row-in overflow-hidden">
                  <DiagramRow
                    item={{ ...currentShared, folderId: null, shareCode: null, ownerId: '' }}
                    active
                    onOpen={() => onOpenDiagram(currentShared.id, currentShared.shareCode)}
                  />
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {loading || recents.length > 0 ? (
          <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200/60 transition-colors hover:bg-slate-100 dark:bg-slate-800/50 dark:ring-slate-700/60 dark:hover:bg-slate-700/50">
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
                  {recents.map((entry) =>
                    entry.kind === 'shared' ? (
                      // A diagram shared with you: opens on the share
                      // link, dismissable — never the viewer's to
                      // rename / move / delete.
                      <SharedRow
                        key={entry.s.id}
                        item={entry.s}
                        active={false}
                        onOpen={() => onOpenDiagram(entry.s.id, entry.s.shareCode)}
                        onDismiss={onDismissShared ? () => onDismissShared(entry.s.id) : undefined}
                      />
                    ) : (
                      <li
                        key={entry.d.id}
                        className={
                          exitingDiagramIds.has(entry.d.id)
                            ? 'animate-slide-row-out overflow-hidden'
                            : 'animate-slide-row-in overflow-hidden'
                        }
                      >
                        <DiagramRow
                          item={entry.d}
                          active={false}
                          // Team diagrams (spec/35) open for any joined
                          // member; their rename / move / delete live
                          // on the /explorer page + team page, so the
                          // panel keeps team rows open-only.
                          draggable={entry.kind === 'own' && !!onMoveDiagramToFolder}
                          onOpen={() => onOpenDiagram(entry.d.id)}
                          onDelete={
                            entry.kind === 'own' && openDeleteConfirm
                              ? (anchor) => openDeleteConfirm(entry.d.id, anchor)
                              : undefined
                          }
                          onDuplicate={
                            entry.kind === 'own' && onDuplicateDiagram
                              ? () => onDuplicateDiagram(entry.d.id)
                              : undefined
                          }
                          onMoveRequest={
                            entry.kind === 'own' && onMoveDiagramToFolder
                              ? () => openMovePicker(entry.d.id)
                              : undefined
                          }
                        />
                      </li>
                    ),
                  )}
                </ul>
              )
            ) : null}
          </div>
        ) : null}

        {/* (The standalone "Shared with you" accordion was removed —
            shared diagrams now interleave into Recent above, matching
            the /explorer page, so a separate list was redundant.) */}

        {/* Folders section (spec/15). Hidden entirely when the
            owner has no diagrams AND no folders — an empty
            Unsorted bucket inside an empty Folders accordion was
            pure noise on a fresh account. Once any diagram exists
            the section comes back so Unsorted has a home; user-
            created folders also bring it back even before the
            first diagram so the create-folder action sticks. */}
        {diagrams.length === 0 && folders.length === 0 ? null : (
          <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200/60 transition-colors hover:bg-slate-100 dark:bg-slate-800/50 dark:ring-slate-700/60 dark:hover:bg-slate-700/50">
            <AccordionHeader
              label="My Work"
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
                    onDeleteDiagram={openDeleteConfirm}
                    exitingDiagramIds={exitingDiagramIds}
                    onDuplicateDiagram={onDuplicateDiagram}
                    onMoveDiagramRequest={
                      onMoveDiagramToFolder ? (id) => openMovePicker(id) : undefined
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
                    onDeleteDiagram={openDeleteConfirm}
                    exitingDiagramIds={exitingDiagramIds}
                    onDuplicateDiagram={onDuplicateDiagram}
                    onMoveDiagramRequest={
                      onMoveDiagramToFolder ? (id) => openMovePicker(id) : undefined
                    }
                    onMoveDiagramToFolder={onMoveDiagramToFolder}
                  />
                ) : null}
              </ul>
            ) : null}
          </div>
        )}

        {/* Teams accordion (spec/35). Mirrors Folders: each team
            expands to its folder tree; a click opens the full team
            page (at that folder). Hidden entirely when the user is in
            no teams (guests, solo users) so it isn't dead chrome. */}
        {teams.length > 0 ? (
          <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200/60 transition-colors hover:bg-slate-100 dark:bg-slate-800/50 dark:ring-slate-700/60 dark:hover:bg-slate-700/50">
            <AccordionHeader
              label="Teams"
              badge={teams.length}
              open={teamsOpen}
              onToggle={() => setTeamsOpen((v) => !v)}
            />
            {teamsOpen ? (
              <ul className="flex flex-col gap-0.5">
                {teams.map((t) => (
                  <TeamNode
                    key={t.id}
                    team={t}
                    folders={foldersByTeam.get(t.id) ?? []}
                    diagrams={diagramsByTeam.get(t.id) ?? []}
                    currentDiagramId={currentDiagramId}
                    expanded={expandedFolders}
                    onToggleExpanded={toggleFolder}
                    onOpenDiagram={(id) => onOpenDiagram(id)}
                    onOpenTeam={(teamId) =>
                      window.location.assign(`/live/explorer/team?id=${encodeURIComponent(teamId)}`)
                    }
                  />
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {/* The sign-in prompt and the "Open Explorer" button share this
            slot: the prompt owns it for signed-out guests who haven't
            dismissed it, and hands it to the button (its `fallback`) once
            the user signs in or dismisses the prompt — so the button still
            surfaces for guests without ever stacking under the prompt. */}
        <SignInPrompt
          fallback={
            onOpenFullExplorer ? (
              <button
                type="button"
                onClick={onOpenFullExplorer}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15 dark:hover:text-brand-200"
              >
                <ExpandIcon />
                Open Explorer
              </button>
            ) : null
          }
        />
      </div>

      {/* Move-destination modal (spec/15), shared with the /explorer
          page. The panel scopes it to personal folders: team moves
          (spec/35) live on the full explorer page. */}
      {moveTargetDiagramId && onMoveDiagramToFolder ? (
        <MoveToFolderDialog
          subjectName={diagrams.find((d) => d.id === moveTargetDiagramId)?.name || 'Untitled'}
          subjectKind="diagram"
          personalRootLabel="Unsorted"
          personalFolders={folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId }))}
          currentFolderId={diagrams.find((d) => d.id === moveTargetDiagramId)?.folderId ?? null}
          onPick={({ folderId }) => {
            onMoveDiagramToFolder(moveTargetDiagramId, folderId);
          }}
          onClose={() => setMoveTargetDiagramId(null)}
        />
      ) : null}

      {deleteConfirm && deleteAnchorRef.current ? (
        <ConfirmPopover
          anchor={deleteAnchorRef.current}
          message={`Delete "${
            diagrams.find((d) => d.id === deleteConfirm.id)?.name || 'this diagram'
          }"? Its tabs, history and share links go with it.`}
          confirmLabel="Delete"
          onConfirm={() => {
            const id = deleteConfirm.id;
            setDeleteConfirm(null);
            runDelete(id);
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      ) : null}
    </MovablePanel>
  );
}
