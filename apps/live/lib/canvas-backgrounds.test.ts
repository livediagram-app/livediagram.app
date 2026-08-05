import { describe, expect, it } from 'vitest';
import {
  ANIMATED_BACKGROUND_PATTERNS,
  type AnimatedBackgroundPattern,
  type BackgroundPattern,
} from '@livediagram/diagram';
import { tabBackgroundStyle } from './canvas-backgrounds';

// `tabBackgroundStyle` is the single entry point Canvas stamps onto
// its `<main>` element on every tab change. The catalogue of
// patterns is part of the user's tab settings (spec/09's Background
// accordion), so a future change that adds a pattern to the
// `BackgroundPattern` union must also add a case here. These tests
// pin the load-bearing invariants: every pattern returns a usable
// CSSProperties object, the pan offset round-trips through
// `backgroundPosition`, and the opacity slider fades the pattern
// colour in lockstep with the backdrop (the bug the inline comment
// in the source calls out).

// The static half, as a Record so the compiler owns it: a new pattern in the
// `BackgroundPattern` union fails to compile here until it's listed, naming
// the missing key. The comment above asked a future author to remember, and
// the five animated patterns then landed without it — the sweep below has
// been claiming "every BackgroundPattern in the union" while walking
// fourteen of nineteen ever since. Remembering is not a mechanism.
const STATIC_PATTERNS: Record<Exclude<BackgroundPattern, AnimatedBackgroundPattern>, true> = {
  grid: true,
  blank: true,
  lines: true,
  crosshatch: true,
  graph: true,
  confetti: true,
  stripes: true,
  diagonal: true,
  waves: true,
  bricks: true,
  isometric: true,
  hexagonal: true,
  engineering: true,
  checkerboard: true,
};

// The animated half comes straight from the tuple the source already exports
// and switches on, so it cannot disagree with it by construction.
const ALL_PATTERNS: BackgroundPattern[] = [
  ...(Object.keys(STATIC_PATTERNS) as BackgroundPattern[]),
  ...ANIMATED_BACKGROUND_PATTERNS,
];

const NO_OFFSET = { x: 0, y: 0 };

