'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useStableCallbacks } from '@liveworkspace/workbench/hooks/ui/useStableCallbacks';

import { ItemToolsHost } from '@/components/panels/ItemToolsHost';
import { LazyExplorer } from '@/components/panels/LazyExplorer';
import type { RenameCurrentRequest } from '@liveworkspace/workbench/hooks/editor/useRenameCurrentRequest';
import type { CanvasChromeProps } from './CanvasChrome';
import { usePaletteChrome } from './usePaletteChrome';
import { useWithheldExplorerCloses } from '@liveworkspace/workbench/components/canvas/useWithheldExplorerCloses';

// The Explorer popover and the palette's theme tint, lifted out of CanvasChrome: the stable handler
// bundles for the memo'd Explorer and its element. livehuddle has no corner panels (the Map, the last,
// left: docs/specs/002-project-scope/not-in-livehuddle.md "The Map").

export function useCanvasChromePanels({
  props,
  renameCurrent,
}: {
  props: CanvasChromeProps;
  // The Rename command's request for the Explorer's Current card (useRenameCurrentRequest).
  renameCurrent: RenameCurrentRequest;
}): {
  // The Explorer, a popover under the menu button (docs/specs/007-editor/toolbar-layout.md).
  explorerEl: ReactNode;
  paletteTint: ReturnType<typeof usePaletteChrome>['paletteTint'];
} {
  const {
    activeDockAnchor,
    activeDockPanel,
    currentDocumentId,
    currentShareCode,
    onRenameCurrentDocument,
    onNewDocument,
    explorerMenuActions,

    setActiveDockAnchor,
    setActiveDockPanel,
    tabThemeId,
    chromeAway,
  } = props;
  // Stable handler identities for the React.memo'd Explorer so it skips re-rendering on every drag frame even
  // though this chrome host re-renders with the canvas. useStableCallbacks
  // keeps each reference fixed while always invoking the latest prop, so
  // there's no stale-closure risk despite the parent's per-frame churn.
  const explorerHandlers = useStableCallbacks({
    onNewDocument,
    onMenuShare: explorerMenuActions?.onShare,
    onMenuExport: explorerMenuActions?.onExport,
    onMenuSearch: explorerMenuActions?.onSearch,
    onMenuSettings: explorerMenuActions?.onOpenSettings,
  });
  // The ⋯ menu's rows, stable like the rest; a row stays absent while its
  // handler is, since the stable wrapper alone would always look present.
  const hasShare = !!explorerMenuActions?.onShare;
  const hasExport = !!explorerMenuActions?.onExport;
  const hasSearch = !!explorerMenuActions?.onSearch;
  const hasSettings = !!explorerMenuActions?.onOpenSettings;
  const explorerMenu = useMemo(
    () => ({
      onShare: hasShare ? explorerHandlers.onMenuShare : undefined,
      onExport: hasExport ? explorerHandlers.onMenuExport : undefined,
      onSearch: hasSearch ? explorerHandlers.onMenuSearch : undefined,
      onOpenSettings: hasSettings ? explorerHandlers.onMenuSettings : undefined,
    }),
    [explorerHandlers, hasShare, hasExport, hasSearch, hasSettings],
  );

  const closeDockPanel = useCallback(() => {
    setActiveDockPanel(null);
    setActiveDockAnchor(null);
  }, [setActiveDockPanel, setActiveDockAnchor]);
  // The theme tint for the palette tiles: see usePaletteChrome.
  const { paletteTint } = usePaletteChrome({ tabThemeId });

  // Mounted from its first opening on, never before (its code loads then), and kept mounted after so
  // the folders someone expanded stay expanded.
  const explorerOpen = activeDockPanel === 'explorer';
  const [explorerOpened, setExplorerOpened] = useState(explorerOpen);
  if (explorerOpen && !explorerOpened) setExplorerOpened(true);
  // Withheld (a phone held sideways), an open Explorer closes.
  const explorerHidden = !!props.explorerHidden;
  useWithheldExplorerCloses(explorerHidden, explorerOpen, closeDockPanel);
  // History in the footer's Tools, there from the start (ItemToolsHost), the Explorer or not.
  const explorerEl = (
    <>
      <ItemToolsHost
        currentDocumentId={currentDocumentId}
        currentShareCode={currentShareCode ?? null}
      />
      {chromeAway || explorerHidden || !explorerOpened ? null : (
        <LazyExplorer
          currentDocumentId={currentDocumentId}
          currentTitle={props.documentName}
          currentShareCode={currentShareCode ?? null}
          onRenameCurrent={onRenameCurrentDocument}
          renameCurrentRequest={renameCurrent.request}
          onRenameCurrentHandled={renameCurrent.onHandled}
          onNewDocument={explorerHandlers.onNewDocument}
          menuActions={explorerMenu}
          popoverOpen={explorerOpen}
          popoverAnchor={activeDockAnchor ?? undefined}
          onPopoverClose={closeDockPanel}
        />
      )}
    </>
  );

  return {
    explorerEl,
    paletteTint,
  };
}
