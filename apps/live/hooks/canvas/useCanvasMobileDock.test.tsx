// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useOpenDockPanelOnChange, type MobilePanel } from './useCanvasMobileDock';

describe('useOpenDockPanelOnChange', () => {
  it('opens the panel once per new key, and not while the key is absent', () => {
    const open = vi.fn();
    const { rerender } = renderHook(
      ({ key }: { key: string | null }) => useOpenDockPanelOnChange(key, 'poll', open),
      { initialProps: { key: null as string | null } },
    );
    expect(open).not.toHaveBeenCalled();

    rerender({ key: 'poll-1' });
    expect(open).toHaveBeenCalledWith('poll');
    expect(open).toHaveBeenCalledTimes(1);

    // Re-renders with the same poll must not reopen a panel the user closed.
    rerender({ key: 'poll-1' });
    expect(open).toHaveBeenCalledTimes(1);

    rerender({ key: 'poll-2' });
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('calls the latest opener, not the one from the first render', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ key, open }: { key: string | null; open: (id: MobilePanel) => void }) =>
        useOpenDockPanelOnChange(key, 'vote', open),
      { initialProps: { key: null as string | null, open: first } },
    );
    rerender({ key: 'vote', open: second });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('vote');
  });
});
