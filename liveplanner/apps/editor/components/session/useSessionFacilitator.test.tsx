// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FACILITATOR_GRACE_MS,
  newSessionTab,
  type SessionFacilitator,
  type SessionTabState,
} from '@liveplanner/project';
import type { Participant } from '@/lib/identity';
import { useSessionFacilitator } from './useSessionFacilitator';

// docs/specs/026-plan/session-tabs.md "Facilitator", "Share roles": an Editor opening a session nobody runs takes the
// baton; one already there when it comes free sees Facilitate; Take Over shows only once the facilitator has been away
// for the grace; the facilitator hands it over or steps down. A Participant or Viewer never holds it.
const SAM: SessionFacilitator = { id: 'k-sam', name: 'Sam', color: '#0ea5e9' };
const ALI: SessionFacilitator = { id: 'k-ali', name: 'Ali', color: '#dc2626' };
const peer = (who: SessionFacilitator, extra: Partial<Participant> = {}): Participant => ({
  id: `socket-${who.id}`,
  key: who.id,
  name: who.name,
  color: who.color,
  status: 'active',
  ...extra,
});

function setup(opts: {
  self?: SessionFacilitator;
  mayHold: boolean;
  holder?: SessionFacilitator;
  presence?: Participant[];
}) {
  let state: SessionTabState = {
    ...newSessionTab('refinement', { typeIds: [], statuses: [] }),
    ...(opts.holder ? { facilitator: opts.holder } : {}),
  };
  const run = vi.fn((_t: string, change: (s: SessionTabState) => SessionTabState) => {
    state = change(state);
  });
  const hook = renderHook(
    ({ s, presence }) =>
      useSessionFacilitator({
        tabId: 't1',
        session: s,
        self: opts.self ?? SAM,
        mayHold: opts.mayHold,
        presence,
        run,
      }),
    { initialProps: { s: state, presence: opts.presence ?? [] } },
  );
  return {
    hook,
    run,
    state: () => state,
    sync: (presence = opts.presence ?? []) => hook.rerender({ s: state, presence }),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useSessionFacilitator', () => {
  it('an Editor opening a session nobody runs takes the baton, once', () => {
    const f = setup({ mayHold: true });
    expect(f.state().facilitator).toEqual(SAM);
    f.sync();
    expect(f.hook.result.current.mine).toBe(true);
    expect(f.run).toHaveBeenCalledTimes(1);
  });

  it('an Editor never takes a baton someone else took a moment before', () => {
    const run = vi.fn();
    renderHook(() =>
      useSessionFacilitator({
        tabId: 't1',
        session: newSessionTab('refinement', { typeIds: [], statuses: [] }),
        self: SAM,
        mayHold: true,
        presence: [],
        run,
      }),
    );
    // By the time the change lands, Ali holds it: the change keeps Ali.
    const taken = {
      ...newSessionTab('refinement', { typeIds: [], statuses: [] }),
      facilitator: ALI,
    };
    expect(run.mock.calls[0]![1](taken)).toBe(taken);
  });

  it('a Participant or Viewer never takes it, nor sees a verb', () => {
    const f = setup({ mayHold: false });
    expect(f.run).not.toHaveBeenCalled();
    expect(f.hook.result.current.canFacilitate).toBe(false);
    act(() => f.hook.result.current.take());
    expect(f.run).not.toHaveBeenCalled();
    const held = setup({ mayHold: false, holder: ALI });
    act(() => vi.advanceTimersByTime(FACILITATOR_GRACE_MS));
    expect(held.hook.result.current.canTakeOver).toBe(false);
  });

  it('the facilitator hands it to an Editor in the room, or steps down; an Editor then sees Facilitate', () => {
    const f = setup({
      mayHold: true,
      holder: SAM,
      presence: [
        peer(ALI),
        peer(ALI, { id: 'other-socket' }),
        peer({ id: 'k-v', name: 'Vi', color: '#000' }, { role: 'view' }),
        peer({ id: 'k-bot', name: 'Bot', color: '#000' }, { agent: true }),
        peer(SAM),
      ],
    });
    expect(f.hook.result.current.editors).toEqual([ALI]);
    act(() => f.hook.result.current.handOver(ALI));
    expect(f.state().facilitator).toEqual(ALI);
    f.sync();
    expect(f.hook.result.current.mine).toBe(false);
    expect(f.hook.result.current.editors).toEqual([]);
    // No longer the facilitator: neither hand over nor step down does anything.
    act(() => {
      f.hook.result.current.handOver(SAM);
      f.hook.result.current.stepDown();
    });
    expect(f.state().facilitator).toEqual(ALI);
    const g = setup({ mayHold: true, holder: SAM });
    act(() => g.hook.result.current.stepDown());
    g.sync();
    expect(g.state().facilitator).toBeUndefined();
    expect(g.hook.result.current.canFacilitate).toBe(true);
    act(() => g.hook.result.current.take());
    expect(g.state().facilitator).toEqual(SAM);
  });

  it('Take Over shows only once the facilitator has been away for the grace, and goes when they return', () => {
    const f = setup({ mayHold: true, holder: ALI, presence: [peer(ALI)] });
    act(() => vi.advanceTimersByTime(FACILITATOR_GRACE_MS * 2));
    expect(f.hook.result.current.canTakeOver).toBe(false);
    f.sync([]);
    act(() => vi.advanceTimersByTime(FACILITATOR_GRACE_MS - 1));
    expect(f.hook.result.current.canTakeOver).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(f.hook.result.current.canTakeOver).toBe(true);
    f.sync([peer(ALI)]);
    expect(f.hook.result.current.canTakeOver).toBe(false);
    // Gone again: the grace starts over.
    f.sync([]);
    expect(f.hook.result.current.canTakeOver).toBe(false);
    act(() => vi.advanceTimersByTime(FACILITATOR_GRACE_MS));
    act(() => f.hook.result.current.take());
    expect(f.state().facilitator).toEqual(SAM);
  });
});
