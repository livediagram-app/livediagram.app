'use client';

// The photo sliders' scale and the brush tip drawing (docs/specs/031-photo/photo-pages.md "The options flyout"): a
// range a hundredfold or more (a tip's 1 to 2500 px) runs on a log scale so the small sizes get room, and a tip's
// Size and Hardness are drawn as the tip itself (the options flyout's Tip section, the quick panel).
// A range at least this many times its low end runs on a log scale.
const LOG_RANGE = 100;
// The slider's positions on a log scale.
const LOG_STEPS = 1000;

/** Whether the slider for [min, max] runs on a log scale. */
export const logScaled = (min: number, max: number): boolean => min > 0 && max / min >= LOG_RANGE;

/** The value at slider position `p` (0 to LOG_STEPS) on a log scale, held to `step`. */
export function fromLogPosition(p: number, min: number, max: number, step: number): number {
  const v = min * Math.pow(max / min, p / LOG_STEPS);
  return Math.min(max, Math.max(min, Math.round(v / step) * step));
}

/** The slider position (0 to LOG_STEPS) of `v` on a log scale. */
export const toLogPosition = (v: number, min: number, max: number): number =>
  (Math.log(Math.max(min, v) / min) / Math.log(max / min)) * LOG_STEPS;

/** A tip drawn at its size (squeezed to fit) and hardness, over a checkerboard. */
export function TipPreview({
  size,
  hardness,
  small = false,
}: {
  size: number;
  hardness: number;
  // The quick panel's: shorter, and the tip held to its height.
  small?: boolean;
}) {
  // The tip's diameter on screen: its own up to 56 px, beyond that a log squeeze, so a change always shows.
  const full = size <= 56 ? Math.max(2, size) : Math.min(76, 56 + Math.log2(size / 56) * 5);
  const d = small ? Math.min(full, 40) : full;
  const solid = Math.round(hardness * 100);
  return (
    <div
      aria-hidden
      className={`flex ${small ? 'h-14' : 'h-20'} items-center justify-center rounded-lg ring-1 ring-slate-200/80 dark:ring-slate-700`}
      style={{
        backgroundImage: 'repeating-conic-gradient(#f1f5f9 0 25%, #fff 0 50%)',
        backgroundSize: '12px 12px',
      }}
    >
      <span
        className="block rounded-full"
        style={{
          width: d,
          height: d,
          background: `radial-gradient(circle closest-side, rgb(15 23 42) ${Math.min(solid, 99)}%, rgb(15 23 42 / 0) 100%)`,
        }}
      />
    </div>
  );
}
