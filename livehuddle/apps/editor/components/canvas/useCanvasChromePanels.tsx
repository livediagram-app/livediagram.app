'use client';

import { isTypingTarget } from '@liveworkspace/workbench/lib/typing-target';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useStableCallbacks } from '@liveworkspace/workbench/hooks/ui/useStableCallbacks';

import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import type { PanelId } from '@/lib/panel-layout';
import { LazyExplorer } from '@/components/panels/LazyExplorer';
import { ViewMinimap } from '@/components/canvas/view-readers';
import type { CanvasChromeProps } from './CanvasChrome';
import { usePaletteChrome } from './usePaletteChrome';
import { useCanvasToolPanels } from './useCanvasToolPanels';
import { tidyUpOffered } from './tidy-up-actions';
import { useWithheldExplorerCloses } from '@liveworkspace/workbench/components/canvas/useWithheldExplorerCloses';

// Lazy-load CommentsPanel: only mounts when the active tab has at
// least one element with comments. It stacks below the Palette (the
// top-right panel). Most documents never accumulate comments, so deferring
// the 164-line panel + its relative-time formatting
// dependencies keeps the editor's initial chunk lean.
const CollaboratePanel = dynamic(
  () => import('@/components/panels/CollaboratePanel').then((m) => m.CollaboratePanel),
  { ssr: false },
);

// Lazy for the same reason: the Tidy Up popover (docs/specs/008-canvas/layout-cleanup.md "The Tidy Up button")
// loads on the first press of its button.
const TidyUpPopover = dynamic(() => import('./TidyUpPopover').then((m) => m.TidyUpPopover), {
  ssr: false,
});

// A lazily loaded popover in a boundary of its own: one whose code cannot load (opened offline,
// docs/specs/007-editor/load-recovery.md "Offline") closes, so its button lets go, and never takes the canvas with it.
function LazyPopover({ onError, children }: { onError: () => void; children: ReactNode }) {
  return (
    <AreaErrorBoundary area="Popovers" onError={onError}>
      {children}
    </AreaErrorBoundary>
  );
}

