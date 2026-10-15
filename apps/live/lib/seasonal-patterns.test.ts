import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import { SEASONAL_BACKGROUND_PATTERNS } from '@livediagram/document';
import { backgroundPatternTile, tabBackgroundStyle } from './canvas-backgrounds';
import { seasonalPatternTile } from './seasonal-patterns';

// The seasonal canvas patterns (docs/specs/011-theme/canvas-and-theme-dialog.md "Seasonal looks").
describe('seasonal patterns', () => {
  it('draws a tile for every seasonal pattern, and none for the rest', () => {
    for (const p of SEASONAL_BACKGROUND_PATTERNS) {
      const tile = seasonalPatternTile(p, '#123456');
      expect(tile, p).not.toBeNull();
      expect(tile!.inner, p).toContain('#123456');
    }
    expect(seasonalPatternTile('grid', '#123456')).toBeNull();
    expect(seasonalPatternTile('drift', '#123456')).toBeNull();
  });

  it('paints the live canvas from the same tile, colour-encoded, tracking the pan', () => {
    for (const p of SEASONAL_BACKGROUND_PATTERNS) {
      const tile = seasonalPatternTile(p, '#123456')!;
      const style = tabBackgroundStyle(p, { x: 7, y: 9 }, '#ffffff', '#123456');
      expect(style.backgroundImage, p).toMatch(/^url\("data:image\/svg\+xml;utf8,<svg /);
      expect(style.backgroundImage, p).toContain('%23123456');
      expect(style.backgroundImage, p).not.toContain('#');
      expect(style.backgroundSize, p).toBe(`${tile.w}px ${tile.h}px`);
      expect(style.backgroundPosition, p).toBe('7px 9px');
    }
  });

  it('fades with the strength slider and scales with the size slider', () => {
    const faded = tabBackgroundStyle('snowflakes', { x: 0, y: 0 }, '#ffffff', '#123456', 0.5);
    expect(faded.backgroundImage).toContain('rgba(18, 52, 86, 0.5)');
    const big = tabBackgroundStyle('eggs', { x: 0, y: 0 }, '#ffffff', '#123456', 1, 2);
    expect(big.backgroundSize).toBe('96px 96px');
  });

  it('exports the same tile, scaled', () => {
    for (const p of SEASONAL_BACKGROUND_PATTERNS) {
      const tile = seasonalPatternTile(p, '#123456')!;
      expect(backgroundPatternTile(p, '#123456'), p).toEqual({
        width: tile.w,
        height: tile.h,
        content: tile.inner,
      });
      expect(backgroundPatternTile(p, '#123456', 1, 2)!.width, p).toBe(tile.w * 2);
    }
  });

  it('keeps an unsafe pattern colour out of the markup', () => {
    const style = tabBackgroundStyle('cobwebs', { x: 0, y: 0 }, '#fff', "red'/><script>");
    expect(style.backgroundImage).not.toContain('<script>');
  });
});

describe('seasonal pattern cost on a pan frame', () => {
  it('builds each tile once per colour, so a repeat style call stays cheap', () => {
    const first = seasonalPatternTile('snowflakes', '#abcdef');
    expect(seasonalPatternTile('snowflakes', '#abcdef')).toBe(first);
    tabBackgroundStyle('snowflakes', { x: 0, y: 0 }, '#fff', '#abcdef');
    const runs = 2000;
    // ~2ms for the lot measured (~1µs a call); a rebuild every frame took ~22ms. Best of three, on CPU time.
    const best = Math.min(
      ...[0, 1, 2].map(() =>
        cpuMsOf(() => {
          for (let i = 0; i < runs; i++)
            tabBackgroundStyle('snowflakes', { x: i, y: i }, '#fff', '#abcdef');
        }),
      ),
    );
    expect(best).toBeLessThan(cpuBudgetMs(10));
  });
});
