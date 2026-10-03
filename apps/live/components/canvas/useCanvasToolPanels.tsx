'use client';

import type { ReactNode } from 'react';
import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import { AvatarPanel } from '@/components/panels/AvatarPanel';
import { LaserPanel } from '@/components/panels/LaserPanel';
import { SpotlightPanel } from '@/components/panels/SpotlightPanel';
import { EraserPanel } from '@/components/panels/EraserPanel';
import { FormatPanel } from '@/components/panels/FormatPanel';
import { SlideDeckPanel } from '@/components/panels/SlideDeckPanel';
import type { CanvasChromeProps } from './CanvasChrome';

// The six tool-config panels (docs/specs/008-canvas/avatar-mode.md, docs/specs/008-canvas/laser-panel.md, docs/specs/008-canvas/spotlight-panel.md, docs/specs/008-canvas/eraser-panel.md,
// docs/specs/008-canvas/format-panel.md, docs/specs/012-collaboration/presentation-mode.md), lifted out of useCanvasChromePanels. They are siblings in
// every respect that matters: each is mounted ONLY while its own canvas
// tool is active, so unlike the standing panels (Explorer, Palette,
// Activity, ...) they join and leave their corner stack as the tool is
// picked and dropped, and each is available to a view-role visitor
// because the tool itself is. Grouping them keeps that shared contract in
// one place, and keeps the chrome host to the panels that are always
// candidates to be on screen. Every one of them takes the identical
// wiring bundle below, so a seventh tool panel is a copy of its neighbour.
export function useCanvasToolPanels({
  props,
  chromeHidden,
  stackBelowY,
  panelWiringFor,
}: {
  props: CanvasChromeProps;
  chromeHidden: boolean;
  // undefined once corner docking owns stacking; otherwise the measured
  // offset that keeps these panels clear of the palette above them.
  stackBelowY: number | undefined;
  panelWiringFor: ReturnType<typeof useCornerDocking>['panelWiringFor'];
}): {
  avatarEl: ReactNode;
  laserEl: ReactNode;
  spotlightEl: ReactNode;
  eraserEl: ReactNode;
  formatEl: ReactNode;
  slideDeckEl: ReactNode;
} {
  const {
    canvasTool,
    selfParticipant,
    avatarConfig,
    onChangeAvatarField,
    onRandomiseAvatar,
    onAvatarReaction,
    onAvatarBurst,
    avatarPanelPosition,
    onMoveAvatarPanel,
    onResetAvatarPanel,
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
    slideDeckPanelPosition,
    onMoveSlideDeckPanel,
    onResetSlideDeckPanel,
    tabSummaries,
    activeTabId,
    readOnly,
  } = props;
  // Draw mode keeps its eraser settings in the dock's flyouts
  // and has no format painter (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows").
  const whiteboard = props.editorMode === 'draw';

  const avatarWiring = panelWiringFor('avatar', avatarPanelPosition ?? null, () =>
    onResetAvatarPanel?.(),
  );
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
  const slideDeckWiring = panelWiringFor('slide-deck', slideDeckPanelPosition ?? null, () =>
    onResetSlideDeckPanel?.(),
  );

  // Avatar Panel (docs/specs/008-canvas/avatar-mode.md): the character sheet, mounted only while Avatar
  // mode is active — so it joins and leaves its corner stack the way the
  // session-tool panels do. Available to view-role too (the mode is).
  const avatarEl =
    !chromeHidden && canvasTool === 'avatar' && avatarConfig ? (
      <AvatarPanel
        config={avatarConfig}
        onChange={(field, value) => onChangeAvatarField?.(field, value)}
        onRandomise={onRandomiseAvatar}
        onReaction={onAvatarReaction}
        onBurst={onAvatarBurst}
        shirt={selfParticipant?.color}
        position={avatarWiring.position}
        stackBelowY={stackBelowY}
        onMoveTo={(x, y) => onMoveAvatarPanel?.(x, y)}
        onReset={avatarWiring.onReset}
        dock={avatarWiring.dock}
      />
    ) : null;

  // Laser Panel (docs/specs/008-canvas/laser-panel.md): the pen's settings, mounted only while the Laser
  // tool is active — the avatar panel's twin in every respect, including the
  // view-role availability (the laser is theirs too).
  const laserEl =
    !chromeHidden && canvasTool === 'laser' && laserConfig ? (
      <LaserPanel
        config={laserConfig}
        onChange={(field, value) => onChangeLaserField?.(field, value)}
        selfColour={selfParticipant?.color ?? '#0ea5e9'}
        position={laserWiring.position}
        stackBelowY={stackBelowY}
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
        stackBelowY={stackBelowY}
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
        stackBelowY={stackBelowY}
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
        stackBelowY={stackBelowY}
        onMoveTo={(x, y) => onMoveFormatPanel?.(x, y)}
        onReset={formatWiring.onReset}
        dock={formatWiring.dock}
      />
    ) : null;

  // Slide Deck panel (docs/specs/012-collaboration/presentation-mode.md): where a deck is built, ordered, checked and
  // started, mounted only while its tool is picked. The sixth, and the one
  // whose tool does not itself change the canvas — picking it opens the
  // workbench, and Start is a deliberate second act.
  const slideDeckEl =
    !chromeHidden && canvasTool === 'slide-deck' && slideDeck ? (
      <SlideDeckPanel
        state={slideDeck}
        tabs={tabSummaries}
        activeTabId={activeTabId ?? ''}
        isReadOnly={readOnly}
        position={slideDeckWiring.position}
        stackBelowY={stackBelowY}
        onMoveTo={(x, y) => onMoveSlideDeckPanel?.(x, y)}
        onReset={slideDeckWiring.onReset}
        dock={slideDeckWiring.dock}
      />
    ) : null;

  return { avatarEl, laserEl, spotlightEl, eraserEl, formatEl, slideDeckEl };
}
