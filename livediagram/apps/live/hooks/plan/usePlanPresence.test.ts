// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RoomOp } from '@livediagram/api-schema';
import { usePlanPresence } from './usePlanPresence';

// docs/specs/026-plan/plan-mode.md "Collaboration": a late joiner sees cards already held. A holder says it
// again when someone new joins, and when its own connection rejoins; a person holding nothing stays silent.
type Peer = { id: string; name: string; color: string };
const ana: Peer = { id: 'p-ana', name: 'Ana', color: '#2563eb' };
const ben: Peer = { id: 'p-ben', name: 'Ben', color: '#dc2626' };

function setup(peers: Peer[]) {
  const sent: RoomOp[] = [];
  const hook = renderHook(
    ({ peers: p }) => usePlanPresence({ activeTabId: 't1', peers: p, send: (op) => sent.push(op) }),
    { initialProps: { peers } },
  );
  return { sent, hook };
}

describe('usePlanPresence late join', () => {
  it('says the held card again when a new person joins', () => {
    const { sent, hook } = setup([ana]);
    act(() => hook.result.current.publish('item0001', 'view'));
    expect(sent).toHaveLength(1);
    hook.rerender({ peers: [ana, ben] });
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual({
      kind: 'plan-presence',
      tabId: 't1',
      itemId: 'item0001',
      state: 'view',
    });
    // The same roster again says nothing more.
    hook.rerender({ peers: [ana, ben] });
    expect(sent).toHaveLength(2);
  });

  it('stays silent for a join while holding nothing, and after a release', () => {
    const { sent, hook } = setup([ana]);
    hook.rerender({ peers: [ana, ben] });
    expect(sent).toHaveLength(0);
    act(() => hook.result.current.publish('item0001', 'drag'));
    act(() => hook.result.current.publish(null, 'drag'));
    const before = sent.length;
    hook.rerender({ peers: [ben] });
    hook.rerender({ peers: [ben, { ...ana, id: 'p-ana-2' }] });
    expect(sent).toHaveLength(before);
  });

  it('says the held card again when its own connection rejoins', () => {
    const { sent, hook } = setup([ana]);
    act(() => hook.result.current.publish('item0002', 'drag'));
    act(() => hook.result.current.reannounce());
    expect(sent.at(-1)).toEqual({
      kind: 'plan-presence',
      tabId: 't1',
      itemId: 'item0002',
      state: 'drag',
    });
    const quiet = setup([ana]);
    act(() => quiet.hook.result.current.reannounce());
    expect(quiet.sent).toHaveLength(0);
  });

  it('draws a late joiner the holds it hears, and none for people who left', () => {
    const { hook } = setup([ana, ben]);
    act(() =>
      hook.result.current.receive('p-ben', { tabId: 't1', itemId: 'item0003', state: 'view' }),
    );
    expect(hook.result.current.presence.get('item0003')?.name).toBe('Ben');
    hook.rerender({ peers: [ana] });
    expect(hook.result.current.presence.get('item0003')).toBeUndefined();
  });
});

void vi;
