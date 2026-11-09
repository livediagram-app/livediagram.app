// Avatar mode geometry (docs/specs/008-canvas/avatar-mode.md): the pure maths behind the walking
// character — one frame's step toward a target, the direction the held
// arrow keys point, which way the figure faces, the camera nudge that
// keeps it on screen, and what it is standing on. No React, no DOM, so
// the walk behaviour is unit-testable without a canvas.

import { isFloorShape, isSceneryShape, isWallPieceShape } from './office-geometry';
import { hasSceneBox, isSceneShape, type AvatarSceneElement } from './scene';

// Walk speed in CANVAS px per second. Constant on purpose: an eased
// glide reads as a camera move, a constant walk reads as a character.
// The space between a Selection Mode button's bottom edge and the top of the character's head when that button is
// what put you in Avatar mode (docs/specs/009-elements/mode-button.md): the whole figure stands clear of the button,
// so it reads as standing in front of it and never hides the button's label.
export const AVATAR_SPAWN_GAP = 12;

type ButtonBox = { x: number; y: number; width: number; height: number };

// Where a character of size `scale` stands to be just below `button` (docs/specs/008-canvas/avatar-mode.md "Entering
// from a button"): centred on it, its head AVATAR_SPAWN_GAP under the button's bottom edge. The position is the feet,
// so the figure's height goes in too: with the gap alone, a Regular figure stood over the button and hid its label.
export function avatarSpawnBelow(button: ButtonBox, scale: number): AvatarPoint {
  return {
    x: button.x + button.width / 2,
    y: button.y + button.height + AVATAR_SPAWN_GAP + avatarFigureHeight(scale),
  };
}

// Where pressing a Selection Mode button should put a character of size `scale` on entry: just below the button
// (avatarSpawnBelow). Null for a button of another mode, and for a press made IN Avatar mode, which leaves it: a spawn
// point set then outlived the walk, so the next entry from the palette put the character back at the button.
export function avatarSpawnFromButton(
  button: ButtonBox,
  buttonMode: string,
  currentTool: string,
  scale: number,
): AvatarPoint | null {
  if (buttonMode !== 'avatar' || currentTool === 'avatar') return null;
  return avatarSpawnBelow(button, scale);
}

// How far a shoved character slides, in canvas px (docs/specs/008-canvas/avatar-mode.md). Far enough to be
// unmistakably a push, short enough that nobody gets flung across the canvas.
export const AVATAR_SHOVE_DISTANCE = 70;

// How often a STANDING character republishes itself to the room (docs/specs/008-canvas/avatar-mode.md).
// Presence is published on change, so without this a motionless character is
// invisible to anyone who joins after it stopped moving. Slow on purpose: it
// only has to beat "how long before the newcomer wonders where you are".
export const AVATAR_HEARTBEAT_MS = 3000;

// How close the pusher stands before shoving: just outside the other
// character, so the two meet rather than overlap.
const AVATAR_SHOVE_REACH = 46;

export const AVATAR_SPEED = 260;

// Sprite footprint in canvas px at the REGULAR size. The position point is the
// FEET, so the body is drawn above it and centred on it. The Size choice in the
// Avatar Panel (docs/specs/008-canvas/avatar-mode.md) scales these via avatarBox(scale).
export const AVATAR_WIDTH = 40;
export const AVATAR_HEIGHT = 56;
// What a character carries over its head (AvatarWalker), as rises in canvas px above the top of its head
// (AVATAR_HEIGHT * scale up from the feet): a peer's name chip, your own status chip and the away Zz. The highest,
// AVATAR_HEAD_CHROME, is how far above a head anything else must stay to be seen (a seat's name pill, chair-sitters.ts).
export const AVATAR_NAME_CHIP_RISE = 16;
export const AVATAR_STATUS_CHIP_RISE = 22;
export const AVATAR_ZZ_RISE = 24;
export const AVATAR_HEAD_CHROME = Math.max(
  AVATAR_NAME_CHIP_RISE,
  AVATAR_STATUS_CHIP_RISE,
  AVATAR_ZZ_RISE,
);
// Empty space reserved ABOVE the standing sprite so a jump has somewhere to go.
// The sprite's SVG clips at its viewBox, so without headroom a hop chopped the
// character off at the shoulders — the box has to cover the peak of the hop,
// not just the standing figure.
const AVATAR_JUMP_HEADROOM = 80;

