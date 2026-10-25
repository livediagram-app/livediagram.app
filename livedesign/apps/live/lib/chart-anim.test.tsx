// @vitest-environment jsdom

// A chart's animation on screen, and the Chart element tour's Grow previewed over it, never stored
// (docs/specs/007-editor/element-tours.md "The Chart tour").

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ShapeElement } from '@livedesign/design';
import { useChartAnim } from './chart';
import { setConceptTourPreview } from '@liveworkspace/workbench/lib/concept-tour-preview';

const chart = { id: 'c1', type: 'shape', shape: 'pie-chart', pieAnim: 'spin' } as ShapeElement;

afterEach(() => setConceptTourPreview(null));

describe('useChartAnim', () => {
  it("draws the chart's own animation, and Grow over and over while the tour previews it", () => {
    const { result } = renderHook(() => useChartAnim(chart, '0px 0px'));
    expect(result.current.className).toContain('spin');
    act(() => setConceptTourPreview({ elementId: 'c1', anim: 'grow', run: 1 }));
    expect(result.current.className).toContain('grow');
    expect(result.current.style).toMatchObject({ '--lvd-pie-iter': 'infinite' });
    act(() => setConceptTourPreview(null));
    expect(result.current.className).toContain('spin');
  });

  it('leaves another chart alone', () => {
    const { result } = renderHook(() => useChartAnim(chart, '0px 0px'));
    act(() => setConceptTourPreview({ elementId: 'other', anim: 'grow', run: 1 }));
    expect(result.current.className).toContain('spin');
  });
});
