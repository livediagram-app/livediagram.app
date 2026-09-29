// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { THEMES, type ShapeElement } from '@livediagram/document';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { styleMemoryKey } from '@/lib/style-memory';
import { STYLE_MEMORY_WRITE_DEBOUNCE_MS, useStyleMemory } from './useStyleMemory';

// docs/specs/008-canvas/quick-style-panel.md "Style memory": per document, on this device.

const theme = THEMES.find((t) => t.id === 'forest')!;
const circle = (id: string, extra: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'circle',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...extra,
});

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('useStyleMemory', () => {
  it('dresses the next element from what an edit recorded', () => {
    const { result } = renderHook(() => useStyleMemory({ documentId: 'd1', theme }));
    act(() => result.current.recordEdit([circle('a')], [circle('a', { strokeWidth: 'thick' })]));
    expect(result.current.styleNewElement(circle('b'))).toMatchObject({ strokeWidth: 'thick' });
  });

  it('persists per document, debounced, and reads it back', () => {
    const first = renderHook(() => useStyleMemory({ documentId: 'd1', theme }));
    act(() =>
      first.result.current.recordEdit([circle('a')], [circle('a', { strokeWidth: 'thin' })]),
    );
    expect(localStorage.getItem(styleMemoryKey('d1'))).toBeNull();
    act(() => vi.advanceTimersByTime(STYLE_MEMORY_WRITE_DEBOUNCE_MS));
    expect(JSON.parse(localStorage.getItem(styleMemoryKey('d1'))!)).toEqual({
      'shape:circle': { strokeWidth: 'thin' },
    });
    first.unmount();
    const again = renderHook(() => useStyleMemory({ documentId: 'd1', theme }));
    expect(again.result.current.styleNewElement(circle('b'))).toMatchObject({
      strokeWidth: 'thin',
    });
    const other = renderHook(() => useStyleMemory({ documentId: 'd2', theme }));
    const plain = circle('c');
    expect(other.result.current.styleNewElement(plain)).toBe(plain);
  });

  it('flushes a pending write on unmount', () => {
    const { result, unmount } = renderHook(() => useStyleMemory({ documentId: 'd1', theme }));
    act(() => result.current.recordEdit([circle('a')], [circle('a', { strokeWidth: 'thin' })]));
    unmount();
    expect(localStorage.getItem(styleMemoryKey('d1'))).not.toBeNull();
  });

  it('forgets kinds', () => {
    const { result } = renderHook(() => useStyleMemory({ documentId: 'd1', theme }));
    act(() => result.current.recordEdit([circle('a')], [circle('a', { strokeWidth: 'thin' })]));
    act(() => result.current.forget(['shape:circle']));
    const plain = circle('b');
    expect(result.current.styleNewElement(plain)).toBe(plain);
  });

  it('is inert until the document id is known', () => {
    const { result } = renderHook(() => useStyleMemory({ documentId: null, theme }));
    act(() => result.current.recordEdit([circle('a')], [circle('a', { strokeWidth: 'thin' })]));
    const plain = circle('b');
    expect(result.current.styleNewElement(plain)).toBe(plain);
    act(() => vi.advanceTimersByTime(STYLE_MEMORY_WRITE_DEBOUNCE_MS));
    expect(localStorage.length).toBe(0);
  });
});
