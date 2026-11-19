// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRenameCurrentRequest } from './useRenameCurrentRequest';

type Props = { nonce: number; explorerOpen: boolean; available: boolean };

function setup(initial: Partial<Props> = {}) {
  const openExplorer = vi.fn();
  const view = renderHook((p: Props) => useRenameCurrentRequest({ ...p, openExplorer }), {
    initialProps: { nonce: 0, explorerOpen: false, available: true, ...initial },
  });
  return { ...view, openExplorer };
}

describe('useRenameCurrentRequest', () => {
  afterEach(cleanup);

  it('asks nothing until the nonce moves, including one already above 0 on mount', () => {
    const { result, openExplorer } = setup({ nonce: 3 });
    expect(result.current.request).toBe(0);
    expect(openExplorer).not.toHaveBeenCalled();
  });

  it('opens the closed panel once and holds the request until the card takes it', () => {
    const { result, rerender, openExplorer } = setup();
    rerender({ nonce: 1, explorerOpen: false, available: true });
    expect(result.current.request).toBe(1);
    expect(openExplorer).toHaveBeenCalledTimes(1);
    rerender({ nonce: 1, explorerOpen: true, available: true });
    expect(openExplorer).toHaveBeenCalledTimes(1);
    expect(result.current.request).toBe(1);
    act(() => result.current.onHandled());
    expect(result.current.request).toBe(0);
  });

  it('leaves an open panel open', () => {
    const { result, rerender, openExplorer } = setup({ explorerOpen: true });
    rerender({ nonce: 1, explorerOpen: true, available: true });
    expect(result.current.request).toBe(1);
    expect(openExplorer).not.toHaveBeenCalled();
  });

  it('drops the request when the panel closes before the card took it', () => {
    const { result, rerender } = setup();
    rerender({ nonce: 1, explorerOpen: false, available: true });
    rerender({ nonce: 1, explorerOpen: true, available: true });
    rerender({ nonce: 1, explorerOpen: false, available: true });
    expect(result.current.request).toBe(0);
    // A later opening starts no rename.
    rerender({ nonce: 1, explorerOpen: true, available: true });
    expect(result.current.request).toBe(0);
  });

  it('asks nothing where the panel cannot show', () => {
    const { result, rerender, openExplorer } = setup({ available: false });
    rerender({ nonce: 1, explorerOpen: false, available: false });
    expect(result.current.request).toBe(0);
    expect(openExplorer).not.toHaveBeenCalled();
  });

  it('takes each new request, a second one after the first was handled', () => {
    const { result, rerender, openExplorer } = setup({ explorerOpen: true });
    rerender({ nonce: 1, explorerOpen: true, available: true });
    act(() => result.current.onHandled());
    rerender({ nonce: 2, explorerOpen: true, available: true });
    expect(result.current.request).toBe(2);
    expect(openExplorer).not.toHaveBeenCalled();
  });
});
