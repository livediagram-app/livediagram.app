// Real 3D's adaptive quality (docs/specs/008-canvas/3d-engine.md "Performance"): how sharp the scene is drawn, chosen
// for the device and kept there by its own frame rate (the owner, 2026-11-27: "Can you detect based on the users
// compute capability?"). A slower device starts softer; any device steps down a level when frames keep coming late
// while things move, and back up after a long run of easy frames. Pure: no DOM, no three.js.

/** The pixel ratios the scene may draw at, sharpest first (each capped by the screen's own). */
export const QUALITY_RATIOS = [2, 1.75, 1.5, 1.25, 1] as const;

/** A frame slower than this (ms, at the 60 fps pace) counts as late. */
const LATE_MS = 1000 / 50;
/** An easy frame: well inside the 60 fps budget. */
const EASY_MS = 1000 / 58;
/** How many busy frames are judged at a time. */
const WINDOW = 45;
/** Late frames in a window that step quality down. */
const DOWN_AT = 0.35;
/** Easy windows in a row before quality steps back up. */
const UP_AFTER = 6;

export type DeviceHints = {
  /** WEBGL_debug_renderer_info's unmasked renderer, when the browser gives it. */
  gpu?: string | null;
  cores?: number;
  memoryGb?: number;
  mobile?: boolean;
};

/** The level to start at: the sharpest for a strong machine, softer for integrated or phone graphics. */
export function startLevel(h: DeviceHints): number {
  const gpu = (h.gpu ?? '').toLowerCase();
  let level = 0;
  if (/intel|mali|adreno|powervr|swiftshader|llvmpipe|software/.test(gpu)) level = 2;
  if ((h.cores ?? 8) <= 4 || (h.memoryGb ?? 8) <= 4) level = Math.max(level, 2);
  if (h.mobile) level = Math.max(level, 2);
  if (/swiftshader|llvmpipe|software/.test(gpu)) level = QUALITY_RATIOS.length - 1;
  return level;
}

/** Watches the frames drawn while the scene is busy and says when to step the level. */
export class FrameGovernor {
  level: number;
  private late = 0;
  private count = 0;
  private easyRuns = 0;
  private easyInWindow = 0;

  constructor(level: number) {
    this.level = Math.max(0, Math.min(QUALITY_RATIOS.length - 1, level));
  }

  get ratio(): number {
    return QUALITY_RATIOS[this.level]!;
  }

  /**
   * Takes the gap (ms) since the last frame drawn while the scene was busy (calm frames are paced at 30 and say
   * nothing). Returns true when the level changed.
   */
  frame(gapMs: number): boolean {
    // A gap far past any frame is a pause (a hidden tab, a stall elsewhere), not the scene's cost.
    if (gapMs > 250) return false;
    this.count++;
    if (gapMs > LATE_MS) this.late++;
    if (gapMs < EASY_MS) this.easyInWindow++;
    if (this.count < WINDOW) return false;
    const lateShare = this.late / this.count;
    const easy = this.easyInWindow / this.count > 0.9;
    this.count = this.late = this.easyInWindow = 0;
    if (lateShare >= DOWN_AT && this.level < QUALITY_RATIOS.length - 1) {
      this.level++;
      this.easyRuns = 0;
      return true;
    }
    this.easyRuns = easy ? this.easyRuns + 1 : 0;
    if (this.easyRuns >= UP_AFTER && this.level > 0) {
      this.level--;
      this.easyRuns = 0;
      return true;
    }
    return false;
  }
}
