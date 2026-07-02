'use client';

import dynamic from 'next/dynamic';

import { buildPaletteSearchItems } from '@/lib/palette-search';
import { HELP_SEARCH_ITEMS } from '@/lib/help-search';
import { useEditorContext } from '@/app/diagram/[id]/EditorContext';
import { useEditorCommands } from '@/hooks/canvas/useEditorCommands';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';

const SearchPanel = dynamic(() =>
  import('@/components/panels/SearchPanel').then((m) => m.SearchPanel),
);

// The editor's search panel (spec/43): searches diagrams, folders, shared +
// team diagrams, tabs/elements, and exposes palette adds, commands, and help.
// Reads everything from EditorContext (commands come from useEditorCommands,
// itself context-driven), so EditorView just renders <EditorSearchPanel />.
export function EditorSearchPanel() {
  const {
    searchOpen,
    diagramList,
    folders,
    sharedDiagrams,
    teams,
    teamFolders,
    teamDiagrams,
    tabs,
    activeId,
    openDiagram,
    setActiveId,
    setSelectedId,
    isReadOnly,
    addShape,
    addIcon,
    addTechIcon,
    setSearchOpen,
  } = useEditorContext();
  const { commandItems, runCommand } = useEditorCommands();
  // The icon catalogues load async (lib/icon-registry.ts); subscribing here
  // re-renders the panel — and rebuilds the palette items below — the moment
  // they land, so "Add to canvas" results go from shapes-only to the full
  // shapes + icons + tech list without a reopen. (In practice the editor page
  // kicked the load at mount, so by the time anyone opens search the data is
  // almost always already in.)
  useIconCatalogs();

  if (!searchOpen) return null;

  return (
    <SearchPanel
      diagrams={diagramList.map((d) => ({ id: d.id, name: d.name }))}
      folders={folders.map((f) => ({ id: f.id, name: f.name }))}
      shared={sharedDiagrams.map((s) => ({
        id: s.id,
        name: s.name,
        shareCode: s.shareCode,
      }))}
      teams={teams.map((t) => ({ id: t.id, name: t.name }))}
      teamFolders={teamFolders}
      teamDiagrams={teamDiagrams.map((d) => ({
        id: d.id,
        name: d.name,
        teamId: d.team.id,
        teamName: d.team.name,
      }))}
      tabs={tabs}
      currentTabId={activeId}
      onSelectDiagram={(id) => {
        openDiagram(id);
      }}
      onSelectShared={(id, shareCode) => {
        openDiagram(id, shareCode);
      }}
      onSelectTeam={(id) => {
        window.location.assign(
          `${window.location.origin}/explorer/team?id=${encodeURIComponent(id)}`,
        );
      }}
      onSelectTeamFolder={(teamId, folderId) => {
        window.location.assign(
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
      paletteItems={isReadOnly ? undefined : buildPaletteSearchItems()}
      onAddPaletteItem={
        isReadOnly
          ? undefined
          : (add) => {
              if (add.type === 'shape') addShape(add.shapeKind);
              else if (add.type === 'icon') addIcon(add.iconId);
              else addTechIcon(add.iconId);
            }
      }
      commandItems={commandItems}
      onRunCommand={runCommand}
      helpItems={HELP_SEARCH_ITEMS}
      onClose={() => setSearchOpen(false)}
    />
  );
}
