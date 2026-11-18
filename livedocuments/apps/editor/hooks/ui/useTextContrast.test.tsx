// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createText, layOutPages, type Element } from '@livedocuments/document';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { useTextContrast } from './useTextContrast';

// docs/specs/004-interface-design/colour-picker.md "Reading on its ground".
const PAGE = { id: 'p', orientation: 'portrait' } as const;
const rect = layOutPages([PAGE])[0]!.rect;
const t = {
  ...createText(rect.x + 40, rect.y + 40),
  id: 't',
  width: 120,
  height: 30,
  textColor: '#fde047',
} as Element;
const activeTab = { elements: [t], pages: [PAGE] };
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
    expect(result.current?.[0]?.ground.on).toBe('page');
  });

  it('is undefined where nothing can be judged', () => {
    const away = { ...t, x: rect.x - 9000 } as Element;
    const { result } = renderHook(() => useTextContrast([away], true), { wrapper });
    expect(result.current).toBeUndefined();
  });

  it('is undefined outside the editor', () => {
    const { result } = renderHook(() => useTextContrast([t], true));
    expect(result.current).toBeUndefined();
  });

  it('judges every element whose ground can be judged, leaving the rest out', () => {
    const away = { ...t, id: 'away', x: rect.x - 9000 } as Element;
    const two = { ...t, id: 't2' };
    const { result } = renderHook(() => useTextContrast([t, away, two], true), { wrapper });
    expect(result.current).toHaveLength(2);
  });
});
