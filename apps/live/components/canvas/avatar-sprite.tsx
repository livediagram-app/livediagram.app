// The Avatar-mode pixel sprite (spec/101): the figure itself, split out of
// AvatarWalker so that component keeps to placement (the ring, the name chip,
// the canvas-coords box) and this one owns the pixel art.
//
// Grid: 16 wide x 24 tall, `crispEdges`, flat fills only. The bottom row is
// the ground — the contact shadow lives there and does NOT rise with a jump,
// so a hop reads as leaving the floor. Two facings are drawn (front / back /
// left profile), with the right profile mirrored from the left.
//
// Two looks (spec/101): `male` (short hair, trousers) and `female` (long hair,
// a skirt). They are costumes on the same skeleton, so the walk, hop, and flag
// animations are shared.

import type { AvatarFacing, AvatarLook } from '@/lib/avatar-walk';
import { AVATAR_BOX, AVATAR_HEIGHT } from '@/lib/avatar-walk';

// Sprite palette. Warm skin + brown hair, with one darker tone per material
// for the shaded edge that gives pixel art its volume. The shirt is the
// participant's presence colour (brand cyan when there isn't one).
const SKIN = '#f4c99b';
const SKIN_DARK = '#d9a674';
const HAIR = '#6b4423';
const HAIR_DARK = '#4a2e17';
const DEFAULT_SHIRT = '#0ea5e9';
const TROUSERS = '#3f4c63';
const TROUSERS_DARK = '#2c3648';
const SHOE = '#1e293b';
const EYE = '#243044';
const FLAG_POLE = '#b8845a';
const FLAG_CLOTH = '#f43f5e';

