'use client';

import dynamic from 'next/dynamic';
import { isLocalOnly } from '@/lib/document-space';

import { buildPaletteSearchItems } from '@/lib/palette-search';
import { HELP_SEARCH_ITEMS } from '@/lib/help-search';
import { SETTINGS_SEARCH_ITEMS } from '@/lib/settings-search-items';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useEditorCommands } from '@/hooks/canvas/useEditorCommands';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';
import { PALETTE_TILES } from '@/components/palette/palette-tile-defs';
import { tileHandler } from '@/components/palette/PaletteTileGrid';
import { useEditorTileActions } from '@/components/palette/useEditorTileActions';

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
  useIconCatalogs();

  if (!searchOpen) return null;

  return (
    <SearchPanel
      documents={documentList.map((d) => ({
        id: d.id,
        name: d.name,
        localOnly: isLocalOnly(d),
      }))}
      folders={folders.map((f) => ({ id: f.id, name: f.name }))}
      shared={sharedDocuments.map((s) => ({
        id: s.id,
        name: s.name,
        shareCode: s.shareCode,
      }))}
      teams={teams.map((t) => ({ id: t.id, name: t.name }))}
      teamFolders={teamFolders}
      teamDocuments={teamDocuments.map((d) => ({
        id: d.id,
        name: d.name,
        teamId: d.team.id,
        teamName: d.team.name,
      }))}
      tabs={tabs}
      currentTabId={activeId}
      onSelectDocument={(id) => {
        openDocument(id);
      }}
      onSelectShared={(id, shareCode) => {
        openDocument(id, shareCode);
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
      paletteItems={isReadOnly ? undefined : buildPaletteSearchItems({ hasImage: !!addImage })}
      onAddPaletteItem={
        isReadOnly
          ? undefined
          : (add) => {
              if (add.type === 'shape')
                addShape(add.shapeKind, {
                  session: add.session,
                  reaction: add.reaction,
                  mode: add.mode,
                  estimateScale: add.estimateScale,
                  plan: add.plan,
                });
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
      helpItems={HELP_SEARCH_ITEMS}
      settingItems={SETTINGS_SEARCH_ITEMS}
      onSelectSetting={openSettingsAt}
      onClose={() => setSearchOpen(false)}
    />
  );
}