// The sprite's drawing box, in one place so the placement (AvatarWalker) and
// the art (AvatarSprite) can't drift apart. The figure is drawn on a 16x24
// pixel grid whose bottom row is the ground; the box adds headroom above for
// the jump and slack on both sides for the waved flag, which would otherwise
// be clipped at the grid's right edge.
const GRID_W = 16;
const GRID_H = 24;
// One grid pixel, in canvas px.
const AVATAR_UNIT = (AVATAR_HEIGHT + 4) / GRID_H;
const SLACK_UNITS = 5;
const HEADROOM_UNITS = AVATAR_JUMP_HEADROOM / AVATAR_UNIT;

// The viewBox every sprite draws into: origin shifted up and left into the
// reserved space, so the art keeps working on the plain 0..16 / 0..24 grid
// whatever size the character is.
export const AVATAR_VIEW_BOX = `${-SLACK_UNITS} ${-HEADROOM_UNITS} ${GRID_W + SLACK_UNITS * 2} ${GRID_H + HEADROOM_UNITS}`;
// A CROPPED viewBox for a standing portrait — the figure with a little room for
// tall hair, and none of the jump headroom / flag slack. The panel preview uses
// it so the box hugs the character instead of framing mostly empty space.
const PORTRAIT_TOP_UNITS = 4;
export const AVATAR_PORTRAIT_VIEW_BOX = `0 ${-PORTRAIT_TOP_UNITS} ${GRID_W} ${GRID_H + PORTRAIT_TOP_UNITS}`;

// How far the standing figure reaches above its feet at a given scale, tallest hair included: the portrait's top, so
// whatever stands that far above the feet clears every hairstyle.
export function avatarFigureHeight(scale = 1): number {
  return (AVATAR_HEIGHT + PORTRAIT_TOP_UNITS * AVATAR_UNIT) * scale;
}

// Size of that cropped portrait in px at a given scale, for the preview's own
// box (the walking box above is deliberately much bigger).
export function avatarPortraitBox(scale = 1): { width: number; height: number } {
  return {
    width: GRID_W * AVATAR_UNIT * scale,
    height: (GRID_H + PORTRAIT_TOP_UNITS) * AVATAR_UNIT * scale,
  };
}
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

// Jump (Space, docs/specs/008-canvas/avatar-mode.md). Impulse + gravity in canvas px/s, tuned so the hop
// peaks around 70px and lands in a bit over half a second — high enough to
// read as a jump from across a room, short enough to spam.
export const AVATAR_JUMP_VELOCITY = 520;
const AVATAR_GRAVITY = 1800;
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

