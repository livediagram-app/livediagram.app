import {
  BORDER_DASH_ARRAY,
  BORDER_STROKE_PX,
  BROWSER_CHROME,
  catmullRomToBezierPath,
  DEFAULT_BORDER_STROKE,
  DEFAULT_BORDER_STYLE,
  type FreehandElement,
} from '@livediagram/diagram';

// Browser chrome rendered as fixed-pixel HTML rather than scaled SVG so
// the window dots stay round, the nav icons keep their stroke weight,
// and the URL bar grows to fill the available width at any aspect
// ratio. The outer frame comes from the SVG layer (so the user's
// themed fill / border style / dashed pattern apply); the divider line
// under the chrome is drawn here as this strip's bottom border so it
// rides with the FIXED chrome height rather than scaling with the box.
// Counter-scaled by `zoom` is intentionally NOT applied — chrome
// elements should scale with the canvas zoom like the rest of the
// shape so a small browser at low zoom still reads as a browser.
// Every size and glyph comes from the shared BROWSER_CHROME table
// (@livediagram/diagram shape-geometry.ts), which the headless export
// lays out the same way, so an exported browser matches this strip.
export function BrowserChrome({ stroke, zoom: _zoom }: { stroke: string; zoom: number }) {
  const c = BROWSER_CHROME;
  const dot = { width: c.dotPx, height: c.dotPx, backgroundColor: stroke };
  return (
    <div
      aria-hidden
      // The address bar is a FIXED height pinned to the top: resizing
      // the browser only grows the content area below, never the
      // chrome. The height is in element space, so it still scales
      // with canvas zoom like the rest of the shape. pointer-events:
      // none so it never intercepts clicks on the shape itself.
      // Span the full width: the frame is now the wrapper's own CSS
      // border, so left-0 / right-0 lands the bottom divider exactly on
      // the inner edges of the side border instead of overhanging it.
      className="pointer-events-none absolute left-0 right-0 top-0 flex items-center"
      style={{
        height: c.heightPx,
        paddingLeft: c.padXPx,
        paddingRight: c.padXPx,
        gap: c.groupGapPx,
        color: stroke,
        borderBottom: `1px solid ${stroke}`,
      }}
    >
      {/* Three traffic-light window dots. Fixed-pixel so they stay
          round regardless of how the box stretches. */}
      <div className="flex shrink-0 items-center" style={{ gap: c.dotGapPx }}>
        <span className="rounded-full" style={dot} aria-hidden />
        <span className="rounded-full" style={dot} aria-hidden />
        <span className="rounded-full" style={dot} aria-hidden />
      </div>
      {/* Back / forward / reload icons. Single SVG group with fixed
          pixel size so the icon weight + spacing stays consistent. */}
      <svg
        width={c.nav.widthPx}
        height={c.nav.heightPx}
        viewBox={c.nav.viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={c.nav.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
        aria-hidden
      >
        {c.nav.paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
      {/* URL pill. Flex-fills the remaining width so it scales with
          the shape; the height stays fixed so it always reads as a
          pill no matter how tall the chrome strip is. */}
      <div
        className="min-w-0 flex-1 rounded-full border"
        style={{ height: c.pillHeightPx, borderColor: stroke }}
        aria-hidden
      />
    </div>
  );
}

// Renders a FreehandElement's stored polyline as a smooth SVG path.
// Points are stored normalised into [0..1] within the element's
// bounding box (see createFreehand), so the renderer maps them into
// viewBox [0..100] and lets `preserveAspectRatio="none"` stretch the
// curve when the user resizes. The stroke colour comes from theme
// (with the per-element override), matching how other boxed elements
// pick their accent.
export function FreehandSvg({
  element,
  fill,
  stroke,
}: {
  element: FreehandElement;
  fill: string;
  stroke: string;
}) {
  // Map normalised points to the 100x100 viewBox before threading
  // them through the smoothing helper. `points.length < 2` collapses
  // to an empty path; the renderer then draws nothing, which is the
  // right behaviour for a degenerate single-click "stroke".
  const vbPoints = element.points.map((p) => ({ x: p.nx * 100, y: p.ny * 100 }));
  // Polygon-tool paths (docs/specs/008-canvas/polygon-tool.md) keep their deliberate corners:
  // straight M/L segments instead of the Catmull-Rom smoothing the
  // sampled pencil strokes want.
  const d =
    vbPoints.length < 2
      ? ''
      : element.straightEdges
        ? vbPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') +
          (element.closed ? ' Z' : '')
        : catmullRomToBezierPath(vbPoints, element.closed);
  const dasharray = BORDER_DASH_ARRAY[element.strokeStyle ?? DEFAULT_BORDER_STYLE];
  const widthPx = BORDER_STROKE_PX[element.strokeWidth ?? DEFAULT_BORDER_STROKE];
  // Highlighter recipe (docs/specs/008-canvas/highlighter.md): the marker owns width + translucency
  // (fixed wide round stroke, multiply blend, never filled) so the
  // border-preset widths and dash styles don't apply. Kept in sync
  // with svgFreehandShape (the headless twin) by the spec.
  const isHighlighter = element.pen === 'highlighter';
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {d ? (
        <path
          d={d}
          // Closed paths get the fill; open strokes leave fill at
          // none so the bounding box doesn't read as a closed shape.
          fill={element.closed && !isHighlighter ? fill : 'none'}
          stroke={stroke}
          strokeWidth={isHighlighter ? (element.penWidth ?? 14) : widthPx}
          strokeOpacity={isHighlighter ? 0.45 : undefined}
          style={isHighlighter ? { mixBlendMode: 'multiply' } : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={isHighlighter ? undefined : (dasharray ?? undefined)}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}
