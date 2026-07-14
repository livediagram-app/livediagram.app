import type { BackgroundPattern } from '@livediagram/diagram';

// Canvas pattern + backdrop builders lifted out of Canvas.tsx. Pure
// functions: given a tab's chosen `BackgroundPattern`, the current
// pan offset, and the tab's colours, return either a single
// `React.CSSProperties` object (tabBackgroundStyle, what Canvas
// stamps onto the main element) or a CSS `url("data:image/svg+xml,...")`
// string for the patterns that need an inline SVG (plus, stars,
// waves, the precomposed confetti dots).
//
// Keeping these here means the Canvas component file stops carrying
// ~220 lines of CSS plumbing that doesn't need React state to do
// its job. Each helper is independently testable should the pattern
// catalogue grow.

// Compose the canvas main element's background pattern + pan offset so the
// pattern persists indefinitely as the user pans (it tiles forever, just
// shifting its phase by the canvas-coord offset).
// Confetti uses a fixed multi-colour SVG so the pattern reads as "fun"
// regardless of the user's pattern colour. # is URL-encoded as %23.
const CONFETTI_BG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'>" +
  "<circle cx='8' cy='12' r='2' fill='%23f87171'/>" +
  "<circle cx='25' cy='8' r='1.5' fill='%2360a5fa'/>" +
  "<circle cx='42' cy='15' r='2' fill='%23facc15'/>" +
  "<circle cx='52' cy='5' r='1.5' fill='%2334d399'/>" +
  "<circle cx='5' cy='30' r='1.5' fill='%23a78bfa'/>" +
  "<circle cx='20' cy='38' r='2' fill='%23fb923c'/>" +
  "<circle cx='38' cy='32' r='1.5' fill='%23ec4899'/>" +
  "<circle cx='50' cy='42' r='2' fill='%2334d399'/>" +
  "<circle cx='10' cy='50' r='2' fill='%2360a5fa'/>" +
  "<circle cx='30' cy='52' r='1.5' fill='%23facc15'/>" +
  "<circle cx='45' cy='55' r='2' fill='%23f87171'/>" +
  '</svg>")';

