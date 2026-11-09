'use client';

import type { ReactNode } from 'react';
import { facingView, type SeatFacing } from '@livehuddle/avatar/facing';
import {
  ARCADE_SCREEN,
  ARCADE_SCREEN_SIDE,
  CAMPFIRE_FLAMES,
  FIREPLACE_FLAMES,
  FIREPLACE_FLAMES_SIDE,
  FOUNTAIN_SPOUT,
  FOUNTAIN_WATER,
  glowsAtNight,
  JUKEBOX_ARCH,
  JUKEBOX_ARCH_SIDE,
  nightGlowIn,
  OFFICE_ART,
  PING_PONG_TOP,
  PING_PONG_TOP_SIDE,
  SOCIAL_TONES,
} from '@livehuddle/document';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { useJukeboxPlaying } from '@/lib/jukebox-listening';
import { useGameOn } from '@/lib/table-games/table-game-scene';

// The live parts of the social pieces (docs/specs/009-elements/social-pieces.md), drawn over a piece's art inside
// FurnitureView's own grid: a ping-pong rally, the arcade's screen, a fire's flicker, the fountain's water, the
// jukebox's lights, and the glow a lit piece throws on dark paper. Every loop is CSS on transform or opacity (app/social-motion.css), so nothing runs per frame in
// JavaScript, and every one holds still under reduced motion (the `lh-social-anim` class).
//
// A turned piece (docs/specs/009-elements/furniture-facing.md "Live faces") draws its live parts on the drawing its
// facing shows: what is on top (the rally) from every side, what is on its front (the screen, the flames, the lights)
// on the front and on the side's strip of front, and nothing from behind. FurnitureView draws this outside the art's
// mirrored frame, so facing right mirrors the side's parts here (none of them is text).

const T = SOCIAL_TONES;

/** Whether a kind draws live parts over its art. */
export function hasSocialArt(kind: string): boolean {
  return (
    kind === 'ping-pong-table' ||
    kind === 'arcade-machine' ||
    kind === 'fireplace' ||
    kind === 'campfire' ||
    kind === 'fountain' ||
    kind === 'jukebox' ||
    glowsAtNight(kind)
  );
}

export function SocialArt({
  kind,
  id,
  sitters,
  facing = 'n',
}: {
  kind: string;
  id: string;
  sitters: number;
  // The piece's facing (pieceFacing): which of its drawings the live parts lie on.
  facing?: SeatFacing;
}) {
  const { view, mirrored } = facingView(facing);
  const side = view === 'side';
  // The side drawing's parts, mirrored about its grid for facing right.
  const onSide = (node: ReactNode) => {
    if (!mirrored) return node;
    const width = OFFICE_ART[kind as keyof typeof OFFICE_ART].side.width;
    return <g transform={`translate(${width} 0) scale(-1 1)`}>{node}</g>;
  };
  switch (kind) {
    case 'ping-pong-table':
      if (sitters < 2) return null;
      return side ? onSide(<RestingRally id={id} down />) : <RestingRally id={id} />;
    case 'arcade-machine':
      if (view === 'back') return null;
      return side ? onSide(<ArcadeScreenSide />) : <ArcadeScreen />;
    case 'fireplace':
      if (view === 'back') return null;
      return side ? (
        onSide(
          <Flicker
            cx={FIREPLACE_FLAMES_SIDE.cx}
            base={FIREPLACE_FLAMES_SIDE.base}
            tall={20}
            glowY={104}
            narrow
          />,
        )
      ) : (
        <Flicker cx={FIREPLACE_FLAMES.cx} base={FIREPLACE_FLAMES.base} tall={30} glowY={104} />
      );
    case 'campfire':
      return <Flicker cx={CAMPFIRE_FLAMES.cx} base={CAMPFIRE_FLAMES.base} tall={30} glowY={58} />;
    case 'fountain':
      return <FountainWater />;
    case 'jukebox':
      if (view === 'back') return null;
      return side ? onSide(<JukeboxLights id={id} side />) : <JukeboxLights id={id} />;
    case 'vending-machine':
    case 'reading-nook': {
      const glow = nightGlowIn(kind, view);
      return glow ? onSide(<NightGlow kind={kind} glow={glow} />) : null;
    }
    default:
      return null;
  }
}

