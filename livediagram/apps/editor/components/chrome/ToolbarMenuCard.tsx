'use client';

import { useRef, type ReactNode } from 'react';
import { MenuCardFormContext } from '@liveworkspace/workbench/components/chrome/menu-card-form';
import { useMenuCardFit } from '@liveworkspace/workbench/components/chrome/useMenuCardRoom';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@liveworkspace/workbench/lib/ui-scale';
import { PHONE_TOOLBAR_ITEMS } from './phone-toolbar-items';
import {
  MENU_CARD_IN_ROW,
  MenuCardLogo,
} from '@liveworkspace/workbench/components/chrome/MenuCardLogo';

// The card at the canvas's top left, before the palette strip (docs/specs/007-editor/toolbar-layout.md): the
// Explorer's menu button in the app, a workspace frame's Back in a workbench. `data-toolbar-menu` is what the strip
// measures to keep clear of it (useStripCrowded, useBarLabels, useStripTileLimit), so whatever the card holds, the
// strip makes room for it.
//
// `inline` drops the corner positioning so the strip's row can hold it in its own card at the far left, beside the
// strip, which is where a phone puts it. That card packs its buttons' touch pads behind them (PACKED_TOOLBAR_ITEMS), and
// this row spans the 4px gap between them, so it is a stacking context of its own (`isolate`): otherwise the row, not a
// pad, takes a tap in the gap (docs/specs/004-interface-design/touch-targets.md "touch-target-packed").
export function ToolbarMenuCard({
  inline,
  children,
  dockButton = false,
  tourId,
  region,
  logo,
}: {
  inline: boolean;
  children: ReactNode;
  // `data-dock-button`: MovablePanel's outside-click check skips it, for a card that toggles a dock panel.
  dockButton?: boolean;
  tourId?: string;
  // The editor's F6 region the card stands for (@liveworkspace/workbench/hooks/ui/useRegionCycle.ts).
  region?: 'header';
  // Experiment (no header bar): the app's logo in a card of its own, left of this one. Not inline (a phone's strip).
  logo?: ReactNode;
}) {
  // Drawn at the UI scale (docs/specs/007-editor/ui-scale.md), still 12px from the corner. Inline it sits in the
  // strip, which is scaled already.
  const scale = useUiScale('toolbar');
  const scaled = !inline && scale !== 1;
  // Never under the strip (useMenuCardRoom, toolbar-layout.md "The tab's name"): the button and the mode switch keep
  // their size (shrink-0 below), the switch dropping to its icon where the room runs short (`form`,
  // menu-card-form.ts). Not inline, where the strip's row holds the card, nor joined, where it spans the sidebar.
  const cardRef = useRef<HTMLDivElement>(null);
  const { form } = useMenuCardFit(cardRef, !inline);
  const withLogo = !inline && !!logo;
  const card = (
    <div
      ref={cardRef}
      data-dock-button={dockButton ? '' : undefined}
      // Chrome, not canvas: the canvas's capture-phase gestures skip a press inside a floating
      // panel. Without it, a press here with a Draw pen in hand started a stroke instead.
      data-floating-panel=""
      data-tour-id={tourId}
      data-toolbar-menu=""
      data-menu-form={form}
      data-region={region}
      style={{
        ...(scaled && !withLogo
          ? { ...uiScaleStyle(scale), top: toSurfacePx(12, scale), left: toSurfacePx(12, scale) }
          : undefined),
      }}
      className={
        inline
          ? 'isolate flex items-center gap-1'
          : `pointer-events-auto ${withLogo ? MENU_CARD_IN_ROW : 'absolute left-3 top-3 z-[var(--z-toolbar)]'} flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40 ${PHONE_TOOLBAR_ITEMS} [&>*]:shrink-0`
      }
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <MenuCardFormContext.Provider value={form}>{children}</MenuCardFormContext.Provider>
    </div>
  );
  return withLogo ? <MenuCardLogo logo={logo} scale={scale} card={card} /> : card;
}
