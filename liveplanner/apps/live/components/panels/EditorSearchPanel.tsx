'use client';

import dynamic from 'next/dynamic';
import { searchPanelSources } from '@/components/panels/search-panel-sources';

import { HELP_SEARCH_ITEMS } from '@/lib/help-search';
import { SETTINGS_SEARCH_ITEMS } from '@/lib/settings-search-items';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useEditorCommands } from '@/hooks/canvas/useEditorCommands';
import { explorerPathFor } from '@/app/explorer/routes';
import { assignAppLocation } from '@/lib/app-location';

const SearchPanel = dynamic(
  () => import('@/components/panels/SearchPanel').then((m) => m.SearchPanel),
  { ssr: false },
);

// The editor's search panel (docs/specs/008-canvas/canvas-and-palette.md "Search panel" + docs/specs/007-editor/command-palette.md): searches projects, folders, shared +
// team projects, tabs, and exposes commands, settings and help. There is no "Add to canvas" group: a Plan tab's
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
  } = useEditorContext();
  const { commandItems, runCommand } = useEditorCommands();

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
