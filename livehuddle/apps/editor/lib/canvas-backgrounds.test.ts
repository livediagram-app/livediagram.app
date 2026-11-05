import { describe, expect, it } from 'vitest';
import {
  FLOOR_PATTERNS,
  RETIRED_PATTERN_FLOORS,
  SEASONAL_BACKGROUND_PATTERNS,
  type BackgroundPattern,
} from '@livehuddle/document';
import {
  backgroundPatternTile,
  safeCssColor,
  tabBackgroundStyle,
  worldPatternOrigin,
} from './canvas-backgrounds';
import { floorTile } from './floor-tiles';

// `tabBackgroundStyle` is what Canvas stamps onto its main element. livehuddle's canvas wears a floor
// (docs/specs/011-theme/floors.md): every stored pattern draws as a floor, None, or a seasonal motif, a retired diagram
// pattern as the floor it maps to.

const NO_OFFSET = { x: 0, y: 0 };
const RETIRED = Object.keys(RETIRED_PATTERN_FLOORS) as BackgroundPattern[];

describe('tabBackgroundStyle', () => {
  it('draws every floor as one SVG tile over the canvas colour, tracking the pan', () => {
    for (const floor of FLOOR_PATTERNS) {
      const style = tabBackgroundStyle(floor, { x: 50, y: 100 }, '#ffffff', '#000000');
      expect(style.backgroundColor, floor).toBe('#ffffff');
      expect(style.backgroundImage, floor).toMatch(/^url\("data:image\/svg\+xml;utf8,<svg /);
      expect(style.backgroundImage, floor).not.toMatch(/#[0-9a-f]/i);
      const tile = floorTile(floor, false);
      expect(style.backgroundSize, floor).toBe(`${tile.w}px ${tile.h}px`);
      expect(style.backgroundPosition, floor).toBe('50px 100px');
    }
  });

  it('draws a retired diagram pattern exactly as the floor it maps to', () => {
    for (const pattern of RETIRED) {
      const drawn = RETIRED_PATTERN_FLOORS[pattern as keyof typeof RETIRED_PATTERN_FLOORS];
      expect(tabBackgroundStyle(pattern, NO_OFFSET, '#fff', '#000'), pattern).toEqual(
        tabBackgroundStyle(drawn, NO_OFFSET, '#fff', '#000'),
      );
    }
  });

  it('None paints just the canvas colour', () => {
    const style = tabBackgroundStyle('blank', NO_OFFSET, '#ffffff', '#000000');
    expect(style.backgroundColor).toBe('#ffffff');
    expect(style.backgroundImage).toBeUndefined();
  });

  it('takes the dark floor on a dark canvas and the light one on a light canvas', () => {
    const light = tabBackgroundStyle('grass', NO_OFFSET, '#f8fafc', '#000');
    const dark = tabBackgroundStyle('grass', NO_OFFSET, '#0f172a', '#000');
    expect(light.backgroundImage).not.toBe(dark.backgroundImage);
    expect(light.backgroundImage).toContain(floorTile('grass', false).inner.replace(/#/g, '%23'));
    expect(dark.backgroundImage).toContain(floorTile('grass', true).inner.replace(/#/g, '%23'));
  });

  it('fades a floor into the canvas colour below full strength, the canvas itself staying solid', () => {
    const style = tabBackgroundStyle('wood', NO_OFFSET, '#abcdef', '#123456', 0.5);
    expect(style.backgroundColor).toBe('#abcdef');
    expect(style.backgroundImage).toContain("<g opacity='0.5'>");
    expect(
      tabBackgroundStyle('wood', NO_OFFSET, '#abcdef', '#123456', 1).backgroundImage,
    ).not.toContain('opacity');
  });

  it('builds the same string for the same floor, so a pan frame re-encodes nothing', () => {
    const a = tabBackgroundStyle('cobbles', { x: 1, y: 2 }, '#fff', '#000', 0.4);
    const b = tabBackgroundStyle('cobbles', { x: 9, y: 7 }, '#fff', '#000', 0.4);
    expect(a.backgroundImage).toBe(b.backgroundImage);
  });

  it('draws a seasonal motif in the pattern colour, faded in lockstep with the backdrop', () => {
    for (const motif of SEASONAL_BACKGROUND_PATTERNS) {
      const style = tabBackgroundStyle(motif, { x: 5, y: 6 }, '#abcdef', '#123456', 0.5);
      expect(style.backgroundColor, motif).toBe('rgba(171, 205, 239, 0.5)');
      expect(style.backgroundImage, motif).toContain('rgba(18, 52, 86, 0.5)');
      expect(style.backgroundPosition, motif).toBe('5px 6px');
    }
  });

  it('non-hex colour strings pass through unchanged (theme keywords like "white")', () => {
    const style = tabBackgroundStyle('sparkles', NO_OFFSET, 'white', 'black', 0.5);
    expect(style.backgroundColor).toBe('white');
    expect(style.backgroundImage).toContain('black');
  });

  it('pattern scale multiplies the tile size (background-size) but not the pan phase', () => {
    const base = tabBackgroundStyle('tiles', NO_OFFSET, '#fff', '#000');
    const scaled = tabBackgroundStyle('tiles', NO_OFFSET, '#fff', '#000', 1, 1.5);
    expect(base.backgroundSize).toBe('144px 144px');
    expect(scaled.backgroundSize).toBe('216px 216px');
    expect(scaled.backgroundPosition).toBe(base.backgroundPosition);
    expect(tabBackgroundStyle('tiles', NO_OFFSET, '#fff', '#000', 1, 1).backgroundSize).toBe(
      base.backgroundSize,
    );
  });
});

describe('backgroundPatternTile', () => {
  it('exports a floor as its own tile, faded and scaled as on the canvas', () => {
    const tile = backgroundPatternTile('concrete', '#000', 0.5, 2, '#ffffff')!;
    expect(tile.width).toBe(480);
    expect(tile.height).toBe(480);
    expect(tile.content).toContain("<g transform='scale(2)'><g opacity='0.5'>");
    expect(tile.content).toContain(floorTile('concrete', false).inner);
  });

  it('exports the dark floor for a dark canvas, and nothing for None', () => {
    expect(backgroundPatternTile('mud', '#000', 1, 1, '#111111')!.content).toBe(
      floorTile('mud', true).inner,
    );
    expect(backgroundPatternTile('blank', '#000')).toBeNull();
    expect(backgroundPatternTile('flow', '#000')).toBeNull();
  });

  it('exports a retired pattern as its floor', () => {
    expect(backgroundPatternTile('grid', '#000')).toEqual(
      backgroundPatternTile('carpet-tiles', '#000'),
    );
  });
});

// The static pattern lives in world space (docs/specs/008-canvas/canvas-and-palette.md "Canvas"): its origin
// lands where the element layer (`scale(z) translate(o)` about the canvas
// centre) puts world point (0, 0), so elements keep their place on the pattern
// at any zoom. A phone opens at 0.6, where the raw offset drifted on every pan.
describe('worldPatternOrigin', () => {
  const size = { w: 400, h: 800 };
  const elementScreen = (p: { x: number; y: number }, o: { x: number; y: number }, z: number) => ({
    x: z * (p.x + o.x) + (1 - z) * (size.w / 2),
    y: z * (p.y + o.y) + (1 - z) * (size.h / 2),
  });

  it('is the offset itself at zoom 1', () => {
    expect(worldPatternOrigin({ x: 30, y: -12 }, 1, size)).toEqual({ x: 30, y: -12 });
  });

  it('lands where the element layer puts the world origin at any zoom', () => {
    for (const z of [0.6, 0.25, 2]) {
      const o = { x: 57, y: -140 };
      expect(worldPatternOrigin(o, z, size)).toEqual(elementScreen({ x: 0, y: 0 }, o, z));
    }
  });

  it('moves by exactly as much as an element when the view pans', () => {
    const z = 0.6;
    const before = worldPatternOrigin({ x: 0, y: 0 }, z, size);
    const after = worldPatternOrigin({ x: 100, y: 50 }, z, size);
    expect(after.x - before.x).toBeCloseTo(z * 100);
    expect(after.y - before.y).toBeCloseTo(z * 50);
  });
});

// A pattern colour is document data another editor chooses, and it lands in
// SVG markup that the export preview renders as HTML.
describe('pattern colour sanitising', () => {
  it('keeps plain colours', () => {
    for (const c of [
      '#abc',
      '#a1b2c3',
      '#a1b2c3d4',
      'rgb(1, 2, 3)',
      'hsla(10, 20%, 30%, 0.5)',
      'red',
    ]) {
      expect(safeCssColor(c), c).toBe(c);
    }
  });

  it('replaces anything that could leave its attribute', () => {
    for (const c of ["x'/><img src=x onerror=alert(1)>", 'red")', 'url(x)', 'rgb(1,2,3)"', '']) {
      expect(safeCssColor(c), c).toBe('transparent');
    }
  });

  it('never splices a hostile colour into a seasonal tile', () => {
    const tile = backgroundPatternTile('sparkles', "x'/><img src=x onerror=alert(1)>");
    expect(tile!.content).not.toContain('<img');
    expect(tile!.content).toContain("fill='transparent'");
  });

  it('never splices a hostile canvas colour into a floor', () => {
    const style = tabBackgroundStyle('wood', { x: 0, y: 0 }, "x'/><img src=x>", '#000');
    expect(style.backgroundColor).toBe('transparent');
    expect(String(style.backgroundImage)).not.toContain('<img');
  });
});