// The resting rally plays while both seats are taken and no game is on; a game draws its own ball (PingPongGame).
function RestingRally({ id, down = false }: { id: string; down?: boolean }) {
  return useGameOn(id) ? null : <Rally down={down} />;
}

// A ball crossing the net and back, bouncing once on each half: two nested loops, across (or, on a table turned onto
// its side, down the canvas) and up.
function Rally({ down }: { down: boolean }) {
  const { x, y, w, h } = down ? PING_PONG_TOP_SIDE : PING_PONG_TOP;
  const cx = x + w / 2;
  const cy = y + h / 2 - 2;
  const travel = down ? 'lh-rally-down' : 'lh-rally-x';
  return (
    <g aria-hidden data-rally={down ? 'down' : 'across'}>
      <ellipse
        cx={cx}
        cy={down ? y + h / 2 + 4 : y + h - 6}
        rx={3}
        ry={1.2}
        fill="#0f172a"
        opacity={0.18}
        className={`lh-social-anim ${travel}`}
      />
      <g className={`lh-social-anim ${travel}`}>
        <g className="lh-social-anim lh-rally-y">
          <circle cx={cx} cy={cy} r={2.8} fill="#ffffff" stroke="#f59e0b" strokeWidth={1} />
        </g>
      </g>
    </g>
  );
}

// The screen's slow shimmer, a little pixel invader and a blinking cursor.
function ArcadeScreen() {
  const { x, y, w, h } = ARCADE_SCREEN;
  const px = (cx: number, cy: number) => <rect x={cx} y={cy} width={2} height={2} />;
  return (
    <g aria-hidden>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={2}
        fill="url(#lh-arcade-sheen)"
        className="lh-social-anim lh-arcade-glow"
      />
      <defs>
        <linearGradient id="lh-arcade-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity={0.55} />
          <stop offset="0.5" stopColor="#a855f7" stopOpacity={0.35} />
          <stop offset="1" stopColor="#f472b6" stopOpacity={0.55} />
        </linearGradient>
      </defs>
      <g fill="#a7f3d0" className="lh-social-anim lh-arcade-hop">
        {px(28, 34)}
        {px(34, 34)}
        {px(26, 36)}
        {px(28, 36)}
        {px(30, 36)}
        {px(32, 36)}
        {px(34, 36)}
        {px(36, 36)}
        {px(26, 38)}
        {px(30, 38)}
        {px(32, 38)}
        {px(36, 38)}
        {px(28, 40)}
        {px(34, 40)}
      </g>
      <rect x={18} y={47} width={12} height={2} fill="#fde68a" opacity={0.9} />
      <rect x={32} y={47} width={3} height={2} fill="#fde68a" className="lh-social-anim lh-blink" />
    </g>
  );
}

// The turned machine's sliver of screen down its front strip: the same shimmer, too narrow for the invader.
function ArcadeScreenSide() {
  return (
    <g aria-hidden data-arcade-screen="side">
      <path
        d={ARCADE_SCREEN_SIDE}
        fill="url(#lh-arcade-sheen-side)"
        className="lh-social-anim lh-arcade-glow"
      />
      <defs>
        <linearGradient id="lh-arcade-sheen-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity={0.55} />
          <stop offset="0.5" stopColor="#a855f7" stopOpacity={0.35} />
          <stop offset="1" stopColor="#f472b6" stopOpacity={0.55} />
        </linearGradient>
      </defs>
    </g>
  );
}

