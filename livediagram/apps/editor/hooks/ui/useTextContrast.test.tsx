// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createArrow, createText, type Element } from '@livediagram/document';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { useTextContrast } from './useTextContrast';

// docs/specs/004-interface-design/colour-picker.md "Reading on its ground".
const t = {
  ...createText(40, 40),
  id: 't',
  width: 120,
  height: 30,
  textColor: '#fde047',
} as Element;
const arrow = { ...createArrow(0, 0, 10, 10), id: 'a' } as Element;
const activeTab = { elements: [t, arrow] };
const wrapper = ({ children }: { children: ReactNode }) => (
  <EditorContext.Provider value={{ activeTab } as never}>{children}</EditorContext.Provider>
);

describe('useTextContrast', () => {
  it('works out the probe only while the picker is open', () => {
    const { result, rerender } = renderHook(({ open }) => useTextContrast([t], open), {
      wrapper,
      initialProps: { open: false },
    });
    expect(result.current).toBeUndefined();
    rerender({ open: true });
    expect(result.current?.[0]?.current).toBe('#fde047');
    expect(result.current?.[0]?.ground.on).toBe('canvas');
  });

  it('is undefined where nothing can be judged, or outside the editor', () => {
    expect(
      renderHook(() => useTextContrast([arrow], true), { wrapper }).result.current,
    ).toBeUndefined();
    expect(renderHook(() => useTextContrast([t], true)).result.current).toBeUndefined();
  });

  it('judges every element whose ground can be judged, leaving the rest out', () => {
    const two = { ...t, id: 't2' };
    const { result } = renderHook(() => useTextContrast([t, arrow, two], true), { wrapper });
    expect(result.current).toHaveLength(2);
  });
});
