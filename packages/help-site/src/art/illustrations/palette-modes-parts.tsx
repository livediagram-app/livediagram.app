// The parts the palette mode illustrations are drawn from (docs/specs/018-help/help-app.md): a glyph
// per mode two or more products share. A product with modes of its own draws those in its own help app, beside a
// re-export of these.
//
// Split out of palette-modes.tsx, which labelled these "Mode glyphs" and
// "Shared mode-row" and then ran them ahead of its scenes.
//
// Palette-specific by design: ./primitives holds the house style every
// illustration category shares.

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

/** A laser-beam glyph (a dot with rays). */
export function LaserGlyph({ on = false }: { on?: boolean }) {
  return (
    <g>
      <circle r={2.5} className={on ? 'fill-white' : 'fill-rose-500'} />
      <path
        d="M0 -8 v3 M0 5 v3 M-8 0 h3 M5 0 h3 M-5.6 -5.6 l2 2 M3.6 3.6 l2 2 M5.6 -5.6 l-2 2 M-3.6 3.6 l-2 2"
        className={on ? 'stroke-white' : 'stroke-rose-400'}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </g>
  );
}

/** A spotlight glyph (a bright ring with a dimmed surround). */
export function SpotlightGlyph({ on = false }: { on?: boolean }) {
  return (
    <g>
      <circle
        r={6}
        className={on ? 'fill-none stroke-white' : 'fill-none stroke-slate-500'}
        strokeWidth={1.5}
      />
      <circle r={2} className={on ? 'fill-white' : 'fill-amber-400'} />
    </g>
  );
}

/** A slide-deck glyph: a framed slide with a second one queued behind it. */
export function SlideDeckGlyph({ on = false }: { on?: boolean }) {
  const cls = on ? 'stroke-white' : 'stroke-slate-500';
  return (
    <g className={cls} strokeWidth={1.4} fill="none" strokeLinejoin="round">
      <rect x={-7.5} y={-6} width={12} height={9} rx={1.5} />
      <path d="M-4.5 -8 h9 a1.5 1.5 0 0 1 1.5 1.5 v7" />
      <path d="M-4.5 0 h5" strokeLinecap="round" />
      <path d="M-1 5.5 h3.5" strokeLinecap="round" />
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
