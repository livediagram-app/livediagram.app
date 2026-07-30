// Avatar mode geometry (spec/101): the pure maths behind the walking
// character — one frame's step toward a target, the direction the held
// arrow keys point, which way the figure faces, the camera nudge that
// keeps it on screen, and what it is standing on. No React, no DOM, so
// the walk behaviour is unit-testable without a canvas.

import { isBoxed, type Element } from '@livediagram/diagram';

// Walk speed in CANVAS px per second. Constant on purpose: an eased
// glide reads as a camera move, a constant walk reads as a character.
export const AVATAR_SPEED = 260;

// Sprite footprint in canvas px at the REGULAR size. The position point is the
// FEET, so the body is drawn above it and centred on it. The Size choice in the
// Avatar Panel (spec/101) scales these via avatarBox(scale).
export const AVATAR_WIDTH = 40;
export const AVATAR_HEIGHT = 56;
// Empty space reserved ABOVE the standing sprite so a jump has somewhere to go.
// The sprite's SVG clips at its viewBox, so without headroom a hop chopped the
// character off at the shoulders — the box has to cover the peak of the hop,
// not just the standing figure.
export const AVATAR_JUMP_HEADROOM = 80;

// The sprite's drawing box, in one place so the placement (AvatarWalker) and
// the art (AvatarSprite) can't drift apart. The figure is drawn on a 16x24
// pixel grid whose bottom row is the ground; the box adds headroom above for
// the jump and slack on both sides for the waved flag, which would otherwise
// be clipped at the grid's right edge.
const GRID_W = 16;
const GRID_H = 24;
// One grid pixel, in canvas px.
export const AVATAR_UNIT = (AVATAR_HEIGHT + 4) / GRID_H;
const SLACK_UNITS = 5;
const HEADROOM_UNITS = AVATAR_JUMP_HEADROOM / AVATAR_UNIT;

// The viewBox every sprite draws into: origin shifted up and left into the
// reserved space, so the art keeps working on the plain 0..16 / 0..24 grid
// whatever size the character is.
export const AVATAR_VIEW_BOX = `${-SLACK_UNITS} ${-HEADROOM_UNITS} ${GRID_W + SLACK_UNITS * 2} ${GRID_H + HEADROOM_UNITS}`;
// Sprite grid rows, for the lift transform (canvas px of jump -> grid units).
export const AVATAR_GRID_HEIGHT = GRID_H;

// The sprite's drawing box at a given size scale, in one place so the placement
// (AvatarWalker), the art (AvatarSprite), and the right-click hit-test can't
// drift apart.
export function avatarBox(scale = 1): {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
} {
  return {
    // Element size in canvas px.
    width: (GRID_W + SLACK_UNITS * 2) * AVATAR_UNIT * scale,
    height: (GRID_H + HEADROOM_UNITS) * AVATAR_UNIT * scale,
    // Where the character's feet sit inside that box, so the caller can place
    // the box from a feet position.
    offsetX: (GRID_W / 2 + SLACK_UNITS) * AVATAR_UNIT * scale,
    offsetY: (AVATAR_HEIGHT + AVATAR_JUMP_HEADROOM) * scale,
  };
}

// How close (canvas px) counts as "arrived", so a target is never chased
// by sub-pixel remainders forever.
const ARRIVE_EPSILON = 1.5;

// How near a viewport edge (SCREEN px) the avatar may get before the
// camera pans to keep it comfortably in frame.
export const AVATAR_FOLLOW_MARGIN = 120;

export type AvatarFacing = 'down' | 'up' | 'left' | 'right';

export type AvatarPoint = { x: number; y: number };

// Jump (Space, spec/101). Impulse + gravity in canvas px/s, tuned so the hop
// peaks around 70px and lands in a bit over half a second — high enough to
// read as a jump from across a room, short enough to spam.
export const AVATAR_JUMP_VELOCITY = 520;
export const AVATAR_GRAVITY = 1800;
// How long the flag keeps waving after the feet are back down, so the wave
// reads as a celebration rather than stopping dead on landing.
export const AVATAR_WAVE_TAIL_MS = 700;
// Milliseconds per flag-wave frame (3-frame cycle).
const WAVE_FRAME_MS = 110;

// One frame of a jump: `lift` is height above the ground in canvas px (0 =
// standing), `vy` the current upward velocity. Returns the landed state when
// the hop finishes, so the caller can clear it.
export function jumpStep(
  lift: number,
  vy: number,
  dtSeconds: number,
): { lift: number; vy: number; landed: boolean } {
  const dt = Math.max(0, dtSeconds);
  const nextVy = vy - AVATAR_GRAVITY * dt;
  const nextLift = lift + ((vy + nextVy) / 2) * dt;
  if (nextLift <= 0) return { lift: 0, vy: 0, landed: true };
  return { lift: nextLift, vy: nextVy, landed: false };
}

