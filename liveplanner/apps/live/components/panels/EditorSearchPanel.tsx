'use client';

import dynamic from 'next/dynamic';
import { searchPanelSources } from '@/components/panels/search-panel-sources';

import { buildPaletteSearchItems } from '@/lib/palette-search';
import { HELP_SEARCH_ITEMS } from '@/lib/help-search';
import { SETTINGS_SEARCH_ITEMS } from '@/lib/settings-search-items';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useEditorCommands } from '@/hooks/canvas/useEditorCommands';
import { PALETTE_TILES } from '@/components/palette/palette-tile-defs';
import { tileHandler } from '@/components/palette/PaletteTileGrid';
import { useEditorTileActions } from '@/components/palette/useEditorTileActions';
import { explorerPathFor } from '@/app/explorer/routes';
import { assignAppLocation } from '@/lib/app-location';

const SearchPanel = dynamic(
  () => import('@/components/panels/SearchPanel').then((m) => m.SearchPanel),
  { ssr: false },
);

// The editor's search panel (docs/specs/008-canvas/canvas-and-palette.md "Search panel" + docs/specs/007-editor/command-palette.md): searches documents, folders, shared +
// team documents, tabs/elements, and exposes palette adds, commands, and help.
// Reads everything from EditorContext (commands come from useEditorCommands,
// itself context-driven), so EditorView just renders <EditorSearchPanel />.
export function EditorSearchPanel() {
  const {
    searchOpen,
    documentList,
    folders,
    sharedDocuments,
    teams,
    teamFolders,
    teamDocuments,
    tabs,
    activeId,
    openDocument,
    setActiveId,
    setSelectedId,
    isReadOnly,
    addShape,
    setSearchOpen,
    openSettingsAt,
  } = useEditorContext();
  const { commandItems, runCommand } = useEditorCommands(searchOpen);
  const tileActions = useEditorTileActions();

  if (!searchOpen) return null;

  return (
    <SearchPanel
      {...searchPanelSources({
        documents: documentList,
        folders,
        shared: sharedDocuments,
        teams,
        teamDocuments,
      })}
      teamFolders={teamFolders}
      tabs={tabs}
      currentTabId={activeId}
      onSelectDocument={(id) => {
        openDocument(id);
      }}
      onSelectShared={(id, shareCode) => {
        openDocument(id, shareCode);
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
      paletteItems={isReadOnly ? undefined : buildPaletteSearchItems()}
      onAddPaletteItem={
        isReadOnly
          ? undefined
          : (add) => {
              if (add.type === 'shape')
                addShape(add.shapeKind, {
                  session: add.session,
                  plan: add.plan,
                  variant: add.variant,
                });
              else {
                const def = PALETTE_TILES.find((t) => t.id === add.tileId);
                if (def) tileHandler(def, tileActions)();
              }
            }
      }
      commandItems={commandItems}
      onRunCommand={runCommand}
      helpItems={HELP_SEARCH_ITEMS}
      settingItems={SETTINGS_SEARCH_ITEMS}
      onSelectSetting={openSettingsAt}
      onClose={() => setSearchOpen(false)}
    />
  );
}
