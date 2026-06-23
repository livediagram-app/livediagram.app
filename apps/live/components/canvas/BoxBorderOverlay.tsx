import type { ShapeKind } from '@livediagram/diagram';

// SVG border for the four CSS-rendered shapes (square / circle /
// stadium / browser). Their fill + corner radius still come from the
// wrapper div, but a CSS `border-style` can't draw the composite dash
// patterns (long-dash, dash-dot, dash-dot-dot), so when one of those is
// picked we drop the wrapper's CSS border and stroke the outline here
// with a real `stroke-dasharray` instead. The viewBox is the element's
// pixel size (preserveAspectRatio="none"), so coordinates are 1:1 with
// screen pixels and the outline never distorts on a stretched box.
export function BoxBorderOverlay({
  shape,
  width,
  height,
  stroke,
  strokeWidth,
  dasharray,
  radiusPx,
}: {
  shape: ShapeKind;
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  // SVG dasharray string for the chosen pattern (never the solid case,
  // which is left to the cheaper CSS path).
  dasharray: string;
  // Corner radius for the square / browser rounded rectangle, in px.
  radiusPx: number;
}) {
  if (strokeWidth <= 0 || width <= 0 || height <= 0) return null;
  // Stroke straddles the path centre, so inset by half its width to
  // keep the whole border inside the box (matching CSS's inside border).
  const inset = strokeWidth / 2;
  const w = width - strokeWidth;
  const h = height - strokeWidth;

  const common = {
    fill: 'none',
    stroke,
    strokeWidth,
    strokeDasharray: dasharray,
    // Round caps render the dotted / dash-dot dots as true dots and
    // match the picker's preview icons.
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  let outline;
  if (shape === 'circle') {
    outline = <ellipse cx={width / 2} cy={height / 2} rx={w / 2} ry={h / 2} {...common} />;
  } else {
    // square / browser use the user's pixel radius; stadium is a pill
    // (radius = half the short side). Clamp so the radius never exceeds
    // what the box can hold.
    const maxR = Math.min(w, h) / 2;
    const r = shape === 'stadium' ? maxR : Math.min(Math.max(radiusPx - inset, 0), maxR);
    outline = <rect x={inset} y={inset} width={w} height={h} rx={r} ry={r} {...common} />;
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {outline}
    </svg>
  );
}
