'use client';

import type { ReactNode } from 'react';
import { toSurfacePx, uiScaleStyle } from '../../lib/ui-scale';

// Experiment (livediagram, livedocuments; no header bar): the app's logo in a card of its own at the canvas's top left,
// the menu card beside it. The pair stands where the menu card alone stood, drawn at the UI scale; the menu card goes
// in as `card`, positioned in the row (MENU_CARD_IN_ROW) rather than at the corner.
export const MENU_CARD_IN_ROW = 'relative min-w-0';

// Experiment (phone, trying it out): the top row's outer cards meet the screen's edges, square on that side and with no
// border there, for the room it buys. The menu card at the left (with the row's 6 px gutter cancelled, where it sits in
// the strip's row); the corner card at the right (EditorCornerActions).
export const PHONE_EDGE_LEFT = 'phone:rounded-l-none phone:border-l-0';
export const PHONE_EDGE_LEFT_IN_ROW = `${PHONE_EDGE_LEFT} phone:-ml-[0.375rem]`;

export function MenuCardLogo({
  logo,
  scale,
  card,
  logoClassName = '',
}: {
  logo: ReactNode;
  scale: number;
  card: ReactNode;
  // More classes for the logo's card, as an app's menu card takes its own (liveplanner's header band blend).
  logoClassName?: string;
}) {
  return (
    <div
      style={
        scale === 1
          ? undefined
          : { ...uiScaleStyle(scale), top: toSurfacePx(12, scale), left: toSurfacePx(12, scale) }
      }
      className="pointer-events-none absolute left-3 top-3 z-[var(--z-toolbar)] flex items-start gap-2"
    >
      <div
        data-floating-panel=""
        data-logo-card=""
        onPointerDown={(e) => e.stopPropagation()}
        className={`pointer-events-auto flex h-[46px] shrink-0 items-center rounded-xl border border-slate-200 bg-white px-2.5 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40 ${logoClassName}`}
      >
        {logo}
      </div>
      {card}
    </div>
  );
}
