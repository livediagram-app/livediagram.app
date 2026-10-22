// @vitest-environment jsdom
// docs/specs/007-editor/live-app.md "A phone held sideways": the Explorer is withheld there, and an open one closes.
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWithheldExplorerCloses } from './useWithheldExplorerCloses';

describe('useWithheldExplorerCloses', () => {
  it('closes an open Explorer once it is withheld', () => {
    const close = vi.fn();
    const { rerender } = renderHook(
      ({ withheld }: { withheld: boolean }) => useWithheldExplorerCloses(withheld, true, close),
      { initialProps: { withheld: false } },
    );
    expect(close).not.toHaveBeenCalled();
    rerender({ withheld: true });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes one opened while withheld', () => {
    const close = vi.fn();
    const { rerender } = renderHook(
      ({ open }: { open: boolean }) => useWithheldExplorerCloses(true, open, close),
      { initialProps: { open: false } },
    );
    expect(close).not.toHaveBeenCalled();
    rerender({ open: true });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('leaves a shown Explorer alone', () => {
    const close = vi.fn();
    renderHook(() => useWithheldExplorerCloses(false, true, close));
    expect(close).not.toHaveBeenCalled();
  });
});