// The flag's wave frame (0..2) at a given point in the wave, or null once the
// wave is over. Time-based rather than distance-based: a wave happens standing
// still, so there is no travel to key it off.
export function waveFrame(elapsedMs: number, waveForMs: number): number | null {
  if (elapsedMs < 0 || elapsedMs > waveForMs) return null;
  return Math.floor(elapsedMs / WAVE_FRAME_MS) % 3;
}

// Is `point` (canvas coords) on the character? The sprite is drawn centred on
// its feet, so the box runs half a width either side and a full height up.
// Used by the right-click gender toggle, which must only fire when the press
// actually lands on the figure. `lift` raises the box mid-jump so a right-click
// still hits a character in the air, and `scale` follows the Size choice so a
// small character isn't clickable well outside itself (nor a tall one short).
export function hitTestAvatar(feet: AvatarPoint, point: AvatarPoint, lift = 0, scale = 1): boolean {
  const halfWidth = (AVATAR_WIDTH / 2) * scale;
  const height = AVATAR_HEIGHT * scale;
  return (
    point.x >= feet.x - halfWidth &&
    point.x <= feet.x + halfWidth &&
    point.y <= feet.y - lift &&
    point.y >= feet.y - lift - height
  );
}

// One frame of walking toward `target`, moving at most `speed * dt`.
// Returns the new position plus whether the target was reached this
// frame (so the caller can drop it and go idle). A null target or a
// zero-length delta returns the position untouched.
export function stepTowards(
  pos: AvatarPoint,
  target: AvatarPoint | null,
  dtSeconds: number,
  speed = AVATAR_SPEED,
): { pos: AvatarPoint; arrived: boolean } {
  if (!target) return { pos, arrived: false };
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= ARRIVE_EPSILON) return { pos: target, arrived: true };
  const travel = speed * Math.max(0, dtSeconds);
  if (travel >= dist) return { pos: target, arrived: true };
  return {
    pos: { x: pos.x + (dx / dist) * travel, y: pos.y + (dy / dist) * travel },
    arrived: false,
  };
}

// The unit direction the currently-held arrow keys point, or null when
// none are held. Opposite keys cancel; two perpendicular keys compose a
// NORMALISED diagonal so walking at 45 degrees isn't 1.41x faster.
export function arrowDirection(held: {
  up?: boolean;
  down?: boolean;
  left?: boolean;
  right?: boolean;
}): AvatarPoint | null {
  const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
  if (x === 0 && y === 0) return null;
  const len = Math.hypot(x, y);
  return { x: x / len, y: y / len };
}

// Which of the four facings a movement delta reads as. The dominant axis
// wins, with vertical taking a tie so a straight-down click doesn't flip
// the sprite sideways. A zero delta keeps the caller's current facing
// (returns null so it can decide).
export function facingFromDelta(dx: number, dy: number): AvatarFacing | null {
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

// The camera correction (in CANVAS px, i.e. already divided by zoom) that
// brings a point back inside `margin` of the viewport edges. Zero on both
// axes when the point is comfortably inside, so the common case is a no-op.
// `screen` is the avatar's position in viewport px; `size` is the canvas
// viewport in px. Positive dx moves the content right (the viewportOffset
// convention: the wrapper is translated by the offset before scaling).
export function followCorrection(
  screen: AvatarPoint,
  size: { width: number; height: number },
  zoom: number,
  margin = AVATAR_FOLLOW_MARGIN,
): AvatarPoint {
  // A margin wider than half the viewport would fight itself (both edges
  // pulling at once), so clamp it to something the viewport can satisfy.
  const mx = Math.min(margin, size.width / 2);
  const my = Math.min(margin, size.height / 2);
  const z = zoom > 0 ? zoom : 1;
  let dx = 0;
  let dy = 0;
  if (screen.x < mx) dx = (mx - screen.x) / z;
  else if (screen.x > size.width - mx) dx = (size.width - mx - screen.x) / z;
  if (screen.y < my) dy = (my - screen.y) / z;
  else if (screen.y > size.height - my) dy = (size.height - my - screen.y) / z;
  return { x: dx, y: dy };
}

// The id of the boxed element the avatar is standing on, or null. Feet
// first: the point tested is the position itself (the feet), and the
// FRONTMOST hit wins (later in the array = painted on top) so standing
// where two elements overlap rings the one the audience can see. Frames
// are skipped — a section backdrop covers half the canvas, and ringing it
// every time the avatar walks inside would be noise, not a highlight.
export function elementUnderFeet(elements: Element[], feet: AvatarPoint): string | null {
  let hit: string | null = null;
  for (const el of elements) {
    if (!isBoxed(el)) continue;
    if (el.type === 'shape' && el.shape === 'frame') continue;
    if (
      feet.x >= el.x &&
      feet.x <= el.x + el.width &&
      feet.y >= el.y &&
      feet.y <= el.y + el.height
    ) {
      hit = el.id;
    }
  }
  return hit;
}