// A darker companion to an arbitrary shirt colour, for the shaded side. Mixes
// the hex toward black; falls back to the default pair when the colour isn't a
// plain 6-digit hex (a CSS name or rgb() string from an older presence packet).
function shade(hex: string | undefined): { base: string; dark: string } {
  const base = hex ?? DEFAULT_SHIRT;
  const m = /^#([0-9a-f]{6})$/i.exec(base);
  if (!m) return { base, dark: base };
  const n = parseInt(m[1] ?? '', 16);
  const mix = (c: number) => Math.round(c * 0.78);
  const dark =
    '#' +
    [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('');
  return { base, dark };
}

// One leg, as a trouser column with a shoe at the bottom. `lift` raises the
// whole leg by a pixel for the mid-stride frame.
function Leg({ x, lift = 0 }: { x: number; lift?: number }) {
  return (
    <g transform={`translate(0 ${-lift})`}>
      <rect x={x} y={15} width={3} height={6} fill={TROUSERS} />
      <rect x={x + 2} y={15} width={1} height={6} fill={TROUSERS_DARK} />
      <rect x={x} y={21} width={3} height={2} fill={SHOE} />
    </g>
  );
}

// The skirt the female look wears instead of trouser columns: a flared block
// over two bare lower legs.
function Skirt({ shirtDark }: { shirtDark: string }) {
  return (
    <g>
      <rect x={3} y={14} width={10} height={4} fill={shirtDark} />
      <rect x={2} y={17} width={12} height={1} fill={shirtDark} />
    </g>
  );
}

function BareLeg({ x, lift = 0 }: { x: number; lift?: number }) {
  return (
    <g transform={`translate(0 ${-lift})`}>
      <rect x={x} y={18} width={2} height={3} fill={SKIN} />
      <rect x={x} y={21} width={2} height={2} fill={SHOE} />
    </g>
  );
}

// The front / back torso block with sleeves. `swing` moves the arms in
// opposition for the walk cycle.
function Torso({ swing, shirt, shirtDark }: { swing: number; shirt: string; shirtDark: string }) {
  return (
    <g>
      <rect x={4} y={9} width={8} height={6} fill={shirt} />
      <rect x={10} y={9} width={2} height={6} fill={shirtDark} />
      <g transform={`translate(0 ${swing})`}>
        <rect x={2} y={9} width={2} height={4} fill={shirt} />
        <rect x={2} y={13} width={2} height={2} fill={SKIN} />
      </g>
      <g transform={`translate(0 ${-swing})`}>
        <rect x={12} y={9} width={2} height={4} fill={shirtDark} />
        <rect x={12} y={13} width={2} height={2} fill={SKIN_DARK} />
      </g>
    </g>
  );
}

function TorsoLeft({
  swing,
  shirt,
  shirtDark,
}: {
  swing: number;
  shirt: string;
  shirtDark: string;
}) {
  return (
    <g>
      <rect x={5} y={9} width={7} height={6} fill={shirt} />
      <rect x={10} y={9} width={2} height={6} fill={shirtDark} />
      {/* One visible arm, swinging fore and aft rather than up and down. */}
      <g transform={`translate(${-swing} 0)`}>
        <rect x={4} y={10} width={2} height={4} fill={shirt} />
        <rect x={4} y={14} width={2} height={2} fill={SKIN} />
      </g>
    </g>
  );
}

// Facing the viewer: hair, two eyes, a mouth pixel. The female look adds hair
// down both sides of the face.
function HeadDown({ look }: { look: AvatarLook }) {
  return (
    <g>
      <rect x={4} y={1} width={8} height={8} fill={SKIN} />
      <rect x={10} y={1} width={2} height={8} fill={SKIN_DARK} />
      <rect x={3} y={0} width={10} height={3} fill={HAIR} />
      {look === 'female' ? (
        <>
          <rect x={2} y={2} width={2} height={8} fill={HAIR} />
          <rect x={12} y={2} width={2} height={8} fill={HAIR_DARK} />
        </>
      ) : (
        <>
          <rect x={3} y={3} width={2} height={3} fill={HAIR_DARK} />
          <rect x={11} y={3} width={2} height={3} fill={HAIR_DARK} />
        </>
      )}
      <rect x={6} y={5} width={1} height={1} fill={EYE} />
      <rect x={9} y={5} width={1} height={1} fill={EYE} />
      <rect x={7} y={7} width={2} height={1} fill={SKIN_DARK} />
    </g>
  );
}

// Walking away: the back of the head is all hair, no face.
function HeadUp({ look }: { look: AvatarLook }) {
  return (
    <g>
      <rect x={4} y={1} width={8} height={8} fill={SKIN_DARK} />
      <rect x={3} y={0} width={10} height={7} fill={HAIR} />
      <rect x={11} y={0} width={2} height={7} fill={HAIR_DARK} />
      {look === 'female' ? <rect x={3} y={5} width={10} height={6} fill={HAIR} /> : null}
      <rect x={5} y={7} width={6} height={1} fill={SKIN_DARK} />
    </g>
  );
}

// Profile (drawn facing LEFT; the right-facing sprite mirrors this one).
function HeadLeft({ look }: { look: AvatarLook }) {
  return (
    <g>
      <rect x={4} y={1} width={7} height={8} fill={SKIN} />
      {/* Nose pixel + the hair mass at the back of the head. */}
      <rect x={3} y={5} width={1} height={2} fill={SKIN} />
      <rect x={4} y={0} width={9} height={3} fill={HAIR} />
      <rect x={9} y={3} width={4} height={5} fill={HAIR} />
      <rect x={11} y={3} width={2} height={5} fill={HAIR_DARK} />
      {look === 'female' ? <rect x={9} y={7} width={4} height={5} fill={HAIR} /> : null}
      <rect x={5} y={5} width={1} height={1} fill={EYE} />
      <rect x={4} y={7} width={2} height={1} fill={SKIN_DARK} />
    </g>
  );
}

// The flag: an arm raised above the head holding a pole, with a cloth that
// snaps through three frames. Drawn last so it sits in front of the body, and
// drawn UP into the box's reserved headroom / side slack (see AVATAR_BOX) so
// nothing clips at the sprite grid's edges.
function Flag({ frame }: { frame: number }) {
  // Cloth shapes per frame: furled, mid-snap, fully out.
  const cloth =
    frame === 0
      ? 'M14 -6 h4 v3 h-4 Z'
      : frame === 1
        ? 'M14 -6 h5 v2 h-2 v2 h-3 Z'
        : 'M14 -5 h5 v3 h-5 Z';
  return (
    <g>
      {/* The raised arm, then the pole in its hand. */}
      <rect x={12} y={4} width={2} height={6} fill={SKIN} />
      <rect x={12} y={2} width={2} height={2} fill={SKIN} />
      <rect x={13} y={-7} width={1} height={10} fill={FLAG_POLE} />
      <path d={cloth} fill={FLAG_CLOTH} />
    </g>
  );
}

export function AvatarSprite({
  facing,
  look,
  walking,
  stepFrame,
  lift,
  wave,
  shirt,
}: {
  facing: AvatarFacing;
  look: AvatarLook;
  walking: boolean;
  stepFrame: number;
  lift: number;
  wave: number | null;
  shirt?: string;
}) {
  const mid = walking && stepFrame === 1;
  // A one-pixel body bob on the mid-stride frame; mid-air the legs tuck
  // together instead of striding.
  const airborne = lift > 0;
  const bob = airborne ? 0 : mid ? -1 : 0;
  const swing = airborne ? -1 : walking ? (mid ? 1 : -1) : 0;
  const profile = facing === 'left' || facing === 'right';
  const { base: shirtBase, dark: shirtDark } = shade(shirt);
  // The hop is expressed in SPRITE pixels (the grid is 24 tall over
  // AVATAR_HEIGHT + 4 canvas px), so the whole body rises while the ground
  // row — and the shadow drawn on it — stays put.
  const liftPx = (lift / (AVATAR_HEIGHT + 4)) * AVATAR_BOX.gridHeight;
  return (
    <svg
      width={AVATAR_BOX.width}
      height={AVATAR_BOX.height}
      viewBox={AVATAR_BOX.viewBox}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {/* Contact shadow on the ground row. It shrinks as the character rises,
          which is what sells the jump. */}
      <ellipse
        cx={8}
        cy={23}
        rx={Math.max(2.4, 5 - liftPx / 4)}
        ry={1.2}
        fill="rgb(15 23 42 / 0.28)"
      />
      <g
        transform={
          facing === 'right'
            ? `translate(16 ${bob - liftPx}) scale(-1 1)`
            : `translate(0 ${bob - liftPx})`
        }
      >
        {profile ? (
          <>
            {/* Profile stride: one leg forward, one back. */}
            {look === 'female' ? (
              <>
                <BareLeg x={mid ? 9 : 7} />
                <BareLeg x={mid ? 6 : 8} lift={walking && !airborne ? 1 : 0} />
                <Skirt shirtDark={shirtDark} />
              </>
            ) : (
              <>
                <Leg x={mid ? 8 : 6} />
                <Leg x={mid ? 5 : 7} lift={walking && !airborne ? 1 : 0} />
              </>
            )}
            <TorsoLeft swing={swing} shirt={shirtBase} shirtDark={shirtDark} />
            <HeadLeft look={look} />
          </>
        ) : (
          <>
            {look === 'female' ? (
              <>
                <BareLeg x={5} lift={mid && !airborne ? 1 : 0} />
                <BareLeg x={9} lift={!mid && walking && !airborne ? 1 : 0} />
                <Skirt shirtDark={shirtDark} />
              </>
            ) : (
              <>
                <Leg x={5} lift={mid && !airborne ? 1 : 0} />
                <Leg x={9} lift={!mid && walking && !airborne ? 1 : 0} />
              </>
            )}
            <Torso swing={swing} shirt={shirtBase} shirtDark={shirtDark} />
            {facing === 'up' ? <HeadUp look={look} /> : <HeadDown look={look} />}
          </>
        )}
        {wave !== null ? <Flag frame={wave} /> : null}
      </g>
    </svg>
  );
}