// Two flame layers out of step over the drawn fire, and a glow breathing on the ground. `narrow` is the sliver of fire
// a turned fireplace shows down its front's edge.
function Flicker({
  cx,
  base,
  tall,
  glowY,
  narrow = false,
}: {
  cx: number;
  base: number;
  tall: number;
  glowY: number;
  narrow?: boolean;
}) {
  const thin = narrow ? 0.45 : 1;
  const flame = (t: number, w0: number) => {
    const w = w0 * thin;
    return (
      `M${cx - w} ${base}C${cx - w} ${base - t * 0.5} ${cx - w * 0.3} ${base - t * 0.62} ${cx} ${base - t}` +
      `C${cx + w * 0.3} ${base - t * 0.62} ${cx + w} ${base - t * 0.5} ${cx + w} ${base}Z`
    );
  };
  return (
    <g aria-hidden data-flicker={narrow ? 'side' : 'front'}>
      <ellipse
        cx={cx}
        cy={glowY}
        rx={tall * 1.3}
        ry={tall * 0.3}
        fill={T.flame}
        opacity={0.18}
        className="lh-social-anim lh-glow"
      />
      <path
        d={flame(tall * 0.95, tall * 0.42)}
        fill={T.ember}
        opacity={0.55}
        className="lh-social-anim lh-flicker-a"
      />
      <path
        d={flame(tall * 0.7, tall * 0.3)}
        fill={T.flameHot}
        opacity={0.85}
        className="lh-social-anim lh-flicker-b"
      />
    </g>
  );
}

// Spray rising from the spout and a shimmer drifting across the basin.
function FountainWater() {
  const { x, y } = FOUNTAIN_SPOUT;
  const { cx, cy, rx } = FOUNTAIN_WATER;
  return (
    <g aria-hidden fill="none" strokeLinecap="round">
      <path
        d={`M${x} ${y - 2}C${x - 6} ${y - 12} ${x - 14} ${y - 8} ${x - 18} ${y + 18}M${x} ${y - 2}C${x + 6} ${y - 12} ${x + 14} ${y - 8} ${x + 18} ${y + 18}`}
        stroke={T.waterDeep}
        strokeWidth={2}
        strokeDasharray="5 4"
        className="lh-social-anim lh-spray"
      />
      <path
        d={`M${cx - rx * 0.6} ${cy - 2}q8 -3 16 0M${cx + rx * 0.1} ${cy + 5}q8 -3 16 0`}
        stroke="#ffffff"
        strokeWidth={1.5}
        opacity={0.6}
        className="lh-social-anim lh-shimmer"
      />
    </g>
  );
}

// While this jukebox plays for you: its arch lights pulse and notes drift up out of it.
function JukeboxLights({ id, side = false }: { id: string; side?: boolean }) {
  const playing = useJukeboxPlaying(id);
  if (!playing) return null;
  const note = (x: number, cls: string) => (
    <g className={`lh-social-anim ${cls}`} fill="#fde68a" stroke="#92400e" strokeWidth={0.8}>
      <ellipse cx={x} cy={10} rx={2.6} ry={2} />
      <path d={`M${x + 2.4} 10V1.5l4 1.5`} fill="none" />
    </g>
  );
  return (
    <g aria-hidden data-jukebox-playing={side ? 'side' : 'front'}>
      <path
        d={side ? JUKEBOX_ARCH_SIDE : JUKEBOX_ARCH}
        fill="#fff7ed"
        className="lh-social-anim lh-jukebox-lights"
      />
      {note(side ? 10 : 18, 'lh-note-a')}
      {note(side ? 26 : 36, 'lh-note-b')}
      {note(side ? 40 : 52, 'lh-note-c')}
    </g>
  );
}

// On dark paper only (docs/specs/009-elements/social-pieces.md "Vending Machine", "Reading Nook"): a pool of light on the
// floor and a halo round what is lit, each a radial fade in the light's colour. Static, so reduced motion changes
// nothing; the gradient ids are per kind, the same on every copy, as the arcade's sheen is.
function NightGlow({
  kind,
  glow,
}: {
  kind: 'vending-machine' | 'reading-nook';
  glow: NonNullable<ReturnType<typeof nightGlowIn>>;
}) {
  const surface = useCanvasSurface();
  if (surface !== 'dark') return null;
  const { color, pool, halo } = glow;
  const id = `lh-night-glow-${kind}`;
  return (
    <g aria-hidden data-night-glow="">
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor={color} stopOpacity={0.55} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse {...pool} fill={`url(#${id})`} />
      <ellipse {...halo} fill={`url(#${id})`} opacity={0.7} />
    </g>
  );
}
