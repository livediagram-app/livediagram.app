// The Table dialog's hero art (each product's docs/specs/008-canvas/canvas-and-palette.md "The Table dialog"): how a table
// looks, its header and its cells' words. A grid fades in from the title's side, the table's own lines; in the
// bottom right a table rises from the edge, its header row filled, its first column tinted and alternate rows
// banded, one cell picked out in the accent with a letter's stroke in it, its ring spreading twice. The title mark
// is a table with its header row filled.
// Every app's Table dialog draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/table).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

const COLS = [1, 25, 49, 73];
const ROWS = [12, 21, 30];

const PIECES = (
  <svg {...HERO_SVG} width="92" height="30" viewBox="0 0 92 30" className={HERO_PLACE.bottomRight}>
    <rect
      x="1"
      y="3"
      width="90"
      height="40"
      rx="5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    {/* The header row, the first column, a banded row. */}
    <path d="M1 12V8a5 5 0 0 1 5-5h80a5 5 0 0 1 5 5v4Z" fill="var(--hero-wash)" />
    <rect x="1" y="12" width="24" height="18" fill="var(--hero-wash)" opacity="0.5" />
    <rect x="25" y="21" width="66" height="9" fill="var(--hero-faint)" />
    {ROWS.map((y) => (
      <path key={y} d={`M1 ${y}h90`} stroke="var(--hero-line)" />
    ))}
    {COLS.slice(1).map((x) => (
      <path key={x} d={`M${x} 3v27`} stroke="var(--hero-line)" />
    ))}
    {/* Header words. */}
    {COLS.map((x, i) => (
      <rect
        key={x}
        x={x + 5}
        y="6"
        width={[9, 13, 10, 8][i]}
        height="3"
        rx="1.5"
        fill="var(--hero-mark)"
      />
    ))}
    {/* The cell in hand. */}
    <circle
      cx="61"
      cy="16.5"
      r="8"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <rect
      x="49"
      y="12"
      width="24"
      height="9"
      fill="var(--hero-plate)"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
    />
    <rect x="54" y="15" width="12" height="3" rx="1.5" fill="var(--hero-accent)" />
  </svg>
);

export const tableHeroArt: HeroArt = {
  name: 'table',
  glyph: (
    <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M3 8V6a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 17 6v2Z" fill="var(--hero-accent)" />
      <rect x="3" y="3.5" width="14" height="13" rx="2.5" />
      <path d="M3 12.25h14M10 8v8.5" strokeWidth="1.3" />
    </g>
  ),
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
