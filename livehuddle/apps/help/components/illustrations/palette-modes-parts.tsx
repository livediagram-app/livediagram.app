// The parts the palette mode illustrations are drawn from (docs/specs/018-help/help-app.md): a glyph
// per mode. The glyphs of the modes every product shares come from @liveworkspace/help-site; Avatar is
// livehuddle's alone, so it lives here.
//
// Palette-specific by design: ./primitives holds the house style every
// illustration category shares.


// The glyphs every product's help shares; livehuddle's own mode (Avatar) is drawn below.
export {
  SelectGlyph,
  HandGlyph,
  EraserGlyph,
  PainterGlyph,
  LaserGlyph,
  SpotlightGlyph,
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

