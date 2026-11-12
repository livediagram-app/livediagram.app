import { describe, expect, it } from 'vitest';
import { cpuGrowthRatio, cpuMsOf, cpuRatioCeiling } from '@liveworkspace/vitest-config/cpu-time';
import { BACKGROUND_PATTERNS } from '@liveworkspace/model-core/basics';
import {
  applyAlpha,
  createCanvasBackgrounds,
  safeCssColor,
  scaleBackgroundSize,
  svgTileUrl,
  worldPatternOrigin,
} from './canvas-backgrounds';

// The shared builders (each editor's lib/canvas-backgrounds.ts binds them and keeps its own suite over its
// patterns). These pin the shared behaviour: every pattern yields a style and a tile, a seasonal motif wins over
// the switch, and an editor without isometric paper draws a stored 'isometric' as the grid.
const SEASONAL = { w: 10, h: 12, inner: "<path d='M0 0' stroke='#fff'/>" };
const seasonalPatternTile = (pattern: string) => (pattern === 'sparkles' ? SEASONAL : null);
const PATTERNS = [...BACKGROUND_PATTERNS, 'isometric', 'unknown-kind'];
const withIso = createCanvasBackgrounds<string>({ seasonalPatternTile, isometric: true });
const without = createCanvasBackgrounds<string>({ seasonalPatternTile });
const OFF = { x: 3, y: 4 };

describe('createCanvasBackgrounds', () => {
  it('builds a style and a tile for every pattern', () => {
    for (const p of PATTERNS) {
      const style = withIso.tabBackgroundStyle(p, OFF, '#ffffff', '#000000', 0.5, 2);
      expect(style.backgroundColor).toBe('rgba(255, 255, 255, 0.5)');
      without.tabBackgroundStyle(p, OFF, '#ffffff', '#000000');
      const tile = withIso.backgroundPatternTile(p, '#000000', 0.5, 2);
      if (tile) expect(tile.width).toBeGreaterThan(0);
      without.backgroundPatternTile(p, '#000000');
    }
  });

  it('draws isometric paper only where the editor has it', () => {
    const grid = without.tabBackgroundStyle('grid', OFF, '#fff', '#000');
    expect(without.tabBackgroundStyle('isometric', OFF, '#fff', '#000')).toEqual(grid);
    expect(withIso.tabBackgroundStyle('isometric', OFF, '#fff', '#000')).not.toEqual(grid);
    expect(without.backgroundPatternTile('isometric', '#000')).toEqual(
      without.backgroundPatternTile('grid', '#000'),
    );
    expect(withIso.backgroundPatternTile('isometric', '#000')?.width).toBe(28);
  });

  it('takes the seasonal motif first, on both paths', () => {
    expect(withIso.tabBackgroundStyle('sparkles', OFF, '#fff', '#000').backgroundImage).toBe(
      svgTileUrl(SEASONAL),
    );
    expect(withIso.backgroundPatternTile('sparkles', '#000', 1, 1)).toEqual({
      width: 10,
      height: 12,
      content: SEASONAL.inner,
    });
  });

  it('scales the tile content with the pattern size', () => {
    expect(withIso.backgroundPatternTile('lines', '#000', 1, 2)?.content).toMatch(
      /^<g transform='scale\(2\)'>/,
    );
    expect(withIso.backgroundPatternTile('blank', '#000')).toBeNull();
  });
});

describe('the shared helpers', () => {
  it('keeps only plain colours', () => {
    expect(safeCssColor('#abc')).toBe('#abc');
    expect(safeCssColor('red"/><script>')).toBe('transparent');
  });

  it('fades a hex colour and leaves the rest', () => {
    expect(applyAlpha('#ff0000', 1)).toBe('#ff0000');
    expect(applyAlpha('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(applyAlpha('red', 0.5)).toBe('red');
  });

  it('scales every px length of a background size', () => {
    expect(scaleBackgroundSize('24px 24px, 120px 120px', 2)).toBe('48px 48px, 240px 240px');
    expect(scaleBackgroundSize('1.5px 0.25px', 2)).toBe('3px 0.5px');
    expect(scaleBackgroundSize('12.3.4px', 2)).toBe('12.6.8px');
    expect(scaleBackgroundSize('x5px', 3)).toBe('x15px');
  });

  // A long run of digits with no px used to be rescanned from every digit (quadratic). Four times the
  // input must cost about four times the CPU, never sixteen; a quadratic scan reads 16 here.
  it('reads a long run of digits with no px in linear time', () => {
    const spec = (n: number) => '0'.repeat(n) + 'x';
    const small = spec(20_000);
    const large = spec(80_000);
    const time = (s: string) => () =>
      cpuMsOf(() => {
        for (let i = 0; i < 4; i++) scaleBackgroundSize(s, 2);
      });
    expect(cpuGrowthRatio(time(small), time(large), { ceiling: cpuRatioCeiling(8) })).toBeLessThan(
      cpuRatioCeiling(8),
    );
  });

  it('memoises a tile url per tile object', () => {
    expect(svgTileUrl(SEASONAL)).toBe(svgTileUrl(SEASONAL));
    expect(svgTileUrl(SEASONAL)).toContain('%23fff');
  });

  it('places the pattern origin in world space', () => {
    expect(worldPatternOrigin({ x: 10, y: 20 }, 1, { w: 100, h: 50 })).toEqual({ x: 10, y: 20 });
    expect(worldPatternOrigin({ x: 0, y: 0 }, 0.5, { w: 100, h: 50 })).toEqual({ x: 25, y: 12.5 });
  });
});
