// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markShareAfterSync } from '@/lib/offline/share-after-sync';
import { useShareAfterSync } from './useShareAfterSync';

// docs/specs/006-document/offline-mode.md "Sharing a guest's Local only document".
describe('useShareAfterSync', () => {
  afterEach(() => sessionStorage.clear());

  it('opens Share once the synced document has loaded', () => {
    markShareAfterSync('doc-1');
    const open = vi.fn();
    const hook = renderHook(({ id }: { id: string | null }) => useShareAfterSync(id, false, open), {
      initialProps: { id: null as string | null },
    });
    expect(open).not.toHaveBeenCalled();
    hook.rerender({ id: 'doc-1' });
    expect(open).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('stays shut for a document still stored offline', () => {
    markShareAfterSync('doc-1');
    const open = vi.fn();
    renderHook(() => useShareAfterSync('doc-1', true, open));
    expect(open).not.toHaveBeenCalled();
  });

  it('stays shut when nothing asked', () => {
    const open = vi.fn();
    renderHook(() => useShareAfterSync('doc-1', false, open));
    expect(open).not.toHaveBeenCalled();
  });
});
