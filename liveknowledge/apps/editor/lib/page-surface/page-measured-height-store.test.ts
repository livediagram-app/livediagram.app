// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { LaidOutPage } from '@liveknowledge/document';
import {
  MEASURED_PAGES_KEPT,
  drawnPageHeight,
  measuredPageHeightsOf,
  noteMeasuredPageHeight,
  resetMeasuredPageHeights,
  useMeasuredPageHeights,
  withDrawnHeight,
} from './page-measured-height-store';

// docs/specs/030-knowledgebase/blueprints/continuous-page.md "The drawn height".
const page = (over: Partial<LaidOutPage> = {}): LaidOutPage =>
  ({
    id: 'page-1',
    orientation: 'portrait',
    kind: 'article',
    flow: 'art-1',
    size: 'fit',
    fit: { width: 856, height: 240 },
    rect: { x: 0, y: 0, width: 856, height: 240 },
    ...over,
  }) as LaidOutPage;

beforeEach(() => resetMeasuredPageHeights());

describe('noteMeasuredPageHeight', () => {
  it('keeps a measure per tab and flow, telling readers only when it moves', () => {
    const { result } = renderHook(() => useMeasuredPageHeights('t'));
    const before = result.current;
    act(() => noteMeasuredPageHeight('t', 'art-1', 856, 2600));
    const after = result.current;
    expect(after).not.toBe(before);
    expect(after.get('art-1')).toEqual({ width: 856, height: 2600 });
    act(() => noteMeasuredPageHeight('t', 'art-1', 856, 2600));
    expect(result.current).toBe(after);
    expect(measuredPageHeightsOf('other').size).toBe(0);
  });

  it('keeps the last tabs only, the oldest dropped first', () => {
    for (let i = 0; i <= MEASURED_PAGES_KEPT; i++) noteMeasuredPageHeight(`t${i}`, 'f', 856, 300);
    expect(measuredPageHeightsOf('t0').size).toBe(0);
    expect(measuredPageHeightsOf(`t${MEASURED_PAGES_KEPT}`).size).toBe(1);
  });
});

describe('drawnPageHeight', () => {
  const measured = new Map([['art-1', { width: 856, height: 2600 }]]);

  it('is the measure when it is taller than the stored page', () => {
    expect(drawnPageHeight(page(), measured)).toBe(2600);
  });

  it('never draws shorter than stored', () => {
    expect(
      drawnPageHeight(page({ rect: { x: 0, y: 0, width: 856, height: 3000 } }), measured),
    ).toBe(3000);
  });

  it('is the stored height with no measure, at another width, or off a continuous page', () => {
    expect(drawnPageHeight(page(), undefined)).toBe(240);
    expect(drawnPageHeight(page({ flow: 'other' }), measured)).toBe(240);
    expect(drawnPageHeight(page({ rect: { x: 0, y: 0, width: 400, height: 240 } }), measured)).toBe(
      240,
    );
    expect(drawnPageHeight(page({ size: 'a4' }), measured)).toBe(240);
  });

  it('withDrawnHeight answers the same page when nothing changes', () => {
    const p = page();
    expect(withDrawnHeight(p, undefined)).toBe(p);
    const drawn = withDrawnHeight(p, measured);
    expect(drawn.rect).toEqual({ x: 0, y: 0, width: 856, height: 2600 });
    expect(p.rect.height).toBe(240);
  });
});
