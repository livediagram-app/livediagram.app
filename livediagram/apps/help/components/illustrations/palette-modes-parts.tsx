// The parts the palette mode illustrations are drawn from (docs/specs/018-help/help-app.md): a glyph
// per mode and the isometric projection the Isometric scene needs. The glyphs of the modes every product shares
// come from @liveworkspace/help-site; Avatar and Isometric are livediagram's alone, so they and the projection
// helpers (iso, IsoCard) live here.
//
// Split out of palette-modes.tsx, which labelled these "Mode glyphs" and
// "Shared mode-row" and then ran them ahead of its scenes — with the isometric
// helpers stranded mid-file between Spotlight and Avatar, next to the one
// scene that first needed them.
//
// Palette-specific by design: ./primitives holds the house style every
// illustration category shares.

import { Label } from '@liveworkspace/help-site/art/primitives';

// The glyphs every product's help shares; livediagram's own modes (Avatar, Isometric) are drawn below.
export {
  SelectGlyph,
  HandGlyph,
  EraserGlyph,
  PainterGlyph,
  LaserGlyph,
  SpotlightGlyph,
  SlideDeckGlyph,
  ZenGlyph,
} from '@liveworkspace/help-site/art/illustrations/palette-modes-parts';

// --- Mode glyphs ------------------------------------------------------------
//
// Small icons drawn at the tile's centre (the tile translates to its own
// origin). Kept here so the shared mode-row and the per-mode scenes draw the
// same glyph for each tool.

/** A mid-stride walking figure (Avatar mode). */
export function AvatarGlyph({ on = false }: { on?: boolean }) {
  const cls = on ? 'stroke-white' : 'stroke-slate-500';
  return (
    <g className={cls} strokeWidth={1.5} fill="none" strokeLinecap="round">
      <circle r={2} cx={0.5} cy={-5} className={on ? 'stroke-white' : 'stroke-slate-500'} />
      <path d="M0.5 -2.4 v4" />
      <path d="M0.5 1.6 l-3 4.4 M0.5 1.6 l3.2 4.4" />
      <path d="M0.5 -1.2 l-3.4 1.6 M0.5 -1.2 l3.4 1.2" />
    </g>
  );
}

/** An isometric cube glyph. */
export function IsometricGlyph({ on = false }: { on?: boolean }) {
  const cls = on ? 'stroke-white' : 'stroke-slate-500';
  return (
    <g className={cls} strokeWidth={1.4} fill="none" strokeLinejoin="round">
      <path d="M0 -7 L7 -3 L0 1 L-7 -3 Z" />
      <path d="M-7 -3 V4 L0 8 V1 M7 -3 V4 L0 8" />
    </g>
  );
}

// Project flat (cx, cy) onto a simple isometric plane around a centre.
const ISO_OX = 236;
const ISO_OY = 168;
export function iso(cx: number, cy: number): [number, number] {
  return [ISO_OX + (cx - cy) * 0.86, ISO_OY + (cx + cy) * 0.5];
}

// Draw an isometric "card" (a top face) for a flat box centred at (cx, cy).
// Module scope, not nested inside IsometricMode: a component declared during
// render is a brand-new type on every pass, so React unmounts and remounts the
// subtree instead of updating it.
export function IsoCard({
  cx,
  cy,
  half = 36,
  accent = false,
  label,
}: {
  cx: number;
  cy: number;
  half?: number;
  accent?: boolean;
  label?: string;
}) {
  const tl = iso(cx - half, cy - half * 0.55);
  const tr = iso(cx + half, cy - half * 0.55);
  const br = iso(cx + half, cy + half * 0.55);
  const bl = iso(cx - half, cy + half * 0.55);
  const c = iso(cx, cy);
  const d = `M${tl[0]} ${tl[1]} L${tr[0]} ${tr[1]} L${br[0]} ${br[1]} L${bl[0]} ${bl[1]} Z`;
  // A short extruded side for depth.
  const side = `M${bl[0]} ${bl[1]} L${br[0]} ${br[1]} L${br[0]} ${br[1] + 12} L${bl[0]} ${bl[1] + 12} Z`;
  return (
    <g>
      <path
        d={side}
        className={accent ? 'fill-brand-600 stroke-brand-700' : 'fill-slate-200 stroke-slate-300'}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path
        d={d}
        className={accent ? 'fill-brand-500 stroke-brand-600' : 'fill-white stroke-brand-300'}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {label && (
        <Label
          x={c[0]}
          y={c[1]}
          anchor="middle"
          size={11}
          weight={600}
          tone={accent ? 'onAccent' : 'strong'}
        >
          {label}
        </Label>
      )}
    </g>
  );
}
