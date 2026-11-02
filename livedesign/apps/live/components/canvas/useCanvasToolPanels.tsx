'use client';

import { useState, type ReactNode } from 'react';
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
const InspectPanel = dynamic(() => loadToolPanels().then((m) => m.InspectPanel), { ssr: false });

const NO_PAGES: readonly never[] = [];

// The four tool-config panels (docs/specs/008-canvas/laser-panel.md, docs/specs/008-canvas/spotlight-panel.md, docs/specs/008-canvas/eraser-panel.md,
// docs/specs/008-canvas/format-panel.md), lifted out of useCanvasChromePanels. They are siblings in
// every respect that matters: each is mounted ONLY while its own canvas
// tool is active, so unlike the standing panels (Explorer, Palette,
// Activity, ...) they join and leave their corner stack as the tool is
// picked and dropped, and each is available to a view-role visitor
// because the tool itself is. Grouping them keeps that shared contract in
// one place, and keeps the chrome host to the panels that are always
// candidates to be on screen. Every one of them takes the identical
// wiring bundle below, so a fifth tool panel is a copy of its neighbour.
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
  inspectEl: ReactNode;
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
  } = props;

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
  // Inspect's place is kept here (the chrome stays mounted across tools), so a panel moved aside comes back
  // where it was the next time Inspect is turned on.
  const [inspectPosition, setInspectPosition] = useState<{ x: number; y: number } | null>(null);
  const inspectWiring = panelWiringFor('inspect', inspectPosition, () => setInspectPosition(null));

  // Laser Panel (docs/specs/008-canvas/laser-panel.md): the pen's settings, mounted only while the Laser
  // tool is active, available to view-role visitors too (the laser is theirs too).
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
    !chromeHidden && canvasTool === 'eraser' && eraserConfig ? (
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
    !chromeHidden && canvasTool === 'format' && formatConfig ? (
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

  // Inspect panel (docs/specs/007-editor/wireframe-pages.md "The Inspect panel"): the selected wireframe
  // element's measurements, mounted only while the Inspect tool is active, every role's.
  const inspectEl =
    !chromeHidden && canvasTool === 'inspect' ? (
      <InspectPanel
        elements={props.elements}
        pages={props.pagesMode?.pages ?? NO_PAGES}
        tabFont={props.tabFont}
        tabFinish={props.tabFinish}
        position={inspectWiring.position}
        onMoveTo={(x, y) => setInspectPosition({ x, y })}
        onReset={inspectWiring.onReset}
        dock={inspectWiring.dock}
      />
    ) : null;

  return { laserEl, spotlightEl, eraserEl, formatEl, inspectEl };
}
