'use client';

import type { TeamFolderHandlers } from './Explorer.types';
import { useState } from 'react';
import { DiagramRowShell } from './DiagramRowShell';
import type { DiagramListItem, Folder } from '@/lib/api-client';
import {
  DiagramRow,
  FolderNode,
  OfflineNode,
  SharedRow,
  UnsortedNode,
} from '@/components/panels/explorer-views';
import { ExplorerTabBar, type ExplorerTab } from '@/components/panels/ExplorerTabBar';
import { TeamNode } from '@/components/panels/explorer-team-views';
import { SYNTHETIC_FOLDERS } from '@/app/explorer/synthetic-folders';
import type { PanelFolderTree } from './FolderNode';
import type { PanelRowActions } from './PanelDiagramRows';
import { TreeNodeHeader } from './TreeNodeHeader';
import type { useExplorerViewModel } from './useExplorerViewModel';

type ExplorerViewModel = ReturnType<typeof useExplorerViewModel>;

// The Explorer panel's tabbed sections card (Recent / Personal Space / Teams),
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
  recentExcludedIds,
  onToggleRecentExclusion,
  favouriteIds,
  onToggleFavourite,
  onRenameFolder,
  onDeleteFolder,
  onCreateChild,
  onTeamFolders,
  onCreateTeamChild,
  onDeleteDiagram,
  onDuplicateDiagram,
  onMoveDiagramRequest,
  onMoveTeamDiagramRequest,
  onMoveDiagramToFolder,
}: {
  loading: boolean;
  ownerId: string | null;
  // Hide / show in Recent (docs/specs/013-workspace/hide-from-recent.md).
  recentExcludedIds?: string[];
  onToggleRecentExclusion?: (diagramId: string) => void;
  // Per-user stars (docs/specs/013-workspace/favourites.md).
  favouriteIds?: Set<string>;
  onToggleFavourite?: (diagramId: string) => void;
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
  // Team-library folder verbs for the Teams tab (docs/specs/013-workspace/team-shared-diagrams.md); absent = browse-only.
  onTeamFolders?: TeamFolderHandlers;
  onCreateTeamChild: (teamId: string, parentId: string | null) => void;
  onDeleteDiagram?: (id: string, anchor: HTMLElement | null) => void;
  onDuplicateDiagram?: (id: string) => void;
  onMoveDiagramRequest?: (diagramId: string) => void;
  // The Teams tab's Change Folder: opens the move picker inside that team.
  onMoveTeamDiagramRequest?: (diagramId: string, teamId: string) => void;
  onMoveDiagramToFolder?: (diagramId: string, folderId: string | null) => void;
}) {
  // The three sections (Recent / Personal Space / Teams) are a single tab bar
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
    sectionTabs.push({ id: 'work', label: 'Personal' });
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

  // What every diagram row in the Personal tab can do, handed to each node
  // (the Teams tab adjusts it per team, below).
  const rows: PanelRowActions = {
    ownerId,
    currentDiagramId,
    exitingDiagramIds,
    onOpenDiagram,
    onDeleteDiagram,
    onDuplicateDiagram,
    onMoveDiagramRequest,
    onMoveDiagramToFolder,
  };
  const personalTree: PanelFolderTree = {
    foldersByParent,
    diagramsByFolder,
    expanded: expandedFolders,
    onToggleExpanded: onToggleFolder,
    pendingRenameId: pendingRenameFolderId,
    onRenameFolderCommitted,
    onRenameFolder,
    onDeleteFolder,
    onCreateChild,
    rows,
  };
  const unsortedDiagrams = diagramsByFolder.get(null) ?? [];

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
                <DiagramRowShell key={entry.d.id} exiting={exitingDiagramIds.has(entry.d.id)}>
                  <DiagramRow
                    item={entry.d}
                    ownerId={ownerId}
                    active={false}
                    // Team diagrams (docs/specs/013-workspace/team-shared-diagrams.md) open for any joined member
                    // and can be duplicated and re-filed from here; only
                    // rename (the open diagram's) and the owner-gated delete
                    // are narrower than the /explorer page's.
                    draggable={entry.kind === 'own' && !!onMoveDiagramToFolder}
                    onOpen={() => onOpenDiagram(entry.d.id)}
                    onDelete={
                      entry.kind === 'own' && onDeleteDiagram
                        ? (anchor) => onDeleteDiagram(entry.d.id, anchor)
                        : undefined
                    }
                    onDuplicate={
                      onDuplicateDiagram ? () => onDuplicateDiagram(entry.d.id) : undefined
                    }
                    // A team row's move opens the picker inside its team, so
                    // the pick routes through the scope-aware move (docs/specs/013-workspace/team-shared-diagrams.md).
                    onMoveRequest={
                      entry.kind === 'team'
                        ? onMoveTeamDiagramRequest && entry.d.team
                          ? () => onMoveTeamDiagramRequest(entry.d.id, entry.d.team!.id)
                          : undefined
                        : onMoveDiagramRequest
                          ? () => onMoveDiagramRequest(entry.d.id)
                          : undefined
                    }
                    // Hiding from Recent is a per-user view choice, so it
                    // applies to team rows too even though their rename /
                    // move / delete live on the /explorer page (docs/specs/013-workspace/hide-from-recent.md).
                    favourite={favouriteIds?.has(entry.d.id) === true}
                    onToggleFavourite={
                      onToggleFavourite ? () => onToggleFavourite(entry.d.id) : undefined
                    }
                    recentExcluded={recentExcludedIds?.includes(entry.d.id) === true}
                    onToggleRecentExclusion={
                      onToggleRecentExclusion
                        ? () => onToggleRecentExclusion(entry.d.id)
                        : undefined
                    }
                  />
                </DiagramRowShell>
              ),
            )}
          </ul>
        )
      ) : activeTab === 'work' ? (
        <ul className="flex flex-col gap-0.5">
          {(foldersByParent.get(null) ?? []).map((f) => (
            <FolderNode key={f.id} folder={f} depth={0} tree={personalTree} />
          ))}
          {/* The synthetic nodes group under one "Dynamic" parent (matching
              the /explorer sidebar): live views over your diagrams, not real
              folder rows. Open by default so Unsorted stays one click away. */}
          <li>
            <TreeNodeHeader
              expanded={dynamicOpen}
              onToggle={() => onToggleFolder('dynamic-collapsed')}
              noun={SYNTHETIC_FOLDERS.dynamic.label}
              icon={<SYNTHETIC_FOLDERS.dynamic.Icon size={12} />}
              label={SYNTHETIC_FOLDERS.dynamic.label}
              labelClassName="italic text-slate-500 dark:text-white"
              count={unsortedDiagrams.length + offlineDiagrams.length}
            />
          </li>
          {dynamicOpen ? (
            <li>
              <ul className="flex flex-col gap-0.5 pl-3">
                {unsortedDiagrams.length > 0 ? (
                  <UnsortedNode
                    expanded={expandedFolders}
                    onToggleExpanded={onToggleFolder}
                    diagrams={unsortedDiagrams}
                    rows={rows}
                  />
                ) : null}
                {/* Offline (docs/specs/006-diagram/offline-mode.md): always rendered, even empty, so the
                    browser-only bucket stays discoverable. */}
                <OfflineNode
                  expanded={expandedFolders}
                  onToggleExpanded={onToggleFolder}
                  diagrams={offlineDiagrams}
                  rows={rows}
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
              folders={foldersByTeam.get(t.id) ?? []}
              diagrams={diagramsByTeam.get(t.id) ?? []}
              expanded={expandedFolders}
              onToggleExpanded={onToggleFolder}
              onOpenTeam={(teamId) =>
                window.location.assign(`/explorer/team?id=${encodeURIComponent(teamId)}`)
              }
              // Hard delete on team-library rows, any joined member
              // (docs/specs/013-workspace/team-shared-diagrams.md); the api enforces membership. Change Folder
              // opens the picker inside this team. No drag-and-drop.
              rows={{
                ...rows,
                onMoveDiagramRequest: onMoveTeamDiagramRequest
                  ? (id) => onMoveTeamDiagramRequest(id, t.id)
                  : undefined,
                onMoveDiagramToFolder: undefined,
              }}
              pendingRenameId={pendingRenameFolderId}
              onRenameFolderCommitted={onRenameFolderCommitted}
              onRenameFolder={onTeamFolders?.rename}
              onDeleteFolder={onTeamFolders?.delete}
              onCreateChild={
                onTeamFolders ? (parentId) => onCreateTeamChild(t.id, parentId) : undefined
              }
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