// Clicking a PEER's character walks over and shoves it (docs/specs/008-canvas/avatar-mode.md). Given the
// click point, our own feet, and the peers on screen, this returns who was hit,
// where to stand to reach them, and which way the shove goes — or null when the
// click landed on bare canvas.
//
// Pure so the whole decision is testable: the alternative (working it out
// inside the pointer handler) can only be checked by driving two browsers.
export function peerPushTarget(
  peers: { id: string; feet: AvatarPoint; lift?: number; scale?: number }[],
  point: AvatarPoint,
  here: AvatarPoint | null,
): { id: string; dx: number; dy: number; standAt: AvatarPoint } | null {
  for (const peer of peers) {
    if (!hitTestAvatar(peer.feet, point, peer.lift ?? 0, peer.scale ?? 1)) continue;
    // The shove points from us to them, so they travel away from us. Standing
    // on the same spot (or having no character yet) pushes straight down —
    // any direction beats none.
    const rawX = here ? peer.feet.x - here.x : 0;
    const rawY = here ? peer.feet.y - here.y : 1;
    const len = Math.hypot(rawX, rawY);
    const dx = len === 0 ? 0 : rawX / len;
    const dy = len === 0 ? 1 : rawY / len;
    return {
      id: peer.id,
      dx,
      dy,
      // Stop just short of them rather than walking through them.
      standAt: {
        x: peer.feet.x - dx * AVATAR_SHOVE_REACH,
        y: peer.feet.y - dy * AVATAR_SHOVE_REACH,
      },
    };
  }
  return null;
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

// How far the character walks (canvas px) for an off-centre view to close half its gap to it
// (docs/specs/008-canvas/avatar-mode.md "The camera").
export const AVATAR_CAMERA_HALF_LIFE = 400;

// The centred camera's step (docs/specs/008-canvas/avatar-mode.md "The camera"): the viewport offset after the
// character moved `from` -> `to`. The canvas wrapper is `scale(zoom) translate(offset)` about its own centre, so the
// offset that centres a point p is `size / 2 - p` at any zoom, and `from + offset - size / 2` is how far (canvas px)
// the character stands off the middle of the view. A centred view moves with every step; an off-centre one stays put
// while the walk closes the gap itself and otherwise gravitates back by distance walked.
export function centredCamera(
  offset: AvatarPoint,
  from: AvatarPoint,
  to: AvatarPoint,
  size: { width: number; height: number },
  zoom: number,
): AvatarPoint {
  const z = zoom > 0 ? zoom : 1;
  const cx = size.width / 2;
  const cy = size.height / 2;
  const centred = { x: cx - to.x, y: cy - to.y };
  const off = { x: from.x + offset.x - cx, y: from.y + offset.y - cy };
  const gap = Math.hypot(off.x, off.y);
  // Within a screen pixel counts as centred.
  if (gap * z < 1) return centred;
  const stay = { x: to.x + offset.x - cx, y: to.y + offset.y - cy };
  // Walking towards the middle of the view: the camera waits for you.
  if (Math.hypot(stay.x, stay.y) < gap) return offset;
  // Any other way, the gap shrinks with distance walked, so the character never ends further off the middle (or
  // nearer an edge) than it started the step.
  const keep = Math.pow(0.5, Math.hypot(to.x - from.x, to.y - from.y) / AVATAR_CAMERA_HALF_LIFE);
  return { x: centred.x + off.x * keep, y: centred.y + off.y * keep };
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
// Only an element with a box can be stood on (every product's boxed kinds; never an arrow).
export function elementUnderFeet(
  elements: readonly AvatarSceneElement[],
  feet: AvatarPoint,
): string | null {
  let hit: string | null = null;
  for (const el of elements) {
    if (!hasSceneBox(el)) continue;
    const shape = isSceneShape(el) ? el.shape : null;
    if (shape === 'frame') continue;
    // A fence is not a destination (docs/specs/009-elements/fence.md): walking along one must not ring it.
    if (shape === 'fence') continue;
    // Nor is the office's floor and scenery (docs/specs/009-elements/office.md): a room or a rug is where you
    // stand, and a plant or a bookshelf is walked round.
    // Nor is a piece on a wall (a notice board, a world clock): walked past, not to.
    if (shape !== null && (isFloorShape(shape) || isSceneryShape(shape) || isWallPieceShape(shape)))
      continue;
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

/**
 * Whether stepping onto a seat piece sits the character down (docs/specs/009-elements/chair.md "Only the
 * chair you are going to"): always when steered there (no click-walk target), and on a click-walk only when the walk's
 * destination is inside that piece, so a walk that crosses a chair on its way somewhere else goes straight through.
 */
export function sitsOnEntry(
  seat: { x: number; y: number; width: number; height: number },
  target: AvatarPoint | null,
): boolean {
  if (!target) return true;
  return (
    target.x >= seat.x &&
    target.x <= seat.x + seat.width &&
    target.y >= seat.y &&
    target.y <= seat.y + seat.height
  );
}

// The viewport offset that centres a box (a portal, an Avatar Pad) in a viewport of `size`, at any zoom. The canvas
// transform is `scale(zoom) translate(offset)` about the viewport's centre, so a point p sits mid-screen when
// `offset = size / 2 - p` whatever the zoom (as `centredCamera` reads it).
export function viewportOffsetCentredOn(
  box: { x: number; y: number; width: number; height: number },
  size: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: size.width / 2 - (box.x + box.width / 2),
    y: size.height / 2 - (box.y + box.height / 2),
  };
}
