// Smoothing (docs/specs/031-photo/photo-tools.md "Shared gestures and options"): the stroke follows
// the pointer on a string, moving only once the pointer is further than the string's length, so a
// shaky hand draws an even line. The string is the smoothing (0..1) times a reach in photo px.

export type SmoothPoint = { x: number; y: number; pressure?: number };

export class Smoother {
  private readonly reach: number;
  private at: SmoothPoint | null = null;

  /** `smoothing` 0..1; `reach` the string's length at full smoothing, px. */
  constructor(smoothing: number, reach = 40) {
    this.reach = Math.max(0, Math.min(1, smoothing)) * reach;
  }

  /** The point the stroke moves to for a pointer at `p`, or null while it stays put. */
  push(p: SmoothPoint): SmoothPoint | null {
    if (!this.at || this.reach === 0) {
      this.at = p;
      return p;
    }
    const dx = p.x - this.at.x;
    const dy = p.y - this.at.y;
    const d = Math.hypot(dx, dy);
    if (d <= this.reach) return null;
    const k = (d - this.reach) / d;
    this.at = { x: this.at.x + dx * k, y: this.at.y + dy * k, pressure: p.pressure };
    return this.at;
  }

  /** The stroke catches up with the pointer as it lifts. */
  finish(p: SmoothPoint): SmoothPoint | null {
    if (!this.at || (this.at.x === p.x && this.at.y === p.y)) return null;
    this.at = p;
    return p;
  }
}
