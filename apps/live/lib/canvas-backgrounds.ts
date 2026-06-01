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

export function tabBackgroundStyle(
  pattern: BackgroundPattern,
  offset: { x: number; y: number },
  backgroundColor: string,
  patternColor: string,
  backgroundOpacity = 1,
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
  const px = offset.x;
  const py = offset.y;
  switch (pattern) {
    case 'blank':
      return base;
    case 'lines':
      return {
        ...base,
        backgroundImage: `repeating-linear-gradient(0deg, transparent 0 23px, ${fadedPatternColor} 23px 24px)`,
        backgroundPosition: `0px ${py}px`,
      };
    case 'crosshatch':
      return {
        ...base,
        backgroundImage:
          `repeating-linear-gradient(45deg, transparent 0 17px, ${fadedPatternColor} 17px 18px), ` +
          `repeating-linear-gradient(-45deg, transparent 0 17px, ${fadedPatternColor} 17px 18px)`,
        backgroundPosition: `${px}px ${py}px, ${px}px ${py}px`,
      };
    case 'graph':
      return {
        ...base,
        backgroundImage:
          `repeating-linear-gradient(0deg, transparent 0 23px, ${fadedPatternColor} 23px 24px), ` +
          `repeating-linear-gradient(90deg, transparent 0 23px, ${fadedPatternColor} 23px 24px)`,
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
      return {
        ...base,
        backgroundImage: `repeating-linear-gradient(90deg, transparent 0 23px, ${fadedPatternColor} 23px 24px)`,
        backgroundPosition: `${px}px 0px`,
      };
    case 'diagonal':
      // Single-direction 45° lines — distinct from crosshatch's two.
      return {
        ...base,
        backgroundImage: `repeating-linear-gradient(45deg, transparent 0 17px, ${fadedPatternColor} 17px 18px)`,
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
    case 'plus':
      // Sprinkled + signs via inline SVG. Uses currentColor would
      // require additional wrapping; we inline the patternColor.
      return {
        ...base,
        backgroundImage: plusBg(fadedPatternColor),
        backgroundSize: '32px 32px',
        backgroundPosition: `${px}px ${py}px`,
      };
    case 'stars':
      // Sprinkled stars via inline SVG.
      return {
        ...base,
        backgroundImage: starBg(fadedPatternColor),
        backgroundSize: '48px 48px',
        backgroundPosition: `${px}px ${py}px`,
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
// CSS `url(...)` value — `#` MUST become `%23`. Both patterns pick up
// the tab's `patternColor` (already alpha-adjusted by the caller).
function plusBg(stroke: string): string {
  const enc = stroke.replace(/#/g, '%23');
  return (
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>" +
    `<path d='M16 10 L16 22 M10 16 L22 16' stroke='${enc}' stroke-width='1.5' stroke-linecap='round' fill='none'/>` +
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

function starBg(stroke: string): string {
  const enc = stroke.replace(/#/g, '%23');
  // Five-point star path centred at (24, 24) with radius ~5.
  return (
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>" +
    `<path d='M24 19 L25.5 22.5 L29 23 L26.5 25.5 L27 29 L24 27.5 L21 29 L21.5 25.5 L19 23 L22.5 22.5 Z' fill='${enc}'/>` +
    '</svg>")'
  );
}
