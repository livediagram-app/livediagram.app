'use client';

import type { DockAnchor } from '@/hooks/canvas/useDockPopovers';
import type { ReactNode } from 'react';
import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import dynamic from 'next/dynamic';
import { loadToolPanels } from '@/lib/editor-deferred-code';
import type { CanvasChromeProps } from './CanvasChrome';

// Each panel shows only while its tool is active, so they load on demand, together (./tool-panels); the editor
// fetches them once idle (lib/editor-deferred-code.ts), so picking a tool does not wait.
const AvatarPanel = dynamic(() => loadToolPanels().then((m) => m.AvatarPanel), { ssr: false });
const EraserPanel = dynamic(() => loadToolPanels().then((m) => m.EraserPanel), { ssr: false });
const FormatPanel = dynamic(() => loadToolPanels().then((m) => m.FormatPanel), { ssr: false });

// The three tool-config panels (docs/specs/008-canvas/avatar-mode.md, docs/specs/008-canvas/eraser-panel.md,
// docs/specs/008-canvas/format-panel.md), lifted out of useCanvasChromePanels. They are siblings in
// every respect that matters: each is mounted ONLY while its own canvas
// tool is active, so unlike the standing panels (Explorer, Palette,
// Activity, ...) they join and leave their corner stack as the tool is
// picked and dropped, and each is available to a view-role visitor
// because the tool itself is. Grouping them keeps that shared contract in
// one place, and keeps the chrome host to the panels that are always
// candidates to be on screen. Every one of them takes the identical
// wiring bundle below, so another tool panel is a copy of its neighbour.
export function useCanvasToolPanels({
  props,
  chromeHidden,
  panelWiringFor,
  avatarPopover,
}: {
  props: CanvasChromeProps;
  // The Avatar panel as a popover over its cluster button (docs/specs/008-canvas/avatar-mode.md "The Avatar
  // Panel"), while open: it has no corner form.
  avatarPopover?: { anchor: DockAnchor | undefined; onClose: () => void } | null;
  chromeHidden: boolean;
  panelWiringFor: ReturnType<typeof useCornerDocking>['panelWiringFor'];
}): {
  avatarEl: ReactNode;
  eraserEl: ReactNode;
  formatEl: ReactNode;
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

  const eraserWiring = panelWiringFor('eraser', eraserPanelPosition ?? null, () =>
    onResetEraserPanel?.(),
  );
  const formatWiring = panelWiringFor('format', formatPanelPosition ?? null, () =>
    onResetFormatPanel?.(),
  );

  // Avatar Panel (docs/specs/008-canvas/avatar-mode.md "The Avatar Panel"): the character sheet, a popover over the
  // Avatar button, mounted only while Avatar mode is active and the popover open. Available to view-role too
  // (the mode is); only someone who may speak gets Send a Message. Only the welcome flow
  // hides it.
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

  return { avatarEl, eraserEl, formatEl };
}
