'use client';

import { useState } from 'react';
import type { DiagramListItem, Folder } from '@/lib/api-client';
import {
  DiagramRow,
  FolderNode,
  OfflineNode,
  SharedRow,
  UnsortedNode,
} from '@/components/panels/explorer-views';
import { ChevronIcon, DynamicFolderIcon } from '@/components/panels/explorer-icons';
import { ExplorerTabBar, type ExplorerTab } from '@/components/panels/ExplorerTabBar';
import { TeamNode } from '@/components/panels/explorer-team-views';
import type { useExplorerViewModel } from './useExplorerViewModel';

type ExplorerViewModel = ReturnType<typeof useExplorerViewModel>;

// The Explorer panel's tabbed sections card (Recent / My Work / Teams),
// lifted out of Explorer: the tab-bar state (pick + collapse), the
// which-tab-earns-a-slot guards, and the three section lists. Explorer
// keeps the data + row handlers and passes them in; the card owns only
// its own tab UI state, so it renders (or hides) without the host
// tracking any of it.
export function ExplorerSections({
  loading,
  ownerId,
  currentDiagramId,
  diagrams,
  folders,
  teams,
  recents,
  foldersByParent,
  diagramsByFolder,
  offlineDiagrams,
  foldersByTeam,
  diagramsByTeam,
  expandedFolders,
  onToggleFolder,
  pendingRenameFolderId,
  onRenameFolderCommitted,
  exitingDiagramIds,
  onOpenDiagram,
  onDismissShared,
  onRenameFolder,
  onDeleteFolder,
  onCreateChild,
  onDeleteDiagram,
  onDuplicateDiagram,
  onMoveDiagramRequest,
  onMoveDiagramToFolder,
}: {
  loading: boolean;
  ownerId: string | null;
  currentDiagramId: string | null;
  diagrams: DiagramListItem[];
  folders: Folder[];
  teams: { id: string; name: string }[];
  recents: ExplorerViewModel['recents'];
  foldersByParent: ExplorerViewModel['foldersByParent'];
  diagramsByFolder: ExplorerViewModel['diagramsByFolder'];
  offlineDiagrams: ExplorerViewModel['offlineDiagrams'];
  foldersByTeam: ExplorerViewModel['foldersByTeam'];
  diagramsByTeam: ExplorerViewModel['diagramsByTeam'];
  expandedFolders: Record<string, boolean>;
  onToggleFolder: (key: string) => void;
  pendingRenameFolderId: string | null;
  onRenameFolderCommitted: () => void;
  exitingDiagramIds: Set<string>;
  onOpenDiagram: (id: string, shareCode?: string) => void;
  onDismissShared?: (diagramId: string) => void;
  onRenameFolder?: (id: string, name: string) => void;
  onDeleteFolder?: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  onDeleteDiagram?: (id: string, anchor: HTMLElement | null) => void;
  onDuplicateDiagram?: (id: string) => void;
  onMoveDiagramRequest?: (diagramId: string) => void;
  onMoveDiagramToFolder?: (diagramId: string, folderId: string | null) => void;
}) {
  // The three sections (Recent / My Work / Teams) are a single tab bar
  // instead of three stacked accordions, so only one list takes
  // vertical space at a time. `selectedTab` is the user's pick; the
  // section actually rendered falls back to the first available tab
  // when the pick isn't currently shown (Teams hidden for a solo user,
  // Recent empty on a fresh account), resolved just before the return.
  const [selectedTab, setSelectedTab] = useState<string>('recent');
  // Re-clicking the active tab collapses the section list (the tab bar
  // stays put), like toggling an accordion shut; clicking any tab while
  // collapsed reopens it. Selecting a different tab always expands.
  // Starts collapsed so the panel opens compact — just the tab bar,
  // no list — until the user picks a section.
  const [tabsCollapsed, setTabsCollapsed] = useState(true);

  // Available section tabs, in display order. A section only earns a
  // tab when it has something to show — these guards mirror the old
  // per-accordion render conditions exactly, so nothing that used to
  // appear disappears and an empty section never becomes dead chrome.
  const sectionTabs: ExplorerTab[] = [];
  if (loading || recents.length > 0) sectionTabs.push({ id: 'recent', label: 'Recent' });
  if (!(diagrams.length === 0 && folders.length === 0))
    sectionTabs.push({ id: 'work', label: 'My Work' });
  if (teams.length > 0) sectionTabs.push({ id: 'teams', label: 'Teams' });
  // Resolve the rendered tab: the user's pick when still available,
  // else the first available section (null only on a blank account,
  // where the whole tabbed card is hidden below).
  const activeTab = sectionTabs.some((t) => t.id === selectedTab)
    ? selectedTab
    : (sectionTabs[0]?.id ?? null);
  const handleSelectTab = (id: string) => {
    if (tabsCollapsed) {
      setTabsCollapsed(false);
      setSelectedTab(id);
    } else if (id === activeTab) {
      setTabsCollapsed(true);
    } else {
      setSelectedTab(id);
    }
  };

  // The whole card is hidden when no section has anything to show.
  if (sectionTabs.length === 0 || !activeTab) return null;

  // The Dynamic group's expand state rides the shared expanded-folders map
  // under a synthetic key (real folder ids never collide with it). Stored as
  // a COLLAPSED flag because the group defaults open while the map defaults
  // false: the generic toggle's first flip turns undefined into true, so
  // storing "open" would make the first collapse click a no-op.
  const dynamicOpen = !expandedFolders['dynamic-collapsed'];

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-1.5 ring-1 ring-slate-200/60 dark:bg-slate-800/50 dark:ring-slate-700/60">
      <ExplorerTabBar
        tabs={sectionTabs}
        // Collapsed ⇒ no tab reads as selected; clicking any tab reopens.
        activeId={tabsCollapsed ? '' : activeTab}
        onSelect={handleSelectTab}
      />

      {tabsCollapsed ? null : activeTab === 'recent' ? (
        loading ? (
          <ul className="flex flex-col gap-1" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-1.5 rounded-md px-2 py-1.5" aria-hidden>
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
                  ownerId={ownerId}
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
                    ownerId={ownerId}
                    active={false}
                    // Team diagrams (spec/35) open for any joined
                    // member; their rename / move / delete live
                    // on the /explorer page + team page, so the
                    // panel keeps team rows open-only.
                    draggable={entry.kind === 'own' && !!onMoveDiagramToFolder}
                    onOpen={() => onOpenDiagram(entry.d.id)}
                    onDelete={
                      entry.kind === 'own' && onDeleteDiagram
                        ? (anchor) => onDeleteDiagram(entry.d.id, anchor)
                        : undefined
                    }
                    onDuplicate={
                      entry.kind === 'own' && onDuplicateDiagram
                        ? () => onDuplicateDiagram(entry.d.id)
                        : undefined
                    }
                    onMoveRequest={
                      entry.kind === 'own' && onMoveDiagramRequest
                        ? () => onMoveDiagramRequest(entry.d.id)
                        : undefined
                    }
                  />
                </li>
              ),
            )}
          </ul>
        )
      ) : activeTab === 'work' ? (
        <ul className="flex flex-col gap-0.5">
          {(foldersByParent.get(null) ?? []).map((f) => (
            <FolderNode
              key={f.id}
              folder={f}
              ownerId={ownerId}
              depth={0}
              foldersByParent={foldersByParent}
              diagramsByFolder={diagramsByFolder}
              expanded={expandedFolders}
              onToggleExpanded={onToggleFolder}
              currentDiagramId={currentDiagramId}
              pendingRenameId={pendingRenameFolderId}
              onRenameFolderCommitted={onRenameFolderCommitted}
              onOpenDiagram={onOpenDiagram}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onCreateChild={onCreateChild}
              onDeleteDiagram={onDeleteDiagram}
              exitingDiagramIds={exitingDiagramIds}
              onDuplicateDiagram={onDuplicateDiagram}
              onMoveDiagramRequest={
                onMoveDiagramRequest ? (id) => onMoveDiagramRequest(id) : undefined
              }
              onMoveDiagramToFolder={onMoveDiagramToFolder}
            />
          ))}
          {/* The synthetic nodes group under one "Dynamic" parent (matching
              the /explorer sidebar): live views over your diagrams, not real
              folder rows. Open by default so Unsorted stays one click away. */}
          <li>
            <div className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800">
              <button
                type="button"
                onClick={() => onToggleFolder('dynamic-collapsed')}
                aria-expanded={dynamicOpen}
                aria-label={dynamicOpen ? 'Collapse Dynamic' : 'Expand Dynamic'}
                className="flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <span
                  className={`inline-block transition-transform ${dynamicOpen ? 'rotate-90' : 'rotate-0'}`}
                  aria-hidden
                >
                  <ChevronIcon />
                </span>
              </button>
              <span className="text-slate-400 dark:text-slate-400">
                <DynamicFolderIcon />
              </span>
              <button
                type="button"
                onClick={() => onToggleFolder('dynamic-collapsed')}
                className="flex min-w-0 flex-1 items-center gap-1 truncate text-left"
              >
                <span className="truncate italic text-slate-500 dark:text-white">Dynamic</span>
                <span className="inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-white">
                  {(diagramsByFolder.get(null) ?? []).length + offlineDiagrams.length}
                </span>
              </button>
            </div>
          </li>
          {dynamicOpen ? (
            <li>
              <ul className="flex flex-col gap-0.5 pl-3">
                {(diagramsByFolder.get(null) ?? []).length > 0 ? (
                  <UnsortedNode
                    ownerId={ownerId}
                    expanded={expandedFolders}
                    onToggleExpanded={onToggleFolder}
                    diagrams={diagramsByFolder.get(null) ?? []}
                    currentDiagramId={currentDiagramId}
                    onOpenDiagram={onOpenDiagram}
                    onDeleteDiagram={onDeleteDiagram}
                    exitingDiagramIds={exitingDiagramIds}
                    onDuplicateDiagram={onDuplicateDiagram}
                    onMoveDiagramRequest={
                      onMoveDiagramRequest ? (id) => onMoveDiagramRequest(id) : undefined
                    }
                    onMoveDiagramToFolder={onMoveDiagramToFolder}
                  />
                ) : null}
                {/* Offline (spec/76): always rendered, even empty, so the
                    browser-only bucket stays discoverable. */}
                <OfflineNode
                  ownerId={ownerId}
                  expanded={expandedFolders}
                  onToggleExpanded={onToggleFolder}
                  diagrams={offlineDiagrams}
                  currentDiagramId={currentDiagramId}
                  onOpenDiagram={onOpenDiagram}
                  onDeleteDiagram={onDeleteDiagram}
                  exitingDiagramIds={exitingDiagramIds}
                  onDuplicateDiagram={onDuplicateDiagram}
                  onMoveDiagramRequest={
                    onMoveDiagramRequest ? (id) => onMoveDiagramRequest(id) : undefined
                  }
                />
              </ul>
            </li>
          ) : null}
        </ul>
      ) : activeTab === 'teams' ? (
        <ul className="flex flex-col gap-0.5">
          {teams.map((t) => (
            <TeamNode
              key={t.id}
              team={t}
              ownerId={ownerId}
              folders={foldersByTeam.get(t.id) ?? []}
              diagrams={diagramsByTeam.get(t.id) ?? []}
              currentDiagramId={currentDiagramId}
              expanded={expandedFolders}
              onToggleExpanded={onToggleFolder}
              onOpenDiagram={(id) => onOpenDiagram(id)}
              onOpenTeam={(teamId) =>
                window.location.assign(`/explorer/team?id=${encodeURIComponent(teamId)}`)
              }
              // Hard delete on team-library rows, any joined
              // member (spec/35); the api enforces membership.
              onDeleteDiagram={onDeleteDiagram}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
