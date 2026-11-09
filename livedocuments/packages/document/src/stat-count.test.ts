import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colors';
import {
  countFrame,
  parseCountable,
  STAT_COUNT_DELAY_MS,
  STAT_COUNT_MS,
  statTrend,
  statTrendColours,
} from './stat-count';

// docs/specs/009-elements/stat-row.md "The change line" and "Count-up when presented".
describe('statTrend', () => {
  it('reads up, down and flat from the first character', () => {
    for (const up of ['▲ 12%', '↑ 3', '+4 pts', ' ▲ 1']) expect(statTrend(up), up).toBe('up');
    for (const down of ['▼ 2%', '↓ 1', '-3 pts', '−5%', '– 2'])
      expect(statTrend(down), down).toBe('down');
    for (const flat of ['= same', '→ steady', 'No change', '12%', '', undefined])
      expect(statTrend(flat), String(flat)).toBe('flat');
  });
});

describe('statTrendColours', () => {
  it('meets 4.5:1 on the card on light and dark paper', () => {
    for (const [surface, ground] of [
      ['light', '#ffffff'],
      ['dark', '#141b26'],
    ] as const) {
      for (const trend of ['up', 'down'] as const) {
        const { ink, wash } = statTrendColours(trend, surface, ground, '#334155');
        expect(contrastRatio(ink, ground), `${trend} ${surface}`).toBeGreaterThanOrEqual(4.5);
        expect(wash).toMatch(/^#|rgba?\(|color-mix/);
      }
    }
  });

  it('gives a flat change the caption ink, lifted to read', () => {
    expect(statTrendColours('flat', 'light', '#ffffff', '#334155').ink).toBe('#334155');
  });

  it('walks green on a green card until it reads', () => {
    const { ink } = statTrendColours('up', 'light', '#bbf7d0', '#334155');
    expect(contrastRatio(ink, '#bbf7d0')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('parseCountable and countFrame', () => {
  it('splits a value into prefix, number and suffix', () => {
    expect(parseCountable('$1,250.5m')).toEqual({
      prefix: '$',
      negative: false,
      number: 1250.5,
      decimals: 1,
      grouped: true,
      suffix: 'm',
    });
    expect(parseCountable('86k')).toMatchObject({ prefix: '', number: 86, suffix: 'k' });
    expect(parseCountable('-12%')).toMatchObject({ negative: true, number: 12, suffix: '%' });
    expect(parseCountable('  4.8 ')).toMatchObject({ number: 4.8, decimals: 1 });
  });

  it('refuses values that are not one number', () => {
    for (const v of ['24/7', 'Q3 2026', 'N/A', '', '1-2', 'v2.1.0'])
      expect(parseCountable(v), v).toBeNull();
  });

  it('counts from zero to the value as typed, keeping decimals and grouping', () => {
    const c = parseCountable('$1,250.5m')!;
    expect(countFrame(c, 0)).toBe('$0.0m');
    expect(countFrame(c, 1)).toBe('$1,250.5m');
    expect(countFrame(c, 2)).toBe('$1,250.5m');
    const mid = countFrame(c, 0.5);
    expect(mid).toMatch(/^\$1,\d{3}\.\dm$/);
    // Ease out: past halfway by the middle of the count.
    expect(Number(mid.replace(/[$,m]/g, ''))).toBeGreaterThan(625);
    expect(countFrame(parseCountable('-12%')!, 1)).toBe('-12%');
    expect(countFrame(parseCountable('-12%')!, 0)).toBe('0%');
  });

  it('is cheap enough to print every frame', () => {
    const c = parseCountable('1,234,567.89')!;
    const t = performance.now();
    for (let i = 0; i < 10_000; i += 1) countFrame(c, i / 10_000);
    expect(performance.now() - t).toBeLessThan(200);
    expect(STAT_COUNT_MS).toBe(1200);
    expect(STAT_COUNT_DELAY_MS).toBeLessThan(STAT_COUNT_MS);
  });

  it('parses a long hostile value in linear time', () => {
    const t = performance.now();
    expect(parseCountable('9'.repeat(5000) + 'x' + '9'.repeat(5000))).toBeNull();
    expect(performance.now() - t).toBeLessThan(100);
  });
});
