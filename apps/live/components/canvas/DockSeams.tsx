'use client';

import {
  deriveTextColorForBg,
  dockOf,
  ES_DOCK_DOT_R,
  seamDots,
  type Element,
} from '@livediagram/diagram';
import { getTheme, type ThemeId } from '@/lib/themes';
import { useDockCandidate } from '@/lib/dock-preview';
import type { InsertShift } from '@/hooks/canvas/useInsertShift';

// The two anchor dots in the seam of every docked pair (spec/139 Phase 7), and
// the pair of dots a drag is currently OFFERING.
//
// Magnets, not a connector: nothing is drawn BETWEEN the dots. A line would be
// an arrow, and an arrow means something else on this board.
//
// Drawn in canvas coordinates inside the elements layer, so the dots sit in
// the same space as the notes and travel with the insertion ripple exactly as
// the notes they belong to do.

export function DockSeams({
  elements,
  tabThemeId,
  insertShift,
}: {
  elements: Element[];
  tabThemeId: ThemeId;
  // The render-time insertion offset (spec/139 Phase 5). A docked cluster
  // stands aside whole, so its seam has to stand aside with it — bounds know
  // nothing about a transform, so the dots must be told.
  insertShift: InsertShift;
}) {
  const theme = getTheme(tabThemeId);
  // Neutral ink derived from the backdrop rather than the theme accent: these
  // are notation, not chrome, so they read like the marker on the paper does.
  const ink = deriveTextColorForBg(theme.backgroundColor);
  const accent = theme.elementStroke ?? ink;
  const candidate = useDockCandidate();

  const pairs: { key: string; dots: { x: number; y: number }[]; shift: number; live: boolean }[] =
    [];

  for (const el of elements) {
    const d = dockOf(el);
    if (!d) continue;
    const host = elements.find((h) => h.id === d.hostId);
    if (!host || host.type === 'arrow') continue;
    pairs.push({
      key: el.id,
      dots: seamDots(host, el as { x: number; y: number; width: number; height: number }, d.side),
      // Both halves of a cluster travel together, so either one's offset does.
      shift: insertShift.xFor(host.id) ?? 0,
      live: false,
    });
  }

  // The offer: the same two dots, at the position the note would take, in the
  // guides' accent — the magnets lighting up.
  if (candidate) {
    const host = elements.find((h) => h.id === candidate.hostId);
    if (host && host.type !== 'arrow') {
      pairs.push({
        key: `candidate:${candidate.hostId}:${candidate.side}`,
        dots: seamDots(host, candidate.bounds, candidate.side),
        shift: insertShift.xFor(host.id) ?? 0,
        live: true,
      });
    }
  }

  if (pairs.length === 0) return null;

  return (
    <svg
      aria-hidden
      data-testid="dock-seams"
      className="absolute"
      style={{ width: 0, height: 0, overflow: 'visible', pointerEvents: 'none' }}
    >
      {pairs.map((pair) => (
        <g
          key={pair.key}
          data-insert-shift={insertShift.animates ? '' : undefined}
          style={pair.shift ? { transform: `translateX(${pair.shift}px)` } : undefined}
        >
          {pair.dots.map((dot, i) => (
            <circle
              key={i}
              cx={dot.x}
              cy={dot.y}
              r={ES_DOCK_DOT_R}
              fill={pair.live ? accent : ink}
              fillOpacity={pair.live ? 0.9 : 0.55}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}
