// The selection pill of a segmented control, as ONE shared element that slides
// to the selected segment rather than each segment fading its own fill in and
// out. Used by the Explorer panel's section tabs and the Share dialog's Valid
// lifetimes, which should move alike.
//
// Contract with the host: the track is `relative` with `p-0.5`, and its
// segments are equal-width (`flex-1`, or a grid of equal columns) with no gap,
// so the pill's width is the track width divided by the count (less the
// 0.25rem the padding takes) and each step is exactly 100% of it. A negative
// index (nothing selected) hides the pill. Segments sit above it (`relative
// z-10`). `className` carries the pill's fill and shadow.
export function SegmentSlider({
  count,
  index,
  className,
  flush = false,
}: {
  count: number;
  index: number;
  className: string;
  // Fills its track edge to edge instead of sitting 2px in, for a track drawn with a ring rather than padding, so
  // the selection is the full height of a button beside it.
  flush?: boolean;
}) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${flush ? 'inset-y-0 left-0' : 'bottom-0.5 left-0.5 top-0.5'} rounded-md transition-[transform,opacity,background-color] duration-short ease-out ${className} ${
        index < 0 ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        width: flush ? `calc(100% / ${count})` : `calc((100% - 0.25rem) / ${count})`,
        transform: `translateX(${Math.max(index, 0) * 100}%)`,
      }}
    />
  );
}
