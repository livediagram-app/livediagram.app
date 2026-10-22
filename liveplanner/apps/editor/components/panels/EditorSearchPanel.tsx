'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { searchPanelSources } from '@/components/panels/search-panel-sources';

import { HELP_SEARCH_ITEMS } from '@/lib/help-search';
import { SETTINGS_SEARCH_ITEMS } from '@/lib/settings-search-items';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useEditorCommands } from '@/hooks/canvas/useEditorCommands';
import { explorerPathFor } from '@/app/explorer/routes';
import { assignAppLocation } from '@/lib/app-location';
import { cardTabResolver, type CardSearchSource } from '@/lib/search-plan';

const SearchPanel = dynamic(
  () => import('@/components/panels/SearchPanel').then((m) => m.SearchPanel),
  { ssr: false },
);

// The editor's search panel (docs/specs/008-canvas/canvas-and-palette.md "Search panel" + docs/specs/007-editor/command-palette.md): searches projects, folders, shared +
// team projects, tabs, boards and cards, and exposes commands, settings and help. A card picked opens in its panel, on
// the tab whose board shows it, as Find opens one. There is no "Add to canvas" group: a Plan tab's
// content covers the canvas, so nothing added there would show.
// Reads everything from EditorContext (commands come from useEditorCommands,
// itself context-driven), so EditorView just renders <EditorSearchPanel />.
export function EditorSearchPanel() {
  const {
    searchOpen,
    projectList,
    folders,
    sharedProjects,
    teams,
    teamFolders,
    teamProjects,
    tabs,
    activeId,
    openProject,
    setActiveId,
    setSelectedId,
    setSearchOpen,
    openSettingsAt,
    plan,
  } = useEditorContext();
  const { commandItems, runCommand } = useEditorCommands();
  const items = plan?.context.items;
  const types = plan?.context.types;
  // The cards to search, and the tab each shows on (worked out for the few listed); kept while the cards, types and
  // tabs are, so typing reuses them.
  const cards = useMemo<CardSearchSource | undefined>(
    () => (items ? { items, tabOf: cardTabResolver(tabs, types) } : undefined),
    [items, types, tabs],
  );

  if (!searchOpen) return null;

  return (
    <SearchPanel
      {...searchPanelSources({
        projects: projectList,
        folders,
        shared: sharedProjects,
        teams,
        teamProjects,
      })}
      teamFolders={teamFolders}
      tabs={tabs}
      currentTabId={activeId}
      onSelectProject={(id) => {
        openProject(id);
      }}
      onSelectShared={(id, shareCode) => {
        openProject(id, shareCode);
      }}
      onSelectFolder={(id) => {
        // A personal folder opens on the Explorer page, as picking it there does.
        assignAppLocation(`${window.location.origin}${explorerPathFor({ kind: 'folder', id })}`);
      }}
      onSelectTeam={(id) => {
        assignAppLocation(`${window.location.origin}/explorer/team?id=${encodeURIComponent(id)}`);
      }}
      onSelectTeamFolder={(teamId, folderId) => {
        assignAppLocation(
          `${window.location.origin}/explorer/team?id=${encodeURIComponent(teamId)}&folder=${encodeURIComponent(folderId)}`,
        );
      }}
      onSelectTab={(tabId) => {
        setActiveId(tabId);
        setSelectedId(null);
      }}
      cards={cards}
      onSelectCard={(itemId, tabId) => {
        if (tabId && tabId !== activeId) {
          setActiveId(tabId);
          setSelectedId(null);
        }
        plan?.context.openItem(itemId);
      }}
      onSelectElement={(tabId, elementId) => {
        setActiveId(tabId);
        setSelectedId(elementId);
      }}
      commandItems={commandItems}
      onRunCommand={runCommand}
      helpItems={HELP_SEARCH_ITEMS}
      settingItems={SETTINGS_SEARCH_ITEMS}
      onSelectSetting={openSettingsAt}
      onClose={() => setSearchOpen(false)}
    />
  );
}
