// The parts the palette mode illustrations are drawn from (docs/specs/018-help/help-app.md): a glyph
// per mode, the catalogue pairing each mode with its glyph and label, the
// shared mode-row every picker scene renders, and the isometric projection the
// Isometric scene needs.
//
// Split out of palette-modes.tsx, which labelled these "Mode glyphs" and
// "Shared mode-row" and then ran them ahead of its scenes — with the isometric
// helpers stranded mid-file, next to the one scene that first needed them.
//
// Palette-specific by design: ./primitives holds the house style every
// illustration category shares.

import { Label } from './primitives';

// --- Mode glyphs ------------------------------------------------------------
//
// Small icons drawn at the tile's centre (the tile translates to its own
// origin). Kept here so the shared mode-row and the per-mode scenes draw the
// same glyph for each tool.

/** A pointer / arrow cursor glyph (Select). */
export function SelectGlyph({ on = false }: { on?: boolean }) {
  return (
    <path
      d="M-5 -6 L4 2 L-1 2.5 L1.5 7 L-0.5 8 L-3 3.5 L-6 6 Z"
      className={on ? 'fill-white stroke-white' : 'fill-slate-500 stroke-slate-500'}
      strokeWidth={1}
      strokeLinejoin="round"
    />
  );
}

/** An open hand glyph (Hand / pan). */
export function HandGlyph({ on = false }: { on?: boolean }) {
  return (
    <path
      d="M-4 4 v-7 a1.4 1.4 0 0 1 2.8 0 v5 m0 -1 a1.4 1.4 0 0 1 2.8 0 v1 m0 -1 a1.4 1.4 0 0 1 2.8 0 v3 a5 5 0 0 1 -5 5 h-1 a5 5 0 0 1 -4.4 -3 l-1.4 -3 a1.4 1.4 0 0 1 2.4 -1.4 l0.6 1"
      className={on ? 'stroke-white' : 'stroke-slate-500'}
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** An eraser block glyph. */
export function EraserGlyph({ on = false }: { on?: boolean }) {
  return (
    <g
      className={on ? 'stroke-white' : 'stroke-slate-500'}
      strokeWidth={1.5}
      fill="none"
      strokeLinejoin="round"
    >
      <path d="M-6 4 L0 -2 a2 2 0 0 1 3 0 l3 3 a2 2 0 0 1 0 3 L4 6 H-2 Z" />
      <path d="M-2 6 L-6 2" />
    </g>
  );
}

/** A paint-roller / brush glyph (Format Painter). */
export function PainterGlyph({ on = false }: { on?: boolean }) {
  return (
    <g>
      <rect
        x={-7}
        y={-7}
        width={14}
        height={8}
        rx={2}
        className={on ? 'fill-white' : 'fill-slate-400'}
      />
      <path d="M0 1 v3" className={on ? 'stroke-white' : 'stroke-slate-500'} strokeWidth={1.5} />
      <path
        d="M-3 4 h6 v4 h-6 Z"
        className={on ? 'fill-white/70 stroke-white' : 'fill-slate-300 stroke-slate-500'}
        strokeWidth={1.2}
      />
    </g>
  );
}

/** A zen glyph: the canvas with the chrome gone, just a horizon and a dot. */
export function ZenGlyph({ on = false }: { on?: boolean }) {
  const cls = on ? 'stroke-white' : 'stroke-slate-500';
  return (
    <g className={cls} strokeWidth={1.4} fill="none" strokeLinecap="round">
      <circle r={6.5} />
      <path d="M-6.2 1.5 h12.4" />
      <circle r={1.4} cy={-2.4} className={on ? 'fill-white stroke-white' : 'fill-slate-500'} />
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
