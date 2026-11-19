// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  endMoveCurrent,
  useMoveCurrentRequest,
} from '@liveworkspace/explorer/move-current-request';
import { useVisibilityActions } from './useVisibilityActions';

type Input = Parameters<typeof useVisibilityActions>[0];

function setup(over: Partial<Input> = {}) {
  const sync = vi.fn();
  const openShare = vi.fn();
  const openCommunity = vi.fn();
  const input: Input = {
    manage: true,
    offline: false,
    team: false,
    community: false,
    sync,
    openShare,
    openCommunity,
    ...over,
  };
  const view = renderHook((p: Input) => useVisibilityActions(p), { initialProps: input });
  return { ...view, input, sync, openShare, openCommunity };
}

describe('useVisibilityActions', () => {
  afterEach(() => {
    act(() => endMoveCurrent());
    cleanup();
  });

  it('offers nothing to someone who may not manage the item', () => {
    expect(setup({ manage: false }).result.current).toBeUndefined();
  });

  it('offers an offline item Sync alone, and nothing without an account to sync to', () => {
    const { result, sync } = setup({ offline: true });
    expect(Object.keys(result.current ?? {})).toEqual(['private']);
    result.current?.private?.();
    expect(sync).toHaveBeenCalledTimes(1);
    expect(setup({ offline: true, sync: undefined }).result.current).toBeUndefined();
  });

  it('opens Share from a link, the Community tab from the Community, and Change Folder from a team', () => {
    const shared = setup();
    shared.result.current?.private?.();
    expect(shared.openShare).toHaveBeenCalledTimes(1);
    const listed = setup({ community: true });
    listed.result.current?.private?.();
    expect(listed.openCommunity).toHaveBeenCalledTimes(1);
    const team = setup({ team: true });
    const ask = renderHook(() => useMoveCurrentRequest());
    act(() => team.result.current?.private?.());
    expect(ask.result.current).toBeGreaterThan(0);
  });

  it('asks the Explorer panel for Change Folder on Team, and opens the Community tab on Everyone', () => {
    const { result, openCommunity } = setup();
    const ask = renderHook(() => useMoveCurrentRequest());
    act(() => result.current?.team?.());
    expect(ask.result.current).toBeGreaterThan(0);
    result.current?.community?.();
    expect(openCommunity).toHaveBeenCalledTimes(1);
  });

  it("leaves Everyone out for a team's item and where the app has no Community tab", () => {
    expect(setup({ team: true }).result.current?.community).toBeUndefined();
    expect(setup({ openCommunity: undefined }).result.current?.community).toBeUndefined();
    const plain = setup({ openCommunity: undefined, community: true });
    plain.result.current?.private?.();
    expect(plain.openShare).toHaveBeenCalledTimes(1);
  });

  it('keeps one object across renders with new handlers, calling the newest', () => {
    const { result, rerender, input } = setup();
    const first = result.current;
    const openShare = vi.fn();
    rerender({ ...input, openShare });
    expect(result.current).toBe(first);
    result.current?.private?.();
    expect(openShare).toHaveBeenCalledTimes(1);
  });
});
