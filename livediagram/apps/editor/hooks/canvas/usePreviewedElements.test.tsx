// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livediagram/document';
import { resetDragPreviewForTests, setLocalPreview } from '@/lib/drag-preview';
import { usePreviewedElements } from './usePreviewedElements';

// docs/specs/008-canvas/drag-preview.md: what depends on where the selection is (its bounds, the
// union resize handles, the quick-connect pluses) follows the preview while a gesture lasts.

const a = createShape('square', 0, 0);
const b = createShape('square', 400, 0);
const doc: Element[] = [a, b];

afterEach(() => resetDragPreviewForTests());

describe('usePreviewedElements', () => {
  it('is the document itself with no preview', () => {
    const { result } = renderHook(() => usePreviewedElements(doc, 't'));
    expect(result.current).toBe(doc);
  });

  it('lays the preview over the document while it lasts', () => {
    const { result } = renderHook(() => usePreviewedElements(doc, 't'));
    const movedA = { ...a, x: 90 };
    act(() => setLocalPreview('t', [movedA, b], doc));
    expect(result.current).toEqual([movedA, b]);
    act(() => resetDragPreviewForTests());
    expect(result.current).toBe(doc);
  });
});