// Apply the user-controlled tab background opacity by converting the
// `#rrggbb` colour to `rgba(...)` with the supplied alpha. Hex parsing
// is permissive — anything else falls back to the colour as-is so a
// theme that ships a CSS keyword doesn't break.
function applyAlpha(color: string, alpha: number): string {
  if (alpha >= 1) return color;
  const match = /^#?([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const hex = match[1]!;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Scale every `<n>px` length in a CSS background-size spec by `k` (the
// user's pattern-size slider). Only background-size is scaled, never
// background-position, so the tiles grow / shrink while the pattern still
// tracks the pan offset at its original phase. Multi-layer specs (comma
// separated, e.g. graph / engineering) scale every layer.
function scaleBackgroundSize(spec: string, k: number): string {
  return spec.replace(/(\d+(?:\.\d+)?)px/g, (_, n: string) => `${Number(n) * k}px`);
}

export function tabBackgroundStyle(
  pattern: BackgroundPattern,
  offset: { x: number; y: number },
  backgroundColor: string,
  patternColor: string,
  backgroundOpacity = 1,
  patternScale = 1,
): React.CSSProperties {
  const style = patternStyleFor(pattern, offset, backgroundColor, patternColor, backgroundOpacity);
  if (patternScale !== 1 && typeof style.backgroundSize === 'string') {
    style.backgroundSize = scaleBackgroundSize(style.backgroundSize, patternScale);
  }
  return style;
}

function patternStyleFor(
  pattern: BackgroundPattern,
  offset: { x: number; y: number },
  backgroundColor: string,
  patternColor: string,
  backgroundOpacity: number,
): React.CSSProperties {
  const base: React.CSSProperties = {
    backgroundColor: applyAlpha(backgroundColor, backgroundOpacity),
  };
  // Apply the same alpha to the pattern colour so the lines / dots /
  // crosshatch fade in lockstep with the backdrop. Without this the
  // slider visually "stops working" before the pattern lines do — they
  // remain at full opacity over a faded background, which reads as a
  // bug. Confetti uses a precomposed inline SVG so it's unaffected.
  const fadedPatternColor = applyAlpha(patternColor, backgroundOpacity);
  // A dimmed pattern colour for the 'engineering' minor gridlines, so
  // the bolder major lines read against them. Still scales with the
  // backdrop opacity so the whole pattern fades in lockstep.
  const minorPatternColor = applyAlpha(patternColor, backgroundOpacity * 0.4);
  const px = offset.x;
  const py = offset.y;
  switch (pattern) {
    // Blank + the animated patterns paint no static background image: the
    // animated ones draw their motion via the AnimatedCanvasBackground
    // overlay (spec/09), so here they contribute only the (alpha-applied)
    // backdrop colour, exactly like Blank.
    case 'blank':
    case 'flow':
    case 'drift':
    case 'aurora':
    case 'ripple':
    case 'ribbons':
      return base;
    case 'lines':
      // A single tiled linear-gradient (one crisp 1px line per 24px
      // cell) rather than a repeating-linear-gradient: the repeating
      // form lets the rasterizer accumulate float error across the
      // whole element, so some lines land on a subpixel boundary and
      // anti-alias into a faint "double" line. An explicit
      // backgroundSize makes every cell rasterize identically.
      return {
        ...base,
        backgroundImage: `linear-gradient(0deg, ${fadedPatternColor} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
        backgroundPosition: `0px ${py}px`,
      };
    case 'crosshatch':
      // Inline-SVG tile (both diagonals corner-to-corner in an 18px
      // square) rather than two 45° repeating-linear-gradients. At 45°
      // the gradient's 1px stop is measured along the diagonal axis, so
      // it projects to a sub-pixel (~0.7px) line that anti-aliases into
      // a doubled pair and drifts as the element grows. An SVG tile
      // rasterizes once and tiles pixel-identically, so the lines stay
      // crisp and single (same approach as plus / stars / waves).
      return {
        ...base,
        backgroundImage: crosshatchBg(fadedPatternColor),
        backgroundSize: '18px 18px',
        backgroundPosition: `${px}px ${py}px`,
      };
    case 'graph':
      // Two tiled linear-gradients (one crisp 1px line per 24px cell,
      // per axis). See the 'lines' case: repeating-linear-gradient
      // grids drift onto subpixel boundaries and render doubled lines;
      // an explicit backgroundSize keeps every cell pixel-identical.
      return {
        ...base,
        backgroundImage:
          `linear-gradient(0deg, ${fadedPatternColor} 1px, transparent 1px), ` +
          `linear-gradient(90deg, ${fadedPatternColor} 1px, transparent 1px)`,
        backgroundSize: '24px 24px, 24px 24px',
        backgroundPosition: `0px ${py}px, ${px}px 0px`,
      };
    case 'confetti':
      return {
        ...base,
        backgroundImage: CONFETTI_BG,
        backgroundSize: '60px 60px',
        backgroundPosition: `${px}px ${py}px`,
      };
    case 'stripes':
      // Vertical lines counterpart to the existing horizontal 'lines'.
      // Same tiled-gradient fix as 'lines' to avoid doubled lines.
      return {
        ...base,
        backgroundImage: `linear-gradient(90deg, ${fadedPatternColor} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
        backgroundPosition: `${px}px 0px`,
      };
    case 'diagonal':
      // Single-direction 45° lines — distinct from crosshatch's two.
      // SVG tile for the same reason crosshatch uses one (see above):
      // a 45° repeating-linear-gradient renders sub-pixel doubled lines.
      return {
        ...base,
        backgroundImage: diagonalBg(fadedPatternColor),
        backgroundSize: '18px 18px',
        backgroundPosition: `${px}px ${py}px`,
      };
    case 'waves':
      // Gentle sinusoidal stripes via inline SVG. Reads as a soft
      // texture, not a structural grid.
      return {
        ...base,
        backgroundImage: wavesBg(fadedPatternColor),
        backgroundSize: '48px 24px',
        backgroundPosition: `${px}px ${py}px`,
      };
    case 'bricks':
      // Staggered horizontal lines + alternating vertical separators
      // give a brick masonry impression without an SVG. Even rows
      // use full-cell separators; we fake the staggered offset by
      // tiling at 2x the cell height.
      return {
        ...base,
        backgroundImage:
          `repeating-linear-gradient(0deg, ${fadedPatternColor} 0 1px, transparent 1px 18px), ` +
          `repeating-linear-gradient(90deg, ${fadedPatternColor} 0 1px, transparent 1px 36px)`,
        backgroundSize: '36px 18px',
        backgroundPosition: `${px}px ${py}px, ${(px + 18) % 36}px ${py}px`,
      };
    case 'isometric':
      // Isometric rhombi: two ~30° diagonals corner-to-corner in a
      // √3:1 tile. Like the crosshatch/diagonal tiles, an SVG that
      // rasterizes once keeps the lines crisp and seam-free. Reads as
      // 3D / technical "isometric paper".
      return {
        ...base,
        backgroundImage: isometricBg(fadedPatternColor),
        backgroundSize: '28px 16px',
        backgroundPosition: `${px}px ${py}px`,
      };
    case 'checkerboard':
      // Alternating filled squares via a tiled conic-gradient — the
      // only solid-fill pattern in the catalogue, so it reads as
      // distinct from every line/dot grid. Anchored by background-size
      // so the squares stay crisp (no drift).
      return {
        ...base,
        backgroundImage: `conic-gradient(${fadedPatternColor} 25%, transparent 0 50%, ${fadedPatternColor} 0 75%, transparent 0)`,
        backgroundSize: '24px 24px',
        backgroundPosition: `${px}px ${py}px`,
      };
    case 'hexagonal':
      // Honeycomb. Hand-rolling a seamless stroked hex grid is
      // fiddly, so we use the proven heropatterns hexagon tile (a
      // single fill path engineered to tile at 28×49). Picks up the
      // active pattern colour via `fill`.
      return {
        ...base,
        backgroundImage: hexagonBg(fadedPatternColor),
        backgroundSize: '28px 49px',
        backgroundPosition: `${px}px ${py}px`,
      };
    case 'engineering':
      // Engineering graph paper: a fine 24px minor grid with a bolder
      // major line every 5th cell (120px). Pure tiled linear-gradients
      // (no SVG) so it stays crisp; minor lines run lighter than major
      // so the scale reads. Both fade in lockstep with the backdrop.
      return {
        ...base,
        backgroundImage:
          `linear-gradient(0deg, ${minorPatternColor} 1px, transparent 1px), ` +
          `linear-gradient(90deg, ${minorPatternColor} 1px, transparent 1px), ` +
          `linear-gradient(0deg, ${fadedPatternColor} 2px, transparent 2px), ` +
          `linear-gradient(90deg, ${fadedPatternColor} 2px, transparent 2px)`,
        backgroundSize: '24px 24px, 24px 24px, 120px 120px, 120px 120px',
        backgroundPosition: `${px}px ${py}px, ${px}px ${py}px, ${px}px ${py}px, ${px}px ${py}px`,
      };
    case 'grid':
    default:
      return {
        ...base,
        backgroundImage: `radial-gradient(circle, ${fadedPatternColor} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
        backgroundPosition: `${px}px ${py}px`,
      };
  }
}

// Inline-SVG backgrounds for the patterns whose glyphs can't be built
// from linear-gradient stripes. URL-encoded so they can sit inside a
// CSS `url(...)` value — `#` MUST become `%23`. These pick up the
// tab's `patternColor` (already alpha-adjusted by the caller).

// Isometric rhombi: both ~30° diagonals corner-to-corner in a 28×16
// tile (atan(16/28) ≈ 30°). Corner-to-corner lines always tile
// seamlessly, so the rhombus grid is continuous and drift-free.
function isometricBg(stroke: string): string {
  const enc = stroke.replace(/#/g, '%23');
  return (
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='16'>" +
    `<path d='M0 16 L28 0 M0 0 L28 16' stroke='${enc}' stroke-width='1' fill='none'/>` +
    '</svg>")'
  );
}

// Honeycomb. The heropatterns.com hexagon tile: a single even-odd fill
// path engineered to tile seamlessly at 28×49, drawn as thin outlines.
function hexagonBg(fill: string): string {
  const enc = fill.replace(/#/g, '%23');
  return (
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='49'>" +
    `<path d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z' fill='${enc}'/>` +
    '</svg>")'
  );
}

// Diagonal hatch tiles. A line drawn corner-to-corner in a square tile
// tiles into a continuous set of evenly spaced 45° lines, so these read
// as crisp single diagonals (unlike a 45° repeating-linear-gradient,
// whose sub-pixel stop doubles — see the crosshatch/diagonal cases).
function diagonalBg(stroke: string): string {
  const enc = stroke.replace(/#/g, '%23');
  return (
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18'>" +
    `<path d='M0 18 L18 0' stroke='${enc}' stroke-width='1' fill='none'/>` +
    '</svg>")'
  );
}

function crosshatchBg(stroke: string): string {
  const enc = stroke.replace(/#/g, '%23');
  // Both diagonals corner-to-corner → a diamond crosshatch grid.
  return (
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18'>" +
    `<path d='M0 18 L18 0 M0 0 L18 18' stroke='${enc}' stroke-width='1' fill='none'/>` +
    '</svg>")'
  );
}

function wavesBg(stroke: string): string {
  const enc = stroke.replace(/#/g, '%23');
  // Sine wave tile — quadratic peaks/troughs across a 48-wide span
  // so the pattern reads as gentle horizontal ripples. Stroke width
  // is intentionally light so the texture stays subtle.
  return (
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='24'>" +
    `<path d='M0 12 Q12 4 24 12 T48 12' fill='none' stroke='${enc}' stroke-width='1'/>` +
    '</svg>")'
  );
}

// ── Background pattern as an SVG tile, for the image export (spec/48) ─────
//
// The editor paints the backdrop pattern as a CSS background-image; an export
// can't capture that, so this returns the SAME pattern as one tile of raw SVG
// (raw `#` colours) for the export to drop into an SVG `<pattern>` (and to
// rasterise onto the PNG/PDF canvas). Returns null for the patterns that paint
// no static image — Blank and the animated ones (their motion is a live
// overlay, so a still frame is just the backdrop colour). The geometry mirrors
// the CSS builders above; it lives here so the pattern catalogue stays in one
// module.
//
// `scale` (the tab's pattern-size slider) is baked in: the tile grows and its
// content scales with it, matching `scaleBackgroundSize`. `opacity` fades the
// pattern colour in lockstep with the backdrop, like the CSS path.
type BackgroundPatternTile = { width: number; height: number; content: string };

export function backgroundPatternTile(
  pattern: BackgroundPattern,
  patternColor: string,
  opacity = 1,
  scale = 1,
): BackgroundPatternTile | null {
  const c = applyAlpha(patternColor, opacity);
  const minor = applyAlpha(patternColor, opacity * 0.4);
  // Confetti's fixed multi-colour dots (raw `#`), mirroring CONFETTI_BG.
  const confetti =
    "<circle cx='8' cy='12' r='2' fill='#f87171'/><circle cx='25' cy='8' r='1.5' fill='#60a5fa'/>" +
    "<circle cx='42' cy='15' r='2' fill='#facc15'/><circle cx='52' cy='5' r='1.5' fill='#34d399'/>" +
    "<circle cx='5' cy='30' r='1.5' fill='#a78bfa'/><circle cx='20' cy='38' r='2' fill='#fb923c'/>" +
    "<circle cx='38' cy='32' r='1.5' fill='#ec4899'/><circle cx='50' cy='42' r='2' fill='#34d399'/>" +
    "<circle cx='10' cy='50' r='2' fill='#60a5fa'/><circle cx='30' cy='52' r='1.5' fill='#facc15'/>" +
    "<circle cx='45' cy='55' r='2' fill='#f87171'/>";
  // [baseW, baseH, inner SVG]. Geometry mirrors patternStyleFor / the *Bg
  // builders above; a `default` (grid dots) covers grid + any unlisted kind.
  const spec = ((): { w: number; h: number; inner: string } | null => {
    switch (pattern) {
      case 'blank':
      case 'flow':
      case 'drift':
      case 'aurora':
      case 'ripple':
      case 'ribbons':
        return null;
      case 'lines':
        return { w: 24, h: 24, inner: `<path d='M0 0.5 H24' stroke='${c}' stroke-width='1'/>` };
      case 'stripes':
        return { w: 24, h: 24, inner: `<path d='M0.5 0 V24' stroke='${c}' stroke-width='1'/>` };
      case 'graph':
        return {
          w: 24,
          h: 24,
          inner: `<path d='M0 0.5 H24 M0.5 0 V24' stroke='${c}' stroke-width='1' fill='none'/>`,
        };
      case 'crosshatch':
        return {
          w: 18,
          h: 18,
          inner: `<path d='M0 18 L18 0 M0 0 L18 18' stroke='${c}' stroke-width='1' fill='none'/>`,
        };
      case 'diagonal':
        return {
          w: 18,
          h: 18,
          inner: `<path d='M0 18 L18 0' stroke='${c}' stroke-width='1' fill='none'/>`,
        };
      case 'waves':
        return {
          w: 48,
          h: 24,
          inner: `<path d='M0 12 Q12 4 24 12 T48 12' fill='none' stroke='${c}' stroke-width='1'/>`,
        };
      case 'isometric':
        return {
          w: 28,
          h: 16,
          inner: `<path d='M0 16 L28 0 M0 0 L28 16' stroke='${c}' stroke-width='1' fill='none'/>`,
        };
      case 'hexagonal':
        return {
          w: 28,
          h: 49,
          inner: `<path d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z' fill='${c}'/>`,
        };
      case 'confetti':
        return { w: 60, h: 60, inner: confetti };
      case 'checkerboard':
        return {
          w: 24,
          h: 24,
          inner: `<rect x='12' y='0' width='12' height='12' fill='${c}'/><rect x='0' y='12' width='12' height='12' fill='${c}'/>`,
        };
      case 'bricks':
        return {
          w: 36,
          h: 36,
          inner: `<path d='M0 0.5 H36 M0 18.5 H36 M0.5 0 V18 M18.5 18 V36' stroke='${c}' stroke-width='1' fill='none'/>`,
        };
      case 'engineering':
        // Fine 24px minor grid (lighter) + a bolder major line every 120px.
        return {
          w: 120,
          h: 120,
          inner:
            `<path d='M0 24 H120 M0 48 H120 M0 72 H120 M0 96 H120 M24 0 V120 M48 0 V120 M72 0 V120 M96 0 V120' stroke='${minor}' stroke-width='1' fill='none'/>` +
            `<path d='M0 0.5 H120 M0.5 0 V120' stroke='${c}' stroke-width='2' fill='none'/>`,
        };
      case 'grid':
      default:
        return { w: 24, h: 24, inner: `<circle cx='12' cy='12' r='1' fill='${c}'/>` };
    }
  })();
  if (!spec) return null;
  return {
    width: spec.w * scale,
    height: spec.h * scale,
    content: scale === 1 ? spec.inner : `<g transform='scale(${scale})'>${spec.inner}</g>`,
  };
}
