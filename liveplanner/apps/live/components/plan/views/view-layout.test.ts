import { describe, expect, it } from 'vitest';
import {
  CARD_SEARCH_DETAILED_MIN_PX,
  MATRIX_COUNT_MAX_PX,
  MATRIX_COUNT_MIN_PX,
  WORKLOAD_BAR_MAX_PX,
  WORKLOAD_ROW_MAX_PX,
  cardSearchLayout,
  matrixLayout,
  workloadLayout,
} from './view-layout';

// docs/specs/026-plan/plan-views.md "Using the space".
describe('cardSearchLayout', () => {
  it('draws Detailed cards in as many 240 px columns as fit a wide view', () => {
    expect(cardSearchLayout(1280, 800)).toEqual({ size: 'detailed', columns: 5 });
    expect(cardSearchLayout(720, 400)).toEqual({ size: 'detailed', columns: 2 });
    // Exactly one column's width plus the padding.
    expect(cardSearchLayout(CARD_SEARCH_DETAILED_MIN_PX + 24, 400)).toEqual({
      size: 'detailed',
      columns: 1,
    });
  });

  it('falls back to Compact cards in a narrow or short slot', () => {
    expect(cardSearchLayout(240, 400)).toEqual({ size: 'compact', columns: 1 });
    expect(cardSearchLayout(900, 220)).toEqual({ size: 'compact', columns: 4 });
    expect(cardSearchLayout(80, 80).columns).toBe(1);
  });
});

describe('workloadLayout', () => {
  it('spreads a few rows over a tall view with thick bars and larger text, capped', () => {
    const big = workloadLayout(1200, 800, 3);
    expect(big.rowHeight).toBe(WORKLOAD_ROW_MAX_PX);
    expect(big.bar).toBe(WORKLOAD_BAR_MAX_PX);
    expect(big.font).toBe(16);
    expect(big.labelColumn).toBe(260);
    expect(big.scrolls).toBe(false);
  });

  it('keeps thin rows and small text in a small slot', () => {
    const small = workloadLayout(320, 240, 6);
    expect(small.bar).toBeLessThan(20);
    expect(small.font).toBe(12);
    expect(small.labelColumn).toBe(96);
  });

  it('scrolls rather than squeezing rows below the minimum', () => {
    expect(workloadLayout(720, 400, 40).scrolls).toBe(true);
    expect(workloadLayout(720, 400, 40).rowHeight).toBe(24);
  });
});

describe('matrixLayout', () => {
  it('grows the counts with the cells, between its bounds', () => {
    expect(matrixLayout(1400, 900, 5).countFont).toBe(MATRIX_COUNT_MAX_PX);
    expect(matrixLayout(200, 160, 5).countFont).toBe(MATRIX_COUNT_MIN_PX);
    const mid = matrixLayout(720, 400, 5);
    expect(mid.countFont).toBeGreaterThan(MATRIX_COUNT_MIN_PX);
    expect(mid.countFont).toBeLessThan(MATRIX_COUNT_MAX_PX);
  });

  it('widens the gaps and the names column with the view', () => {
    expect(matrixLayout(1200, 800, 5)).toMatchObject({ gap: 6, labelColumn: 180 });
    expect(matrixLayout(300, 200, 5)).toMatchObject({ gap: 4, labelColumn: 72 });
  });
});
