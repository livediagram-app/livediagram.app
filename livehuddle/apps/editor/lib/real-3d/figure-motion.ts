// Real 3D's character motion (docs/specs/008-canvas/3d-engine.md "Characters"): how a character really moves, read
// from where its feet are each frame. Its smoothed velocity sets its stride, and it faces the way it moves at any
// angle (a diagonal walk faces the diagonal), turning the short way round; standing, it keeps its way until the
// walker's own facing changes. Pure: no three.js, canvas px throughout.

export type Facing = 'down' | 'up' | 'left' | 'right';

/** A facing's turn about the vertical, 0 facing down the canvas (+y), a quarter turn facing left. */
export const YAW: Record<Facing, number> = {
  down: 0,
  left: Math.PI / 2,
  up: Math.PI,
  right: -Math.PI / 2,
};

/** A move faster than this (canvas px a second at size 1) is a jump, not a walk (the run is about 500). */
const MAX_GLIDE = 1400;
/** Slower than this (canvas px a second at size 1) it is standing, and keeps the way it faces. */
const STANDING = 10;

/**
 * Turns `yaw` the short way toward `want`: quickly at first, easing in as it lines up, at up to 2.5 turns a second
 * (`brisk` 1, a fast walk) or 1.2 (`brisk` 0, a turn on the spot).
 */
export function turnToward(yaw: number, want: number, dt: number, brisk: number): number {
  const d = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
  const maxStep = (7.5 + 8 * brisk) * dt;
  const eased = d * Math.min(1, dt * (9 + 6 * brisk));
  return yaw + Math.max(-maxStep, Math.min(maxStep, eased));
}

/** The way a velocity heads, as a yaw (see YAW). */
export const headingOf = (vx: number, vy: number) => Math.atan2(-vx, vy);

export class FigureMotion {
  yaw: number;
  /** Speed (canvas px a second) and turn (radians a second, left positive) this frame. */
  speed = 0;
  turn = 0;
  private want: number;
  private facing: Facing;
  private last: { x: number; y: number } | null = null;
  private vx = 0;
  private vy = 0;

  constructor(facing: Facing) {
    this.facing = facing;
    this.yaw = this.want = YAW[facing] ?? 0;
  }

  /** Takes this frame's feet; `scale` is the character's size (its speeds scale with it). */
  update(
    feet: { x: number; y: number },
    dt: number,
    facing: Facing,
    seated: boolean,
    scale = 1,
  ): void {
    const prev = this.last;
    this.last = { x: feet.x, y: feet.y };
    const vx = prev && dt > 0 ? (feet.x - prev.x) / dt : 0;
    const vy = prev && dt > 0 ? (feet.y - prev.y) / dt : 0;
    if (!prev || Math.hypot(vx, vy) > MAX_GLIDE * scale) this.vx = this.vy = 0;
    else {
      const k = Math.min(1, dt * 12);
      this.vx += (vx - this.vx) * k;
      this.vy += (vy - this.vy) * k;
    }
    this.speed = seated ? 0 : Math.hypot(this.vx, this.vy);
    const moving = this.speed > STANDING * scale;
    if (moving) this.want = headingOf(this.vx, this.vy);
    else if (facing !== this.facing || seated) this.want = YAW[facing] ?? 0;
    this.facing = facing;
    const before = this.yaw;
    this.yaw = turnToward(this.yaw, this.want, dt, Math.min(1, this.speed / (120 * scale)));
    const d = this.yaw - before;
    this.turn = dt > 0 ? Math.atan2(Math.sin(d), Math.cos(d)) / dt : 0;
  }
}
