// @vitest-environment jsdom
// /new's commit identity (docs/specs/007-editor/new-document-route.md): the settled self, waited for while it is
// the 'pending' placeholder, else the guest's id once the wait runs out.
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useResolveSelf } from './useResolveSelf';

type Self = { id: string; name: string };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useResolveSelf', () => {
  it('answers a settled self at once', async () => {
    const setSelf = vi.fn();
    const guest = vi.fn();
    const { result } = renderHook(() =>
      useResolveSelf<Self>({ id: 'u1', name: 'Ada' }, setSelf, guest),
    );
    await expect(result.current.resolveSelf()).resolves.toEqual({ id: 'u1', name: 'Ada' });
    expect(guest).not.toHaveBeenCalled();
    expect(setSelf).not.toHaveBeenCalled();
  });

  it('waits for the bootstrap to settle the pending placeholder', async () => {
    const { result, rerender } = renderHook(
      ({ self }: { self: Self }) => useResolveSelf(self, vi.fn(), vi.fn()),
      { initialProps: { self: { id: 'pending', name: 'Guest' } } },
    );
    const resolving = result.current.resolveSelf();
    await vi.advanceTimersByTimeAsync(300);
    rerender({ self: { id: 'g1', name: 'Guest' } });
    await vi.advanceTimersByTimeAsync(100);
    await expect(resolving).resolves.toEqual({ id: 'g1', name: 'Guest' });
    expect(result.current.selfRef.current).toEqual({ id: 'g1', name: 'Guest' });
  });

  it("falls back to the guest's id once the wait runs out", async () => {
    const setSelf = vi.fn();
    const { result } = renderHook(() =>
      useResolveSelf<Self>({ id: 'pending', name: 'Guest' }, setSelf, async () => ({ id: 'g2' })),
    );
    const resolving = result.current.resolveSelf();
    await vi.advanceTimersByTimeAsync(8100);
    await expect(resolving).resolves.toEqual({ id: 'g2', name: 'Guest' });
    expect(setSelf).toHaveBeenCalledWith({ id: 'g2', name: 'Guest' });
  });
});
