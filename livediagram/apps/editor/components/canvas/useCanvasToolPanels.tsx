'use client';

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { ChromeToolsItem } from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';
import { usePublishToolsItems } from '@liveworkspace/workbench/components/chrome/tools-door';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { SlideDeckIcon } from '@/components/palette/palette-icons';
import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import dynamic from 'next/dynamic';
import { loadToolPanels } from '@/lib/editor-deferred-code';
import type { CanvasChromeProps } from './CanvasChrome';

// Each panel shows only while its tool is active, so they load on demand, together (./tool-panels); the editor
// fetches them once idle (lib/editor-deferred-code.ts), so picking a tool does not wait.
const LaserPanel = dynamic(() => loadToolPanels().then((m) => m.LaserPanel), { ssr: false });
const SpotlightPanel = dynamic(() => loadToolPanels().then((m) => m.SpotlightPanel), {
  ssr: false,
});
const EraserPanel = dynamic(() => loadToolPanels().then((m) => m.EraserPanel), { ssr: false });
const FormatPanel = dynamic(() => loadToolPanels().then((m) => m.FormatPanel), { ssr: false });
const SlideDeckPanel = dynamic(() => loadToolPanels().then((m) => m.SlideDeckPanel), {
  ssr: false,
});

// The five tool-config panels (docs/specs/008-canvas/laser-panel.md, docs/specs/008-canvas/spotlight-panel.md, docs/specs/008-canvas/eraser-panel.md,
// docs/specs/008-canvas/format-panel.md, docs/specs/012-collaboration/presentation-mode.md), lifted out of useCanvasChromePanels. They are siblings in
// every respect that matters: each is mounted ONLY while its own canvas
// tool is active, so unlike the standing panels (Explorer, Palette,
// Activity, ...) they join and leave their corner stack as the tool is
// picked and dropped, and each is available to a view-role visitor
// because the tool itself is. Grouping them keeps that shared contract in
// one place, and keeps the chrome host to the panels that are always
// candidates to be on screen. Every one of them takes the identical
// wiring bundle below, so a sixth tool panel is a copy of its neighbour.
export function useCanvasToolPanels({
  props,
  chromeHidden,
  panelWiringFor,
}: {
  props: CanvasChromeProps;
  chromeHidden: boolean;
  panelWiringFor: ReturnType<typeof useCornerDocking>['panelWiringFor'];
}): {
  laserEl: ReactNode;
  spotlightEl: ReactNode;
  eraserEl: ReactNode;
  formatEl: ReactNode;
  slideDeckEl: ReactNode;
} {
  const {
    canvasTool,
    selfParticipant,
    laserConfig,
    onChangeLaserField,
    laserPanelPosition,
    onMoveLaserPanel,
    onResetLaserPanel,
    spotlightConfig,
    onChangeSpotlightField,
    spotlightRadius,
    onSetSpotlightRadius,
    spotlightPanelPosition,
    onMoveSpotlightPanel,
    onResetSpotlightPanel,
    eraserConfig,
    onChangeEraserField,
    eraserPanelPosition,
    onMoveEraserPanel,
    onResetEraserPanel,
    formatConfig,
    onToggleFormatGroup,
    onSetFormatMode,
    formatBrushSource,
    formatPanelPosition,
    onMoveFormatPanel,
    onResetFormatPanel,
    slideDeck,
    tabSummaries,
    activeTabId,
    readOnly,
  } = props;
  // Draw mode keeps its eraser settings in the dock's flyouts
  // and has no format painter (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows").
  const whiteboard = props.editorMode === 'draw';

  const laserWiring = panelWiringFor('laser', laserPanelPosition ?? null, () =>
    onResetLaserPanel?.(),
  );
  const spotlightWiring = panelWiringFor('spotlight', spotlightPanelPosition ?? null, () =>
    onResetSpotlightPanel?.(),
  );
  const eraserWiring = panelWiringFor('eraser', eraserPanelPosition ?? null, () =>
    onResetEraserPanel?.(),
  );
  const formatWiring = panelWiringFor('format', formatPanelPosition ?? null, () =>
    onResetFormatPanel?.(),
  );

  // Laser Panel (docs/specs/008-canvas/laser-panel.md): the pen's settings, mounted only while the Laser
  // tool is active, with the view-role availability (the laser is theirs too).
  const laserEl =
    !chromeHidden && canvasTool === 'laser' && laserConfig ? (
      <LaserPanel
        config={laserConfig}
        onChange={(field, value) => onChangeLaserField?.(field, value)}
        selfColour={selfParticipant?.color ?? '#0ea5e9'}
        position={laserWiring.position}
        onMoveTo={(x, y) => onMoveLaserPanel?.(x, y)}
        onReset={laserWiring.onReset}
        dock={laserWiring.dock}
      />
    ) : null;

  // Spotlight Panel (docs/specs/008-canvas/spotlight-panel.md): the light's look, mounted only while the
  // Spotlight tool is active — the Laser Panel's sibling in every respect.
  const spotlightEl =
    !chromeHidden && canvasTool === 'spotlight' && spotlightConfig ? (
      <SpotlightPanel
        config={spotlightConfig}
        onChange={(field, value) => onChangeSpotlightField?.(field, value)}
        radius={spotlightRadius ?? 170}
        onSetRadius={(r) => onSetSpotlightRadius?.(r)}
        position={spotlightWiring.position}
        onMoveTo={(x, y) => onMoveSpotlightPanel?.(x, y)}
        onReset={spotlightWiring.onReset}
        dock={spotlightWiring.dock}
      />
    ) : null;

  // Eraser Panel (docs/specs/008-canvas/eraser-panel.md): the brush's settings, mounted only while the
  // Eraser tool is active.
  const eraserEl =
    !chromeHidden && !whiteboard && canvasTool === 'eraser' && eraserConfig ? (
      <EraserPanel
        config={eraserConfig}
        onChange={(field, value) => onChangeEraserField?.(field, value)}
        position={eraserWiring.position}
        onMoveTo={(x, y) => onMoveEraserPanel?.(x, y)}
        onReset={eraserWiring.onReset}
        dock={eraserWiring.dock}
      />
    ) : null;

  // Format Panel (docs/specs/008-canvas/format-panel.md): what the painter copies, mounted only while the
  // Format tool is active.
  const formatEl =
    !chromeHidden && !whiteboard && canvasTool === 'format' && formatConfig ? (
      <FormatPanel
        config={formatConfig}
        onToggleGroup={(group) => onToggleFormatGroup?.(group)}
        onSetMode={(mode) => onSetFormatMode?.(mode)}
        source={formatBrushSource ?? null}
        position={formatWiring.position}
        onMoveTo={(x, y) => onMoveFormatPanel?.(x, y)}
        onReset={formatWiring.onReset}
        dock={formatWiring.dock}
      />
    ) : null;

  // Slide Deck in the footer's Tools (docs/specs/012-collaboration/presentation-mode.md "Where it lives"; owner,
  // 2026-11-17): no longer a selection mode, its panel is a Tools page under the back bar. Desktop only, and not on a
  // tab-scoped link (no deck there).
  const isMobile = useIsMobileViewport();
  // The deck as it changes, for the page: the row is memoised on whether it is offered, so it never republishes.
  const [latestDeck] = useState(() =>
    deckStore({ slideDeck, tabSummaries, activeTabId, readOnly }),
  );
  useEffect(() => {
    latestDeck.set({ slideDeck, tabSummaries, activeTabId, readOnly });
  }, [latestDeck, slideDeck, tabSummaries, activeTabId, readOnly]);
  const deckOffered = !!slideDeck && !isMobile;
  const deckRows = useMemo<ChromeToolsItem[]>(
    () =>
      deckOffered
        ? [
            {
              id: 'slide-deck',
              group: 'collaborate',
              // Stays open while elements are picked on the canvas; closed by hand.
              keepOpen: true,
              label: 'Slide Deck',
              description: 'Build slides from the canvas and present them.',
              icon: <SlideDeckIcon />,
              onSelect: () => {},
              view: () => <SlideDeckToolsView latest={latestDeck} />,
            },
          ]
        : [],
    [deckOffered, latestDeck],
  );
  usePublishToolsItems('slide-deck', deckRows);
  const slideDeckEl = null;

  return { laserEl, spotlightEl, eraserEl, formatEl, slideDeckEl };
}

type DeckInputs = {
  slideDeck: CanvasChromeProps['slideDeck'];
  tabSummaries: CanvasChromeProps['tabSummaries'];
  activeTabId: CanvasChromeProps['activeTabId'];
  readOnly: CanvasChromeProps['readOnly'];
};

// A tiny store of the deck's inputs: the page reads it as it changes.
type DeckStore = {
  get: () => DeckInputs;
  set: (next: DeckInputs) => void;
  subscribe: (listener: () => void) => () => void;
};
function deckStore(initial: DeckInputs): DeckStore {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next) => {
      current = next;
      for (const l of listeners) l();
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

// The deck's page inside Tools.
function SlideDeckToolsView({ latest }: { latest: DeckStore }) {
  const { slideDeck, tabSummaries, activeTabId, readOnly } = useSyncExternalStore(
    latest.subscribe,
    latest.get,
    latest.get,
  );
  if (!slideDeck) return null;
  return (
    <SlideDeckPanel
      inTools
      state={slideDeck}
      tabs={tabSummaries ?? []}
      activeTabId={activeTabId ?? ''}
      isReadOnly={!!readOnly}
    />
  );
}
