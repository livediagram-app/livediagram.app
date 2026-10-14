// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFacilitator } from './useFacilitator';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

type Deps = Parameters<typeof useFacilitator>[0];

afterEach(() => window.sessionStorage.clear());

function setup() {
  const deps: Deps = {
    documentId: 'd1',
    send: vi.fn(),
    onNotice: vi.fn(),
    nameOf: (id) => `name-${id}`,
  };
  return { deps, hook: renderHook((d: Deps) => useFacilitator(d), { initialProps: deps }) };
}

// The facilitator baton (docs/specs/012-collaboration/session-tools.md).
describe('useFacilitator', () => {
  it('takes the baton when the frame carries our token, and keeps the token', () => {
    const { hook } = setup();
    act(() =>
      hook.result.current.receiveFacilitator({ holder: 'p1', reason: 'claim', token: 'tk' }),
    );
    expect(hook.result.current.facilitatorId).toBe('p1');
    expect(hook.result.current.isFacilitator).toBe(true);
    expect(hook.result.current.readFacilitatorToken()).toBe('tk');
  });

  it('announces with the newest names', () => {
    const { hook, deps } = setup();
    const onNotice = vi.fn();
    hook.rerender({ ...deps, onNotice, nameOf: (id) => `renamed-${id}` });
    act(() => hook.result.current.receiveFacilitator({ holder: 'p2', reason: 'claim' }));
    expect(onNotice).toHaveBeenCalledWith('renamed-p2 is now facilitating');
  });

  it('starts a different document as a fresh session', () => {
    const { hook, deps } = setup();
    act(() =>
      hook.result.current.receiveFacilitator({ holder: 'p1', reason: 'state', token: 'tk' }),
    );
    hook.rerender({ ...deps, documentId: 'd2' });
    expect(hook.result.current.facilitatorId).toBeNull();
    expect(hook.result.current.isFacilitator).toBe(false);
    expect(hook.result.current.readFacilitatorToken()).toBeNull();
  });

  it('sends asks through the newest send', () => {
    const { hook, deps } = setup();
    const send = vi.fn();
    hook.rerender({ ...deps, send });
    act(() => hook.result.current.claimFacilitator());
    expect(send).toHaveBeenCalledWith({ kind: 'facilitator', action: 'claim' });
  });

  // docs/specs/012-collaboration/facilitator.md "Telling the room": an absent holder timing out is named, though
  // they have left the roster by then.
  it('names a holder who left, from the name it last had', () => {
    const { hook, deps } = setup();
    const onNotice = vi.fn();
    act(() => hook.result.current.receiveFacilitator({ holder: 'p2', reason: 'claim' }));
    hook.rerender({ ...deps, onNotice, nameOf: () => null });
    act(() => hook.result.current.receiveFacilitator({ holder: null, by: 'p2', reason: 'left' }));
    expect(onNotice).toHaveBeenCalledWith('name-p2 left, so nobody is facilitating');
  });

  it('says Somebody for a holder it never knew', () => {
    const { hook, deps } = setup();
    const onNotice = vi.fn();
    hook.rerender({ ...deps, onNotice, nameOf: () => null });
    act(() => hook.result.current.receiveFacilitator({ holder: null, by: 'p9', reason: 'left' }));
    expect(onNotice).toHaveBeenCalledWith('Somebody left, so nobody is facilitating');
  });
});
