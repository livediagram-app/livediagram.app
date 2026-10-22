// @vitest-environment jsdom

// A hover preview in flight is reverted when its tiles unmount (docs/specs/010-palette/style-presets.md),
// through the newest revert callback rather than the one from the first render.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRevertOnUnmount } from './hover-preview';

describe('useRevertOnUnmount', () => {
  it('reverts once, with the newest callback, on unmount', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender, unmount } = renderHook(({ cb }) => useRevertOnUnmount(cb), {
      initialProps: { cb: first },
    });
    rerender({ cb: latest });
    expect(latest).not.toHaveBeenCalled();
    unmount();
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });
});
