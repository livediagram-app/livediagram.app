'use client';

import { useRef, type ReactNode } from 'react';
import { MenuCardFormContext } from '@liveworkspace/workbench/components/chrome/menu-card-form';
import { useMenuCardFit } from '@liveworkspace/workbench/components/chrome/useMenuCardRoom';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@liveworkspace/workbench/lib/ui-scale';
import {
  joinedMenuCardWidth,
  MENU_CARD_FRAME_MOTION,
  MENU_CARD_JOINED,
} from '@liveworkspace/workbench/components/canvas/menu-join';
import { PHONE_TOOLBAR_ITEMS } from '@liveworkspace/workbench/components/chrome/phone-toolbar-items';

// The card at the canvas's top left, before the palette strip (docs/specs/007-editor/toolbar-layout.md): the
// Explorer's menu button in the app, a workspace frame's Back in a workbench. `data-toolbar-menu` is what the strip
// measures to keep clear of it (useStripCrowded, useBarLabels, and useStripTileLimit where an editor has one) and what a maximised board's insets
// read (canvas-layer-insets), so whatever the card holds, the strip makes room for it.
//
// `inline` drops the corner positioning so the strip's row can hold it in its own card at the far left, beside the
// strip, which is where a phone puts it.
//
// `joinedWidth`: the screen width of Pages mode's Contents sidebar while it is docked beneath the card, which then
// heads it as its top row (docs/specs/007-editor/pages-mode.md "Joined to the menu box"): the card's own frame gives
// way to the sidebar's surface and it reaches across the sidebar. Its place and what it holds never change.
export function ToolbarMenuCard({
  inline,
  children,
  dockButton = false,
  tourId,
  region,
  joinedWidth,
}: {
  inline: boolean;
  children: ReactNode;
  // `data-dock-button`: MovablePanel's outside-click check skips it, for a card that toggles a dock panel.
  dockButton?: boolean;
  tourId?: string;
  // The editor's F6 region the card stands for (@liveworkspace/workbench/hooks/ui/useRegionCycle.ts).
  region?: 'header';
  joinedWidth?: number;
}) {
  // Drawn at the UI scale (docs/specs/007-editor/ui-scale.md), still 12px from the corner. Inline it sits in the
  // strip, which is scaled already.
  const scale = useUiScale('toolbar');
  const scaled = !inline && scale !== 1;
  // Never under the strip: a long tab name truncates short of it (useMenuCardRoom, toolbar-layout.md "The tab's
  // name"). Only the name gives way: the button and the mode switch keep their size (shrink-0 below), the switch
  // dropping to its icon and then the name hiding where the room runs short (`form`, menu-card-form.ts). Not inline,
  // where the strip's row holds the card, nor joined, where it spans the sidebar.
  const cardRef = useRef<HTMLDivElement>(null);
  const { maxWidth: room, form } = useMenuCardFit(cardRef, !inline && joinedWidth === undefined);
  const joined = !inline && joinedWidth !== undefined;
  return (
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
      data-menu-joined={joined ? '' : undefined}
      style={{
        ...(scaled
          ? { ...uiScaleStyle(scale), top: toSurfacePx(12, scale), left: toSurfacePx(12, scale) }
          : undefined),
        ...(joined ? { width: joinedMenuCardWidth(joinedWidth, scale) } : undefined),
        ...(room !== null ? { maxWidth: toSurfacePx(room, scale) } : undefined),
      }}
      className={
        inline
          ? 'flex items-center gap-1'
          : `pointer-events-auto absolute left-3 top-3 z-[var(--z-toolbar)] flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40 ${PHONE_TOOLBAR_ITEMS} [&>:not([data-tab-name-in-box])]:shrink-0 ${MENU_CARD_FRAME_MOTION} ${joined ? MENU_CARD_JOINED : ''}`
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
}
