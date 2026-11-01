'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { searchPanelSources } from '@/components/panels/search-panel-sources';

import { HELP_SEARCH_ITEMS } from '@/lib/help-search';
import { SETTINGS_SEARCH_ITEMS } from '@/lib/settings-search-items';
import { useOfferedSettingItems } from '@liveworkspace/workbench/hooks/collab/useHideCursors';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useEditorCommands } from '@/hooks/canvas/useEditorCommands';
import { explorerPath } from '@liveworkspace/explorer';
import { assignAppLocation } from '@liveworkspace/workbench/lib/app-location';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { APP_KINDS } from '@liveworkspace/index-client';
import { itemHref } from '@/lib/explorer-host';
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
// Every app's work, from the index (Work Tracker #63): only what the person can open, as the index decides.
const WORKSPACE = { client: indexClient };

export function EditorSearchPanel() {
  const {
    searchOpen,
    projectList,
    teams,
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

  // Less the Hide Participant Cursors row on a tab that draws no cursors (collaborator-enhancements.md).
  const settingItems = useOfferedSettingItems(SETTINGS_SEARCH_ITEMS);

  if (!searchOpen) return null;

  return (
    <SearchPanel
      {...searchPanelSources({
        projects: projectList,
        // Folders, links and team plans are the Explorer's (the index's), opened there.
        folders: [],
        shared: [],
        teams,
        teamProjects: [],
      })}
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
        assignAppLocation(`${window.location.origin}${explorerPath({ kind: 'folder', id })}`);
      }}
      onSelectTeam={(id) => {
        assignAppLocation(`${window.location.origin}${explorerPath({ kind: 'team', id })}`);
      }}
      onSelectTeamFolder={(teamId, folderId) => {
        assignAppLocation(
          `${window.location.origin}${explorerPath({ kind: 'team', id: teamId, folderId })}`,
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
      workspace={WORKSPACE}
      onSelectWorkspaceItem={(item) => {
        // One of this app's opens here, as a pick from its own lists does; another app's opens in that app.
        if (item.app === 'liveplanner') openProject(item.id, item.sharedVia ?? undefined);
        else assignAppLocation(itemHref({ ...item, kind: APP_KINDS[item.app] }));
      }}
      helpItems={HELP_SEARCH_ITEMS}
      settingItems={settingItems}
      onSelectSetting={openSettingsAt}
      onClose={() => setSearchOpen(false)}
    />
  );
}
