'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useStableCallbacks } from '@liveworkspace/workbench/hooks/ui/useStableCallbacks';

import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import type { PanelId } from '@/lib/panel-layout';
import { LazyExplorer } from '@/components/panels/LazyExplorer';
import { ViewMinimap } from '@/components/canvas/view-readers';
import type { CanvasChromeProps } from './CanvasChrome';
import { usePaletteChrome } from './usePaletteChrome';
import { useCanvasToolPanels } from './useCanvasToolPanels';
import { useWithheldExplorerCloses } from '@liveworkspace/workbench/components/canvas/useWithheldExplorerCloses';

// The floating panels as elements (docs/specs/007-editor/panel-docking.md), lifted out of CanvasChrome:
// the stable handler bundles for the memo'd panels, the docking-aware
// wiring per panel, the palette's theme tint, and each panel's element with
// its own visibility gate. CanvasChrome distributes the returned map into
// the corner stacks (docking) or renders the elements inline (an embed). The
// Explorer and the cluster popovers render beside the corner layer. The
// tool-config panels, on screen only while
// their own tool is active, live in useCanvasToolPanels.

export function useCanvasChromePanels({
  props,
  chromeHidden,
  isMobile,
  panelWiringFor,
}: {
  props: CanvasChromeProps;
  chromeHidden: boolean;
  isMobile: boolean;
  panelWiringFor: ReturnType<typeof useCornerDocking>['panelWiringFor'];
}): {
  panelEls: Partial<Record<PanelId, ReactNode>>;
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
    elements,
    onNewDocument,
    explorerMenuActions,

    setActiveDockAnchor,
    setActiveDockPanel,
    settings,
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
    onMenuWebhooks: explorerMenuActions?.onWebhooks,
    onMenuSearch: explorerMenuActions?.onSearch,
    onMenuSettings: explorerMenuActions?.onOpenSettings,
  });
  // The ⋯ menu's rows, stable like the rest; a row stays absent while its
  // handler is, since the stable wrapper alone would always look present.
  const hasShare = !!explorerMenuActions?.onShare;
  const hasExport = !!explorerMenuActions?.onExport;
  const hasWebhooks = !!explorerMenuActions?.onWebhooks;
  const hasSearch = !!explorerMenuActions?.onSearch;
  const hasSettings = !!explorerMenuActions?.onOpenSettings;
  const explorerMenu = useMemo(
    () => ({
      onShare: hasShare ? explorerHandlers.onMenuShare : undefined,
      onExport: hasExport ? explorerHandlers.onMenuExport : undefined,
      onWebhooks: hasWebhooks ? explorerHandlers.onMenuWebhooks : undefined,
      onSearch: hasSearch ? explorerHandlers.onMenuSearch : undefined,
      onOpenSettings: hasSettings ? explorerHandlers.onMenuSettings : undefined,
    }),
    [explorerHandlers, hasShare, hasExport, hasWebhooks, hasSearch, hasSettings],
  );

  const closeDockPanel = useCallback(() => {
    setActiveDockPanel(null);
    setActiveDockAnchor(null);
  }, [setActiveDockPanel, setActiveDockAnchor]);
  // The theme tint for the palette tiles: see usePaletteChrome.
  const { paletteTheme, paletteTint } = usePaletteChrome({ tabThemeId });

  // --- Corner panels as elements (docs/specs/007-editor/panel-docking.md) ---
  // Built once with docking-aware wiring, then rendered either inline (an embed)
  // or distributed into corner stacks. Each keeps its own visibility gate.
  // The tool-config panel (format), see useCanvasToolPanels. They share one contract: on screen
  // only while their own tool is active.
  const { formatEl } = useCanvasToolPanels({
    props,
    chromeHidden,
    panelWiringFor,
  });

  // Mounted from its first opening on, never before (its code loads then), and kept mounted after so
  // the folders someone expanded stay expanded.
  const explorerOpen = activeDockPanel === 'explorer';
  const [explorerOpened, setExplorerOpened] = useState(explorerOpen);
  if (explorerOpen && !explorerOpened) setExplorerOpened(true);
  // Withheld (a phone held sideways), an open Explorer closes.
  const explorerHidden = !!props.explorerHidden;
  useWithheldExplorerCloses(explorerHidden, explorerOpen, closeDockPanel);
  const explorerEl =
    chromeAway || explorerHidden || !explorerOpened ? null : (
      <LazyExplorer
        currentDocumentId={currentDocumentId}
        currentShareCode={currentShareCode ?? null}
        onRenameCurrent={onRenameCurrentDocument}
        onNewDocument={explorerHandlers.onNewDocument}
        menuActions={explorerMenu}
        popoverOpen={explorerOpen}
        popoverAnchor={activeDockAnchor ?? undefined}
        onPopoverClose={closeDockPanel}
      />
    );

  // Minimap (docs/specs/008-canvas/minimap.md) routed through docking like the other panels: it
  // docks in the bottom-left and snaps / persists the same way. Desktop-only, gated on the map
  // setting + a few elements; hidden in an embed / welcome (chromeHidden).
  const mapEnabled = settings?.showMinimap !== false;
  const mapAccent = paletteTheme.elementStroke;
  const minimapWiring = panelWiringFor('minimap', props.mapPosition, props.onResetMap);
  const minimapEl =
    !chromeHidden && !isMobile && mapEnabled && elements.length >= 4 ? (
      <ViewMinimap
        elements={elements}
        tabFont={props.tabFont}
        setViewportOffset={props.setViewportOffset}
        setViewportZoom={props.setViewportZoom}
        mainSize={props.mainSize}
        paperColor={props.tabBackgroundColor}
        accentColor={mapAccent}
        position={minimapWiring.position}
        onMove={props.onMoveMap}
        onResetPosition={minimapWiring.onReset}
        dock={minimapWiring.dock}
        dimOutside={settings?.mapDimOutside !== false}
        size={settings?.mapSize ?? 'medium'}
      />
    ) : null;

  // Map of panel id → element for the docked-layout distribution.
  const panelEls: Partial<Record<PanelId, ReactNode>> = {
    minimap: minimapEl,
    format: formatEl,
  };
  return {
    panelEls,
    explorerEl,
    paletteTint,
  };
}
