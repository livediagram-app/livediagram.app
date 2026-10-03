// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createPinnedArrow, createShape, type Element } from '@livediagram/document';
import { useArrowLabelLayouts } from './useArrowLabelLayouts';

// docs/specs/008-canvas/canvas-performance.md: the label pass runs once per element change, and the
// draft layout every arrow view receives keeps its identity across passes, so a move does not
// re-render every arrow through it.

const a = createShape('square', 0, 0);
const b = createShape('square', 400, 0);
const BOARD: Element[] = [a, b, { ...createPinnedArrow(a.id, 'e', b.id, 'w'), label: 'Go' }];

describe('useArrowLabelLayouts', () => {
  it('keeps the draft layout across element changes', () => {
    const { result, rerender } = renderHook(
      ({ els }) => useArrowLabelLayouts(els, true, undefined, true),
      {
        initialProps: { els: BOARD },
      },
    );
    const draft = result.current.draftLayout;
    rerender({ els: BOARD.map((el) => (el.id === b.id ? { ...el, x: 480 } : el)) });
    expect(result.current.draftLayout).toBe(draft);
  });
});
