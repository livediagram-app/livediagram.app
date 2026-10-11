// Which hero windows draw their board (docs/specs/019-marketing/marketing-site.md "Hero"): an
// inclusive range of window indexes. Each board is a large animated SVG, and a window out at the
// edge of the stage is masked away, so the hero draws only the centred window and its neighbours
// at first. Moving from one window to another slides every window between them across the stage
// and leaves the new one's neighbours peeking either side, so the range grows to cover them all,
// and a window never comes into view empty. It never shrinks: a board once drawn stays.
export type HeroReach = { lo: number; hi: number };

export function initialReach(active: number, count: number): HeroReach {
  return { lo: Math.max(0, active - 1), hi: Math.min(count - 1, active + 1) };
}

export function widenReach(reach: HeroReach, from: number, to: number, count: number): HeroReach {
  return {
    lo: Math.max(0, Math.min(reach.lo, from - 1, to - 1)),
    hi: Math.min(count - 1, Math.max(reach.hi, from + 1, to + 1)),
  };
}
