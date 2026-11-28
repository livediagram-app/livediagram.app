// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  setBoardConfiguring,
  useBoardConfiguring,
  useConfigurableBoard,
  useRegisterConfigurableBoard,
} from './board-configure-store';

// docs/specs/026-plan/plan-board.md "Configure": the tab's board registers itself while an Editor has it on screen, and
// the cluster's Configure Board button (the one way in) opens and closes Configure over it.
afterEach(() => act(() => setBoardConfiguring(false)));

describe('the board Configure store', () => {
  it('holds the registered board while it is on, and clears it after', () => {
    const board = renderHook(() => useConfigurableBoard());
    expect(board.result.current).toBeNull();
    const reg = renderHook(({ on }) => useRegisterConfigurableBoard('b1', on), {
      initialProps: { on: true },
    });
    expect(board.result.current).toBe('b1');
    reg.rerender({ on: false });
    expect(board.result.current).toBeNull();
  });

  it('leaves a newer board registered when an older one unmounts', () => {
    const board = renderHook(() => useConfigurableBoard());
    const first = renderHook(() => useRegisterConfigurableBoard('b1', true));
    renderHook(() => useRegisterConfigurableBoard('b2', true));
    first.unmount();
    expect(board.result.current).toBe('b2');
  });

  it('opens and closes Configure, telling only on a change', () => {
    let renders = 0;
    const open = renderHook(() => {
      renders++;
      return useBoardConfiguring();
    });
    expect(open.result.current).toBe(false);
    act(() => setBoardConfiguring(true));
    expect(open.result.current).toBe(true);
    const seen = renders;
    act(() => setBoardConfiguring(true));
    expect(renders).toBe(seen);
    act(() => setBoardConfiguring(false));
    expect(open.result.current).toBe(false);
  });
});
