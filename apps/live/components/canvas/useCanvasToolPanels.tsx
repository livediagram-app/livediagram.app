'use client';

import type { ReactNode } from 'react';
import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import dynamic from 'next/dynamic';
import { loadToolPanels } from '@/lib/editor-deferred-code';
import type { CanvasChromeProps } from './CanvasChrome';

// Each panel shows only while its tool is active, so they load on demand, together (./tool-panels); the editor
// fetches them once idle (lib/editor-deferred-code.ts), so picking a tool does not wait.
const FormatPanel = dynamic(() => loadToolPanels().then((m) => m.FormatPanel), { ssr: false });

// The tool-config panel (docs/specs/008-canvas/format-panel.md), lifted out of useCanvasChromePanels: mounted ONLY
// while the Format tool is active, so unlike the standing panels (Explorer, Palette, Activity, ...) it joins and
// leaves its corner stack as the tool is picked and dropped.
export function useCanvasToolPanels({
  props,
  chromeHidden,
  panelWiringFor,
}: {
  props: CanvasChromeProps;
  chromeHidden: boolean;
  panelWiringFor: ReturnType<typeof useCornerDocking>['panelWiringFor'];
}): {
  formatEl: ReactNode;
} {
  const {
    canvasTool,
    formatConfig,
    onToggleFormatGroup,
    onSetFormatMode,
    formatBrushSource,
    formatPanelPosition,
    onMoveFormatPanel,
    onResetFormatPanel,
  } = props;
  const formatWiring = panelWiringFor('format', formatPanelPosition ?? null, () =>
    onResetFormatPanel?.(),
  );

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

  return { formatEl };
}
