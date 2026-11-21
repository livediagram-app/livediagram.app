'use client';

import { leavePageThen } from '@/lib/page-edit/page-edit-store';
import { showKnowledgeView } from '@/lib/knowledge-ask/knowledge-view';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useThisKnowledgebaseSearch } from '@/components/knowledge/useThisKnowledgebaseSearch';
import { searchPanelSources } from '@/components/panels/search-panel-sources';

import { buildPaletteSearchItems } from '@/lib/palette-search';
import { HELP_SEARCH_ITEMS } from '@/lib/help-search';
import { SETTINGS_SEARCH_ITEMS } from '@/lib/settings-search-items';
import { useOfferedSettingItems } from '@liveworkspace/workbench/hooks/collab/useHideCursors';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useEditorCommands } from '@/hooks/canvas/useEditorCommands';
import { useIconCatalogs } from '@liveworkspace/workbench/hooks/ui/useIconCatalogs';
import { PALETTE_TILES } from '@/components/palette/palette-tile-defs';
import { tileHandler } from '@/components/palette/PaletteTileGrid';
import { useEditorTileActions } from '@/components/palette/useEditorTileActions';
import { explorerPath } from '@liveworkspace/explorer';
import { assignAppLocation } from '@liveworkspace/workbench/lib/app-location';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { APP_KINDS } from '@liveworkspace/index-client';
import { itemHref } from '@/lib/explorer-host';

const SearchPanel = dynamic(
  () => import('@/components/panels/SearchPanel').then((m) => m.SearchPanel),
  { ssr: false },
);

// The editor's search panel (docs/specs/008-canvas/canvas-and-palette.md "Search panel" + docs/specs/007-editor/command-palette.md): searches documents, folders, shared +
// team documents, tabs/elements, and exposes palette adds, commands, and help.
// Reads everything from EditorContext (commands come from useEditorCommands,
// itself context-driven), so EditorView just renders <EditorSearchPanel />.
// Every app's work, from the index (Work Tracker #63): only what the person can open, as the index decides.
const WORKSPACE = { client: indexClient };

export function EditorSearchPanel() {
  const {
    searchOpen,
    documentList,
    teams,
    tabs,
    activeId,
    openDocument,
    setActiveId,
    setSelectedId,
    isReadOnly,
    addShape,
    addIcon,
    addSticker,
    addTechIcon,
    addImage,
    setSearchOpen,
    openSettingsAt,
  } = useEditorContext();
  const { commandItems, runCommand } = useEditorCommands(searchOpen);
  const tileActions = useEditorTileActions();
  // The icon catalogues load async (lib/icon-registry.ts); subscribing here
  // re-renders the panel — and rebuilds the palette items below — the moment
  // they land, so "Add to canvas" results go from shapes-only to the full
  // shapes + icons + tech list without a reopen. (In practice the editor page
  // kicked the load at mount, so by the time anyone opens search the data is
  // almost always already in.)
  const cataloguesLoaded = useIconCatalogs();

  // Less the Hide Participant Cursors row on a tab that draws no cursors (collaborator-enhancements.md).
  const settingItems = useOfferedSettingItems(SETTINGS_SEARCH_ITEMS);

  // This Knowledgebase, always the first group (docs/specs/030-knowledgebase/search-and-ask.md "Search"): searched
  // by itself for what the field holds, so the panel's other groups never wait for it.
  const [query, setQuery] = useState('');
  const [wasOpen, setWasOpen] = useState(searchOpen);
  if (wasOpen !== searchOpen) {
    setWasOpen(searchOpen);
    if (!searchOpen) setQuery('');
  }
  const lead = useThisKnowledgebaseSearch(query, { enabled: searchOpen });

  if (!searchOpen) return null;

  return (
    <SearchPanel
      {...searchPanelSources({
        documents: documentList,
        // Folders, links and team documents are the Explorer's (the index's), opened there.
        folders: [],
        shared: [],
        teams,
        teamDocuments: [],
      })}
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
        leavePageThen(tabId, () => {
          showKnowledgeView('pages');
          setActiveId(tabId);
          setSelectedId(null);
        });
      }}
      onSelectElement={(tabId, elementId) => {
        leavePageThen(tabId, () => {
          showKnowledgeView('pages');
          setActiveId(tabId);
          setSelectedId(elementId);
        });
      }}
      paletteItems={
        isReadOnly
          ? undefined
          : buildPaletteSearchItems({ hasImage: !!addImage, catalogues: cataloguesLoaded })
      }
      onAddPaletteItem={
        isReadOnly
          ? undefined
          : (add) => {
              if (add.type === 'shape') addShape(add.shapeKind, { variant: add.variant });
              else if (add.type === 'icon') addIcon(add.iconId);
              else if (add.type === 'sticker') addSticker(add.stickerId);
              else if (add.type === 'tile') {
                const def = PALETTE_TILES.find((t) => t.id === add.tileId);
                if (def) tileHandler(def, tileActions)();
              } else addTechIcon(add.iconId);
            }
      }
      commandItems={commandItems}
      onRunCommand={runCommand}
      workspace={WORKSPACE}
      onSelectWorkspaceItem={(item) => {
        // One of this app's opens here, as a pick from its own lists does; another app's opens in that app.
        if (item.app === 'liveknowledge') openDocument(item.id, item.sharedVia ?? undefined);
        else assignAppLocation(itemHref({ ...item, kind: APP_KINDS[item.app] }));
      }}
      helpItems={HELP_SEARCH_ITEMS}
      settingItems={settingItems}
      onSelectSetting={openSettingsAt}
      lead={lead}
      onQueryChange={setQuery}
      onClose={() => setSearchOpen(false)}
    />
  );
}
