'use client';

import { pageLabel } from '@liveplanner/document';
import type { DockAnchor } from '@/hooks/canvas/useDockPopovers';
import type { ReactNode } from 'react';
import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import dynamic from 'next/dynamic';
import { loadToolPanels } from '@/lib/editor-deferred-code';
import type { CanvasChromeProps } from './CanvasChrome';

// Each panel shows only while its tool is active, so they load on demand, together (./tool-panels); the editor
// fetches them once idle (lib/editor-deferred-code.ts), so picking a tool does not wait.
const AvatarPanel = dynamic(() => loadToolPanels().then((m) => m.AvatarPanel), { ssr: false });
const LaserPanel = dynamic(() => loadToolPanels().then((m) => m.LaserPanel), { ssr: false });
const SpotlightPanel = dynamic(() => loadToolPanels().then((m) => m.SpotlightPanel), {
  ssr: false,
});
const FormatPanel = dynamic(() => loadToolPanels().then((m) => m.FormatPanel), { ssr: false });
const SlideDeckPanel = dynamic(() => loadToolPanels().then((m) => m.SlideDeckPanel), {
  ssr: false,
});

// The five tool-config panels (docs/specs/008-canvas/avatar-mode.md, docs/specs/008-canvas/laser-panel.md, docs/specs/008-canvas/spotlight-panel.md,
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
  slidesPopover,
  avatarPopover,
}: {
  props: CanvasChromeProps;
  // The Avatar panel as a popover over its cluster button (docs/specs/008-canvas/avatar-mode.md "The Avatar
  // Panel"), while open: it has no corner form.
  avatarPopover?: { anchor: DockAnchor | undefined; onClose: () => void } | null;
  // The Slide Deck as a popover over its cluster button (Pages mode), while open.
  slidesPopover?: { anchor: DockAnchor | undefined; onClose: () => void } | null;
  chromeHidden: boolean;
  panelWiringFor: ReturnType<typeof useCornerDocking>['panelWiringFor'];
}): {
  avatarEl: ReactNode;
  laserEl: ReactNode;
  spotlightEl: ReactNode;
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
    onSendAvatarMessage,
    avatarStatus,
    onSetAvatarStatus,
    avatarSpeechCooling,
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

  const laserWiring = panelWiringFor('laser', laserPanelPosition ?? null, () =>
    onResetLaserPanel?.(),
  );
  const spotlightWiring = panelWiringFor('spotlight', spotlightPanelPosition ?? null, () =>
    onResetSpotlightPanel?.(),
  );
  const formatWiring = panelWiringFor('format', formatPanelPosition ?? null, () =>
    onResetFormatPanel?.(),
  );
  const slideDeckWiring = panelWiringFor('slide-deck', slideDeckPanelPosition ?? null, () =>
    onResetSlideDeckPanel?.(),
  );

  // Avatar Panel (docs/specs/008-canvas/avatar-mode.md "The Avatar Panel"): the character sheet, a popover over the
  // Avatar button, mounted only while Avatar mode is active and the popover open. Available to view-role too
  // (the mode is); only someone who may speak gets Send a Message. Shown in Zen, as its button is (the mode's one
  // piece of chrome there); only the welcome flow hides it.
  const avatarEl =
    !props.welcomeOpen && canvasTool === 'avatar' && avatarConfig && avatarPopover ? (
      <AvatarPanel
        config={avatarConfig}
        onChange={(field, value) => onChangeAvatarField?.(field, value)}
        onRandomise={onRandomiseAvatar}
        onReaction={onAvatarReaction}
        onBurst={onAvatarBurst}
        shirt={selfParticipant?.color}
        onSendMessage={
          onSendAvatarMessage
            ? (text) => {
                const sent = onSendAvatarMessage(text);
                // Close the panel so the bubble is seen rising (docs/specs/008-canvas/avatar-mode.md).
                if (sent) avatarPopover.onClose();
                return sent;
              }
            : undefined
        }
        speechCooling={!!avatarSpeechCooling}
        status={avatarStatus ?? null}
        onSetStatus={onSetAvatarStatus}
        position={null}
        onMoveTo={() => {}}
        asPopover
        popoverOpen
        popoverAnchor={avatarPopover.anchor}
        dismissOnOutside
        onPopoverClose={avatarPopover.onClose}
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

  // Slide Deck panel (docs/specs/012-collaboration/presentation-mode.md): where a deck is built, ordered, checked and
  // started, mounted only while its tool is picked. The sixth, and the one
  // whose tool does not itself change the canvas — picking it opens the
  // workbench, and Start is a deliberate second act.
  const slideDeckEl =
    !chromeHidden && slideDeck && (canvasTool === 'slide-deck' || slidesPopover) ? (
      <SlideDeckPanel
        state={slideDeck}
        tabs={tabSummaries}
        activeTabId={activeTabId ?? ''}
        isReadOnly={readOnly}
        pages={props.pagesMode?.pages.map((p) => ({
          id: p.id,
          label: pageLabel(p, p.index, Math.max(2, props.pagesMode!.pages.length)),
          slide: p.kind === 'slide',
        }))}
        position={slideDeckWiring.position}
        onMoveTo={(x, y) => onMoveSlideDeckPanel?.(x, y)}
        onReset={slideDeckWiring.onReset}
        dock={slidesPopover ? undefined : slideDeckWiring.dock}
        // Over the Slides cluster button (Pages mode): a popover, closed by an outside press.
        asPopover={!!slidesPopover}
        popoverOpen={!!slidesPopover}
        popoverAnchor={slidesPopover?.anchor}
        dismissOnOutside={!!slidesPopover}
        onPopoverClose={slidesPopover?.onClose}
      />
    ) : null;

  return { avatarEl, laserEl, spotlightEl, formatEl, slideDeckEl };
}
