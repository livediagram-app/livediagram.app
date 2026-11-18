import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colour-math';
import type { TextGround } from './text-contrast';
import { judgeText } from './text-contrast-judge';
import type { TextContrastProbe } from './text-contrast-probe';

// Each product's docs/specs/004-interface-design/colour-picker.md "Reading on its ground": several grounds, the worst
// counts.
const PAPER: TextGround = { tones: ['#ffffff'], on: 'page' };
const CREAM: TextGround = { tones: ['#fef3c7'], on: 'card' };
const probe = (
  ground: TextGround,
  current: string | null,
  extra: Partial<TextContrastProbe> = {},
): TextContrastProbe => ({
  ground,
  large: false,
  exported: false,
  current,
  colourOf: (id) => (id.startsWith('#') ? id : null),
  ...extra,
});

describe('judgeText', () => {
  it('judges nothing without a colour', () => {
    expect(judgeText([probe(PAPER, null)], null)).toBeNull();
    expect(judgeText([probe(PAPER, '#000000')], 'transparent')).toBeNull();
  });

  it('judges the colour in force, or the swatch named', () => {
    expect(judgeText([probe(PAPER, '#000000')], null)!.passes).toBe(true);
    const j = judgeText([probe(PAPER, '#000000')], '#fde047')!;
    expect(j).toMatchObject({ passes: false, colour: '#fde047', on: 'page', failing: 1, of: 1 });
    expect(contrastRatio(j.suggestion!, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('takes the worst of several grounds, by how far under its own target each is', () => {
    const big = probe(CREAM, '#8a8a8a', { large: true });
    const small = probe(PAPER, '#8a8a8a', { exported: true });
    const j = judgeText([big, small], null)!;
    // 3.4:1 on white misses 4.5 by more than 3.2:1 on cream misses 3 (it passes).
    expect(j).toMatchObject({ on: 'page', exported: true, failing: 1, of: 2, needed: 4.5 });
  });

  it('offers a shade passing on every ground, as normal text unless all are large', () => {
    const j = judgeText([probe(PAPER, '#94a3b8'), probe(CREAM, '#94a3b8')], null)!;
    expect(j.failing).toBe(2);
    expect(contrastRatio(j.suggestion!, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(j.suggestion!, '#fef3c7')).toBeGreaterThanOrEqual(4.5);
    const large = judgeText(
      [probe(PAPER, '#b0b0b0', { large: true }), probe(CREAM, '#b0b0b0', { large: true })],
      null,
    )!;
    expect(contrastRatio(large.suggestion!, '#fef3c7')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(large.suggestion!, '#fef3c7')).toBeLessThan(4.5);
  });

  it('offers none when no shade reads on every ground', () => {
    const navy: TextGround = { tones: ['#0f172a'], on: 'shape' };
    expect(
      judgeText([probe(PAPER, '#808080'), probe(navy, '#808080')], null)!.suggestion,
    ).toBeNull();
  });

  it('counts a probe standing for several texts as that many', () => {
    const j = judgeText([probe(PAPER, '#fde047', { count: 5 }), probe(CREAM, '#0f172a')], null)!;
    expect(j).toMatchObject({ failing: 5, of: 6, passes: false });
    expect(judgeText([probe(PAPER, '#0f172a', { count: 3 })], null)).toMatchObject({
      passes: true,
      failing: 0,
      of: 3,
    });
  });
});
