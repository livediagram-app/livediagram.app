// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { pageBrush } from '@/lib/format-page-brush';
import { useDeadPageBrush } from './useDeadPageBrush';

// docs/specs/007-editor/pages-mode.md "Copying a background": a brush whose page has gone holds nothing.
describe('useDeadPageBrush', () => {
  it('empties a page brush once its page goes, so the next press works at once', () => {
    const set = vi.fn();
    const { rerender } = renderHook(
      ({ pages }: { pages: string[] }) => useDeadPageBrush(pageBrush('p2'), pages, set),
      { initialProps: { pages: ['p1', 'p2'] } },
    );
    expect(set).not.toHaveBeenCalled();
    rerender({ pages: ['p1'] });
    expect(set).toHaveBeenCalledWith(null);
  });

  it("leaves an element's brush, and no brush, alone", () => {
    const set = vi.fn();
    renderHook(() => useDeadPageBrush('el-1', ['p1'], set));
    renderHook(() => useDeadPageBrush(null, ['p1'], set));
    expect(set).not.toHaveBeenCalled();
  });
});