// Lazy for the same reason: the Actions panel (docs/specs/012-collaboration/assigned-actions.md) only mounts when
// the active tab has at least one element with an OPEN assigned action.

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
  panelsOn,
}: {
  props: CanvasChromeProps;
  chromeHidden: boolean;
  isMobile: boolean;
  panelWiringFor: ReturnType<typeof useCornerDocking>['panelWiringFor'];
  // Which panels are on in Settings (docs/specs/007-editor/user-preferences.md), read by CanvasChrome
  // so each panel and its cluster button agree.
  panelsOn: { collaborate: boolean };
}): {
  panelEls: Partial<Record<PanelId, ReactNode>>;
  // The Explorer, a popover under the menu button (docs/specs/007-editor/toolbar-layout.md).
  explorerEl: ReactNode;
  collaborateEl: ReactNode;
  // The Tidy Up popover over its button.
  tidyUpPopoverEl: ReactNode;
  // The Avatar panel over its button (docs/specs/008-canvas/avatar-mode.md "The Avatar Panel").
  avatarPopoverEl: ReactNode;
  paletteTint: ReturnType<typeof usePaletteChrome>['paletteTint'];
} {
  const {
    activeDockAnchor,
    activeDockPanel,
    actionRows,
    commentRows,
    commentsPanelPosition,
    currentDocumentId,
    currentShareCode,
    onRenameCurrentDocument,
    elements,
    onMoveCommentsPanel,
    onNewDocument,
    explorerMenuActions,
    onOpenActionForElement,
    onToggleActionDone,
    activeTabId,
    onOpenCommentsForElement,
    onResetCommentsPanel,

    setActiveDockAnchor,
    setActiveDockPanel,
    settings,
    tabThemeId,
    chromeAway,
  } = props;
  // The Inbox's Mark Done for an action on this tab (lib/explorer-inbox-host): the canvas's own verb, through a
  // stable wrapper so the panel's props stay the same while the editor re-renders.
  const { markDone } = useStableCallbacks({
    markDone: (elementId: string, actionId: string) =>
      onToggleActionDone?.(elementId, true, actionId),
  });
  const canMarkDone = Boolean(onToggleActionDone);
  const inboxOpenAction = useMemo(
    () => (canMarkDone && activeTabId ? { tabId: activeTabId, markDone } : null),
    [canMarkDone, activeTabId, markDone],
  );
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
  const { paletteTheme, paletteTint } = usePaletteChrome({ tabThemeId });

  // --- Corner panels as elements (docs/specs/007-editor/panel-docking.md) ---
  // Built once with docking-aware wiring, then rendered either inline (an embed)
  // or distributed into corner stacks. Each keeps its own visibility gate.
  const collaborateWiring = panelWiringFor(
    'collaborate',
    commentsPanelPosition,
    onResetCommentsPanel,
  );
  // The tool-config panels (avatar / eraser / format), see useCanvasToolPanels. They share one contract: on screen
  // only while their own tool is active.
  // The Tidy Up popover belongs to its button: an embed or a locked-out session closes it.
  const tidyUp = props.tidyUp;
  const tidyUpShown = tidyUpOffered({
    actions: tidyUp,
    chromeAway: !!chromeAway,
  });
  const tidyUpOpen = activeDockPanel === 'tidy-up' && tidyUpShown && !chromeHidden;
  useEffect(() => {
    if (activeDockPanel === 'tidy-up' && !tidyUpShown) closeDockPanel();
  }, [activeDockPanel, tidyUpShown, closeDockPanel]);
  // The Avatar panel belongs to its button, which belongs to the mode: leaving Avatar mode closes it.
  const avatarMode = props.canvasTool === 'avatar';
  const avatarOpen = activeDockPanel === 'avatar' && avatarMode;
  useEffect(() => {
    if (activeDockPanel === 'avatar' && !avatarMode) closeDockPanel();
  }, [activeDockPanel, avatarMode, closeDockPanel]);
  // Escape closes the Avatar panel and nothing else (docs/specs/008-canvas/avatar-mode.md "The Avatar Panel"):
  // caught ahead of the editor's shortcuts, where Escape would otherwise leave Avatar mode altogether. A typing
  // field in the panel (the message view) handles its own Escape first.
  useEffect(() => {
    if (!avatarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || isTypingTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      closeDockPanel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [avatarOpen, closeDockPanel]);
  const { avatarEl, eraserEl, formatEl } = useCanvasToolPanels({
    props,
    chromeHidden,
    panelWiringFor,
    avatarPopover: avatarOpen
      ? { anchor: activeDockAnchor ?? undefined, onClose: closeDockPanel }
      : null,
  });

  // Mounted from its first opening on, never before (its code loads then), and kept mounted after so
  // the folders someone expanded stay expanded.
  const explorerOpen = activeDockPanel === 'explorer';
  const [explorerOpened, setExplorerOpened] = useState(explorerOpen);
  if (explorerOpen && !explorerOpened) setExplorerOpened(true);
  // Withheld (the workbench frame, a phone held sideways), an open Explorer closes.
  const explorerHidden = !!props.explorerHidden;
  useWithheldExplorerCloses(explorerHidden, explorerOpen, closeDockPanel);
  const explorerEl =
    chromeAway || explorerHidden || !explorerOpened ? null : (
      <LazyExplorer
        currentDocumentId={currentDocumentId}
        inboxOpenAction={inboxOpenAction}
        currentShareCode={currentShareCode ?? null}
        onRenameCurrent={onRenameCurrentDocument}
        onNewDocument={explorerHandlers.onNewDocument}
        menuActions={explorerMenu}
        popoverOpen={explorerOpen}
        popoverAnchor={activeDockAnchor ?? undefined}
        onPopoverClose={closeDockPanel}
      />
    );

  // Collaborate panel (docs/specs/012-collaboration/assigned-actions.md §5): a popover hanging above its
  // cluster button after Layers, in every layout (the button opens it through
  // the dock's one-open-at-a-time slot; popoverOpen gates the render).
  // Mounted only while the tab has a thread or an action, the button's gate,
  // and never while its Settings switch is off (docs/specs/007-editor/user-preferences.md).
  const collaborateEl =
    !chromeHidden && panelsOn.collaborate && (commentRows.length > 0 || actionRows.length > 0) ? (
      <CollaboratePanel
        position={collaborateWiring.position}
        commentRows={commentRows}
        actionRows={actionRows}
        onMoveTo={onMoveCommentsPanel}
        onReset={collaborateWiring.onReset}
        // It steps aside once a row takes you somewhere, or on a phone it
        // would cover the card you just went to.
        onCommentRowClick={(id) => {
          onOpenCommentsForElement(id);
          closeDockPanel();
        }}
        onActionRowClick={(id) => {
          onOpenActionForElement(id);
          closeDockPanel();
        }}
        onToggleActionDone={onToggleActionDone}
        popoverOpen={activeDockPanel === 'collaborate'}
        popoverAnchor={activeDockAnchor ?? undefined}
        asPopover
        dismissOnOutside
        onPopoverClose={closeDockPanel}
      />
    ) : null;

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
    // Collaborate renders outside the corner layer (collaborateEl, below).
    collaborate: null,
    minimap: minimapEl,
    eraser: eraserEl,
    format: formatEl,
  };
  return {
    panelEls,
    explorerEl,
    // The cluster popovers, rendered beside the corner layer rather than in it (see panelEls).
    collaborateEl,
    avatarPopoverEl: avatarEl,
    tidyUpPopoverEl:
      tidyUpOpen && tidyUp ? (
        <LazyPopover onError={closeDockPanel}>
          <TidyUpPopover
            actions={tidyUp}
            empty={elements.length === 0}
            anchor={activeDockAnchor ?? undefined}
            onClose={closeDockPanel}
          />
        </LazyPopover>
      ) : null,
    paletteTint,
  };
}
