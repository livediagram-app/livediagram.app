// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RoomOp } from '@livedesign/api-schema';
import { usePhotoPresence } from './usePhotoPresence';

// docs/specs/031-photo/photo-pages.md "Collaboration": the Layers tab marks a layer someone else is on with
// their avatar, from their presence; a late joiner hears the layers already held.
type Peer = { id: string; name: string; color: string };
const ana: Peer = { id: 'p-ana', name: 'Ana', color: '#2563eb' };
const ben: Peer = { id: 'p-ben', name: 'Ben', color: '#dc2626' };

function setup(peers: Peer[], tabId = 't1') {
  const sent: RoomOp[] = [];
  const hook = renderHook(
    ({ peers: p, tab }) =>
      usePhotoPresence({ activeTabId: tab, peers: p, send: (op) => sent.push(op) }),
    { initialProps: { peers, tab: tabId } },
  );
  return { sent, hook };
}

describe('usePhotoPresence', () => {
  it('says the active layer once, and a release only after a hold', () => {
    const { sent, hook } = setup([ana]);
    act(() => hook.result.current.presence.publish(null, null));
    expect(sent).toHaveLength(0);
    act(() => hook.result.current.presence.publish('pg1', 'L1'));
    act(() => hook.result.current.presence.publish('pg1', 'L1'));
    expect(sent).toEqual([{ kind: 'photo-presence', tabId: 't1', pageId: 'pg1', layerId: 'L1' }]);
    act(() => hook.result.current.presence.publish(null, null));
    expect(sent.at(-1)).toEqual({ kind: 'photo-presence', tabId: 't1', pageId: '', layerId: null });
    act(() => hook.result.current.presence.publish(null, null));
    expect(sent).toHaveLength(2);
  });

  it('marks each layer with the peers on it, on this tab only, and forgets a peer who lets go', () => {
    const { hook } = setup([ana, ben]);
    act(() => {
      hook.result.current.receive('p-ana', { tabId: 't1', pageId: 'pg1', layerId: 'L1' });
      hook.result.current.receive('p-ben', { tabId: 't1', pageId: 'pg1', layerId: 'L1' });
    });
    expect(hook.result.current.presence.on('pg1', 'L1')).toEqual([
      { name: 'Ana', colour: '#2563eb' },
      { name: 'Ben', colour: '#dc2626' },
    ]);
    expect(hook.result.current.presence.on('pg1', 'L2')).toEqual([]);
    act(() => hook.result.current.receive('p-ben', { tabId: 't2', pageId: 'pg9', layerId: 'L9' }));
    expect(hook.result.current.presence.on('pg1', 'L1')).toEqual([
      { name: 'Ana', colour: '#2563eb' },
    ]);
    expect(hook.result.current.presence.on('pg9', 'L9')).toEqual([]);
    act(() => hook.result.current.receive('p-ana', { tabId: 't1', pageId: '', layerId: null }));
    expect(hook.result.current.presence.on('pg1', 'L1')).toEqual([]);
  });

  it('drops the mark of a peer who left the room', () => {
    const { hook } = setup([ana, ben]);
    act(() => hook.result.current.receive('p-ben', { tabId: 't1', pageId: 'pg1', layerId: 'L1' }));
    hook.rerender({ peers: [ana], tab: 't1' });
    expect(hook.result.current.presence.on('pg1', 'L1')).toEqual([]);
  });

  it('says the held layer again to a late joiner and after a rejoin', () => {
    const { sent, hook } = setup([ana]);
    act(() => hook.result.current.presence.publish('pg1', 'L1'));
    hook.rerender({ peers: [ana, ben], tab: 't1' });
    expect(sent).toHaveLength(2);
    act(() => hook.result.current.reannounce());
    expect(sent).toHaveLength(3);
    expect(sent.at(-1)).toEqual(sent[0]);
  });
});