describe('tabBackgroundStyle', () => {
  it('emits a non-empty CSSProperties object for every BackgroundPattern in the union', () => {
    // Catches a future "new pattern landed in the union, the switch
    // forgot it" drift: the missing case would fall through to the
    // default `grid` branch (a small bug), but more importantly the
    // test below depends on every pattern being walked.
    for (const pattern of ALL_PATTERNS) {
      const style = tabBackgroundStyle(pattern, NO_OFFSET, '#ffffff', '#000000');
      expect(style).toBeTruthy();
      expect(style.backgroundColor).toBe('#ffffff');
    }
  });

  it('blank pattern returns just the background colour, no pattern image', () => {
    const style = tabBackgroundStyle('blank', NO_OFFSET, '#ffffff', '#000000');
    expect(style.backgroundColor).toBe('#ffffff');
    expect(style.backgroundImage).toBeUndefined();
  });

  it('animated patterns paint no static image — the overlay owns their motion', () => {
    // Their whole distinction from the static catalogue (spec/09): motion is
    // drawn by AnimatedCanvasBackground, so `tabBackgroundStyle` contributes
    // only the backdrop colour, exactly like Blank. A static branch added
    // here by mistake would double-paint underneath the overlay — and the
    // sweep above wouldn't notice, since it only checks the colour.
    for (const pattern of ANIMATED_BACKGROUND_PATTERNS) {
      const style = tabBackgroundStyle(pattern, NO_OFFSET, '#ffffff', '#000000');
      expect(style.backgroundColor).toBe('#ffffff');
      expect(style.backgroundImage).toBeUndefined();
    }
  });

  it('grid pattern emits a radial-gradient backgroundImage', () => {
    const style = tabBackgroundStyle('grid', NO_OFFSET, '#ffffff', '#000000');
    expect(style.backgroundImage).toMatch(/radial-gradient/);
    expect(style.backgroundImage).toContain('#000000');
  });

  it('confetti pattern emits the precomposed inline-SVG url (not the user-supplied patternColor)', () => {
    // Confetti is the one pattern that DELIBERATELY ignores the
    // patternColor: it picks its own multi-colour palette so it
    // reads as "fun" regardless. Passing a custom patternColor must
    // NOT leak it into the backgroundImage.
    const style = tabBackgroundStyle('confetti', NO_OFFSET, '#ffffff', '#deadbe');
    expect(style.backgroundImage).toMatch(/data:image\/svg\+xml/);
    expect(style.backgroundImage).not.toContain('#deadbe');
    expect(style.backgroundImage).not.toContain('%23deadbe');
  });

  it('pan offset round-trips into backgroundPosition for the patterns that tile with pan', () => {
    const offset = { x: 50, y: 100 };
    expect(tabBackgroundStyle('grid', offset, '#fff', '#000').backgroundPosition).toBe(
      `${offset.x}px ${offset.y}px`,
    );
    expect(tabBackgroundStyle('stripes', offset, '#fff', '#000').backgroundPosition).toBe(
      `${offset.x}px 0px`,
    );
    expect(tabBackgroundStyle('lines', offset, '#fff', '#000').backgroundPosition).toBe(
      `0px ${offset.y}px`,
    );
  });

  it('opacity < 1 converts both the background and the pattern colour to rgba (so the slider fades them in lockstep)', () => {
    // The slider used to leave the pattern lines at full opacity
    // while the backdrop faded, which read as a bug. The inline
    // comment in the source explicitly calls this out. This test
    // pins the behaviour so a future refactor can't drop the
    // pattern-side fade.
    const style = tabBackgroundStyle('lines', NO_OFFSET, '#abcdef', '#123456', 0.5);
    expect(style.backgroundColor).toBe('rgba(171, 205, 239, 0.5)');
    expect(style.backgroundImage).toContain('rgba(18, 52, 86, 0.5)');
  });

  it('opacity >= 1 keeps the original hex colours intact (no rgba conversion)', () => {
    const style = tabBackgroundStyle('grid', NO_OFFSET, '#abcdef', '#123456', 1);
    expect(style.backgroundColor).toBe('#abcdef');
    expect(style.backgroundImage).toContain('#123456');
  });

  it('non-hex colour strings pass through unchanged (theme keywords like "white" or "currentColor")', () => {
    // The hex-parse fallback path matters because a future theme
    // might ship a CSS keyword instead of `#rrggbb`. The opacity
    // wouldn't apply, but the call must not throw or emit
    // gibberish.
    const style = tabBackgroundStyle('grid', NO_OFFSET, 'white', 'black', 0.5);
    expect(style.backgroundColor).toBe('white');
    expect(style.backgroundImage).toContain('black');
  });

  it('pattern scale multiplies the tile size (background-size) but not the pan phase', () => {
    // The size slider scales every background-size length by the factor.
    // A single-layer 24px grid at 1.5x becomes 36px; background-position
    // (the pan phase) must stay untouched so the pattern still tracks pan.
    const base = tabBackgroundStyle('grid', NO_OFFSET, '#fff', '#000');
    const scaled = tabBackgroundStyle('grid', NO_OFFSET, '#fff', '#000', 1, 1.5);
    expect(base.backgroundSize).toBe('24px 24px');
    expect(scaled.backgroundSize).toBe('36px 36px');
    expect(scaled.backgroundPosition).toBe(base.backgroundPosition);
  });

  it('pattern scale applies to every layer of a multi-layer spec (graph)', () => {
    const scaled = tabBackgroundStyle('graph', NO_OFFSET, '#fff', '#000', 1, 2);
    expect(scaled.backgroundSize).toBe('48px 48px, 48px 48px');
  });

  it('pattern scale of 1 leaves the size string identical', () => {
    const base = tabBackgroundStyle('engineering', NO_OFFSET, '#fff', '#000');
    const same = tabBackgroundStyle('engineering', NO_OFFSET, '#fff', '#000', 1, 1);
    expect(same.backgroundSize).toBe(base.backgroundSize);
  });

  it('animated patterns contribute only the backdrop colour (the overlay draws motion)', () => {
    // Flow / Drift / Aurora / Ripple paint no static image: their motion
    // is the AnimatedCanvasBackground overlay's job. Here they must behave
    // like Blank (colour only) so the overlay isn't fighting a CSS image.
    for (const pattern of ['flow', 'drift', 'aurora', 'ripple', 'ribbons'] as const) {
      const style = tabBackgroundStyle(pattern, { x: 5, y: 9 }, '#abcdef', '#123456', 0.5);
      expect(style.backgroundColor).toBe('rgba(171, 205, 239, 0.5)');
      expect(style.backgroundImage).toBeUndefined();
      expect(style.backgroundSize).toBeUndefined();
    }
  });
});
