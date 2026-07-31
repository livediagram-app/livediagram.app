'use client';

import type { ReactNode } from 'react';
import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import { AvatarPanel } from '@/components/panels/AvatarPanel';
import { LaserPanel } from '@/components/panels/LaserPanel';
import { SpotlightPanel } from '@/components/panels/SpotlightPanel';
import { EraserPanel } from '@/components/panels/EraserPanel';
import { FormatPanel } from '@/components/panels/FormatPanel';
import type { CanvasChromeProps } from './CanvasChrome';

// The five tool-config panels (spec/101, spec/111, spec/112, spec/113,
// spec/117), lifted out of useCanvasChromePanels. They are siblings in
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
  stackBelowY,
  panelWiringFor,
  closeMobilePanel,
}: {
  props: CanvasChromeProps;
  chromeHidden: boolean;
  // undefined once corner docking owns stacking; otherwise the measured
  // offset that keeps these panels clear of the palette above them.
  stackBelowY: number | undefined;
  panelWiringFor: ReturnType<typeof useCornerDocking>['panelWiringFor'];
  closeMobilePanel: () => void;
}): {
  avatarEl: ReactNode;
  laserEl: ReactNode;
  spotlightEl: ReactNode;
  eraserEl: ReactNode;
  formatEl: ReactNode;
} {
  const {
    activeDockAnchor,
    activeMobilePanel,
    canvasTool,
    minimalPanels,
    selfParticipant,
    avatarConfig,
    onChangeAvatarField,
    onRandomiseAvatar,
    onAvatarReaction,
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
  } = props;

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

  // Avatar Panel (spec/101): the character sheet, mounted only while Avatar
  // mode is active — so it joins and leaves its corner stack the way the
  // session-tool panels do. Available to view-role too (the mode is), and on
  // mobile / minimal it opens from its dock button like every other panel.
  const avatarEl =
    !chromeHidden && canvasTool === 'avatar' && avatarConfig ? (
      <AvatarPanel
        config={avatarConfig}
        onChange={(field, value) => onChangeAvatarField?.(field, value)}
        onRandomise={onRandomiseAvatar}
        onReaction={onAvatarReaction}
        shirt={selfParticipant?.color}
        position={avatarWiring.position}
        stackBelowY={stackBelowY}
        onMoveTo={(x, y) => onMoveAvatarPanel?.(x, y)}
        onReset={avatarWiring.onReset}
        dock={avatarWiring.dock}
        mobileOpenOverride={activeMobilePanel === 'avatar'}
        mobileDockAnchor={activeDockAnchor ?? undefined}
        forceDockMode={!!minimalPanels}
        onMobileClose={closeMobilePanel}
      />
    ) : null;

  // Laser Panel (spec/111): the pen's settings, mounted only while the Laser
  // tool is active — the avatar panel's twin in every respect, including the
  // view-role availability (the laser is theirs too) and the dock button.
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
        mobileOpenOverride={activeMobilePanel === 'laser'}
        mobileDockAnchor={activeDockAnchor ?? undefined}
        forceDockMode={!!minimalPanels}
        onMobileClose={closeMobilePanel}
      />
    ) : null;

  // Spotlight Panel (spec/112): the light's look, mounted only while the
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
        mobileOpenOverride={activeMobilePanel === 'spotlight'}
        mobileDockAnchor={activeDockAnchor ?? undefined}
        forceDockMode={!!minimalPanels}
        onMobileClose={closeMobilePanel}
      />
    ) : null;

  // Eraser Panel (spec/113): the brush's settings, mounted only while the
  // Eraser tool is active.
  const eraserEl =
    !chromeHidden && canvasTool === 'eraser' && eraserConfig ? (
      <EraserPanel
        config={eraserConfig}
        onChange={(field, value) => onChangeEraserField?.(field, value)}
        position={eraserWiring.position}
        stackBelowY={stackBelowY}
        onMoveTo={(x, y) => onMoveEraserPanel?.(x, y)}
        onReset={eraserWiring.onReset}
        dock={eraserWiring.dock}
        mobileOpenOverride={activeMobilePanel === 'eraser'}
        mobileDockAnchor={activeDockAnchor ?? undefined}
        forceDockMode={!!minimalPanels}
        onMobileClose={closeMobilePanel}
      />
    ) : null;

  // Format Panel (spec/117): what the painter copies, mounted only while the
  // Format tool is active.
  const formatEl =
    !chromeHidden && canvasTool === 'format' && formatConfig ? (
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
        mobileOpenOverride={activeMobilePanel === 'format'}
        mobileDockAnchor={activeDockAnchor ?? undefined}
        forceDockMode={!!minimalPanels}
        onMobileClose={closeMobilePanel}
      />
    ) : null;

  return { avatarEl, laserEl, spotlightEl, eraserEl, formatEl };
}
