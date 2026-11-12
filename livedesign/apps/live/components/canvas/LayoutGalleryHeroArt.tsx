// Choose a Layout's hero art (docs/specs/007-editor/pages-mode.md "An empty page offers its layouts"), drawn in the
// dialog hero header's tokens: the gallery itself, as the Start screen tiles its frames. A faint grid fading toward
// the title; in the bottom left a stack of layout frames fanned out; in the bottom right Surprise Me's sparkles; and,
// once the header is wide enough, frames tiled three by two, one selected in the accent with its handles, bobbing
// twice, motion allowing. The title mark is a layout's frame.
import type { ReactNode } from 'react';
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

/** A layout: a frame, its header band, and a column beside the body. */
const LAYOUT_GLYPH = (
  <g fill="none" stroke="var(--hero-accent)" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="3" width="15" height="14" rx="2.5" strokeWidth="1.6" />
    <path d="M2.5 7.75h15M8 7.75V17" strokeWidth="1.6" />
  </g>
);

// A sparkle: four points round (x, y), r its reach.
function sparkle(x: number, y: number, r: number, fill: string) {
  const w = r * 0.28;
  return (
    <path
      d={`M${x} ${y - r}Q${x + w} ${y - w} ${x + r} ${y}Q${x + w} ${y + w} ${x} ${y + r}Q${x - w} ${y + w} ${x - r} ${y}Q${x - w} ${y - w} ${x} ${y - r}Z`}
      fill={fill}
    />
  );
}

// The ways a frame is laid out, drawn as blocks in a 44 x 28 frame at (x, y).
type Layout = 'hero' | 'split' | 'grid' | 'columns' | 'feature' | 'quote';
function blocks(kind: Layout, x: number, y: number, ink: string): ReactNode {
  const r = (bx: number, by: number, w: number, h: number, fill = ink) => (
    <rect x={x + bx} y={y + by} width={w} height={h} rx="1.5" fill={fill} />
  );
  switch (kind) {
    case 'hero':
      return (
        <>
          {r(5, 5, 34, 9, 'var(--hero-wash)')}
          {r(5, 17, 20, 2.5)}
          {r(5, 21.5, 14, 2)}
        </>
      );
    case 'split':
      return (
        <>
          {r(5, 5, 16, 18, 'var(--hero-wash)')}
          {r(24, 7, 15, 3)}
          {r(24, 13, 12, 2)}
          {r(24, 17, 14, 2)}
        </>
      );
    case 'grid':
      return (
        <>
          {r(5, 5, 10.5, 8, 'var(--hero-wash)')}
          {r(17, 5, 10.5, 8, 'var(--hero-wash)')}
          {r(29, 5, 10.5, 8, 'var(--hero-wash)')}
          {r(5, 16, 34, 2.5)}
          {r(5, 21, 22, 2)}
        </>
      );
    case 'columns':
      return (
        <>
          {r(5, 5, 22, 3)}
          {r(5, 11, 16, 12, 'var(--hero-wash)')}
          {r(23, 11, 16, 12, 'var(--hero-wash)')}
        </>
      );
    case 'feature':
      return (
        <>
          {r(5, 5, 8, 8, 'var(--hero-wash)')}
          {r(16, 6, 23, 2.5)}
          {r(16, 10.5, 16, 2)}
          {r(5, 16, 34, 7, 'var(--hero-wash)')}
        </>
      );
    case 'quote':
      return (
        <>
          {r(12, 7, 20, 3)}
          {r(9, 13, 26, 2)}
          {r(14, 18, 16, 2)}
        </>
      );
  }
}

function frame(kind: Layout, x: number, y: number, fill = 'var(--hero-plate)') {
  return (
    <g key={kind}>
      <rect x={x} y={y} width="44" height="28" rx="4" fill={fill} stroke="var(--hero-line)" />
      {blocks(kind, x, y, 'var(--hero-line)')}
    </g>
  );
}

// The handles round a selected frame, at its corners and the middle of its sides.
function handles(x: number, y: number, w: number, h: number) {
  const at = [
    [x, y],
    [x + w / 2, y],
    [x + w, y],
    [x, y + h / 2],
    [x + w, y + h / 2],
    [x, y + h],
    [x + w / 2, y + h],
    [x + w, y + h],
  ];
  return at.map(([hx, hy]) => (
    <rect
      key={`${hx}-${hy}`}
      x={hx! - 2.5}
      y={hy! - 2.5}
      width="5"
      height="5"
      rx="1"
      fill="var(--hero-plate)"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
    />
  ));
}

// The tiled gallery: three by two frames, 44 x 28 with 10 between, the top middle one selected.
const TILES: { kind: Layout; x: number; y: number }[] = [
  { kind: 'hero', x: 6, y: 6 },
  { kind: 'grid', x: 114, y: 6 },
  { kind: 'columns', x: 6, y: 42 },
  { kind: 'feature', x: 60, y: 42 },
  { kind: 'quote', x: 114, y: 42 },
];

const PIECES = (
  <>
    {/* A stack of frames, fanned. */}
    <svg {...HERO_SVG} width="72" height="30" viewBox="0 0 72 30" className={HERO_PLACE.bottomLeft}>
      <g transform="rotate(9 44 30)">{frame('columns', 22, 6, 'var(--hero-soft)')}</g>
      <g transform="rotate(-5 30 30)">{frame('split', 12, 5)}</g>
      {frame('hero', 4, 8)}
    </svg>
    {/* Surprise Me: sparkles. */}
    <svg
      {...HERO_SVG}
      width="48"
      height="30"
      viewBox="0 0 48 30"
      className={HERO_PLACE.bottomRight}
    >
      {sparkle(20, 19, 10, 'var(--hero-mark)')}
      {sparkle(36, 8, 5, 'var(--hero-line)')}
      {sparkle(38, 25, 3.5, 'var(--hero-line)')}
    </svg>
    {/* The gallery, one frame chosen. */}
    <svg
      {...HERO_SVG}
      width="164"
      height="76"
      viewBox="0 0 164 76"
      overflow="visible"
      className={HERO_PLACE.centre}
      data-layout-gallery-tiles=""
    >
      {TILES.map((t) => frame(t.kind, t.x, t.y))}
      <g className={HERO_MOTION.float}>
        <rect
          x="60"
          y="6"
          width="44"
          height="28"
          rx="4"
          fill="var(--hero-plate)"
          stroke="var(--hero-accent)"
          strokeWidth="1.25"
        />
        {blocks('split', 60, 6, 'var(--hero-mark)')}
        {handles(60, 6, 44, 28)}
      </g>
    </svg>
  </>
);

export const layoutGalleryHeroArt: HeroArt = {
  name: 'layout-gallery',
  glyph: LAYOUT_GLYPH,
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
  centre: true,
};
