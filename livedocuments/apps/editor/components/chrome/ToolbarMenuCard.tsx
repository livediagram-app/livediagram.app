'use client';

import type { ReactNode } from 'react';
import { useUiScale } from '@/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@/lib/ui-scale';
import { PHONE_TOOLBAR_ITEMS } from './phone-toolbar-items';

// The card at the canvas's top left, before the palette strip (docs/specs/007-editor/toolbar-layout.md): the
// Explorer's menu button in the app, a workspace frame's Back in a workbench. `data-toolbar-menu` is what the strip
// measures to keep clear of it (useStripCrowded, useBarLabels) and what a maximised board's insets
// read (canvas-layer-insets), so whatever the card holds, the strip makes room for it.
//
// `inline` drops the corner positioning so the strip's row can hold it in its own card at the far left, beside the
// strip, which is where a phone puts it.
export function ToolbarMenuCard({
  inline,
  children,
  dockButton = false,
  tourId,
  region,
}: {
  inline: boolean;
  children: ReactNode;
  // `data-dock-button`: MovablePanel's outside-click check skips it, for a card that toggles a dock panel.
  dockButton?: boolean;
  tourId?: string;
  // The editor's F6 region the card stands for (hooks/ui/useRegionCycle.ts).
  region?: 'header';
}) {
  // Drawn at the UI scale (docs/specs/007-editor/ui-scale.md), still 12px from the corner. Inline it sits in the
  // strip, which is scaled already.
  const scale = useUiScale('toolbar');
  const scaled = !inline && scale !== 1;
  return (
    <div
      data-dock-button={dockButton ? '' : undefined}
      // Chrome, not canvas: the canvas's capture-phase gestures skip a press inside a floating
      // panel. Without it, a press here with a Draw pen in hand started a stroke instead.
      data-floating-panel=""
      data-tour-id={tourId}
      data-toolbar-menu=""
      data-region={region}
      style={
        scaled
          ? { ...uiScaleStyle(scale), top: toSurfacePx(12, scale), left: toSurfacePx(12, scale) }
          : undefined
      }
      className={
        inline
          ? 'flex items-center gap-1'
          : `pointer-events-auto absolute left-3 top-3 z-[var(--z-toolbar)] flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40 ${PHONE_TOOLBAR_ITEMS}`
      }
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {children}
    </div>
  );
}
