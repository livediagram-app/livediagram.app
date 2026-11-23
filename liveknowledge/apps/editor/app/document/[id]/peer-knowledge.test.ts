import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveknowledge/document';
import type { RoomOp } from '@liveknowledge/api-schema';
import type { PresenceCoalescer } from '@liveworkspace/workbench/lib/presence-coalescer';
import { withoutPeerKnowledge } from './peer-knowledge';
import { receiveRoomOp } from './room-op-receive';
import { createRemoteOpJournal } from './save-baseline';
import type { RoomConnectionOptions } from './useRoomConnection.types';

// A page's own fields (owner, Verify, approval) reach an open editor from the api alone
// (docs/specs/030-knowledgebase/verification.md "Share roles"): a peer's op loses them, the api's keeps them.

const owned = { owner: 'acct_o' };
const verified = { owner: 'acct_x', verifiedAt: 1_800_000_000_000, verifiedBy: 'acct_x' };
const page = { id: 't1', name: 'Page', elements: [], knowledge: owned } as unknown as Tab;

describe('withoutPeerKnowledge', () => {
  it('drops knowledge from a peer’s tab-meta patch and clear list, keeping the rest', () => {
    const op: RoomOp = {
      kind: 'tab-meta',
      tabId: 't1',
      patch: { name: 'Renamed', knowledge: verified },
      clear: ['knowledge', 'cover'],
    };
    expect(withoutPeerKnowledge('P', op)).toEqual({
      kind: 'tab-meta',
      tabId: 't1',
      patch: { name: 'Renamed' },
      clear: ['cover'],
    });
    expect(
      withoutPeerKnowledge('P', { kind: 'tab-meta', tabId: 't1', patch: {}, clear: ['knowledge'] }),
    ).toEqual({ kind: 'tab-meta', tabId: 't1', patch: {} });
  });

  it('drops knowledge from a peer’s whole tab', () => {
    const op = { kind: 'tab', tabId: 't1', tab: { ...page, knowledge: verified } } as RoomOp;
    expect(withoutPeerKnowledge('P', op)).toEqual({
      kind: 'tab',
      tabId: 't1',
      tab: { id: 't1', name: 'Page', elements: [] },
    });
  });

  it('hands back the api’s op, and a peer’s op without knowledge, as they are', () => {
    const api: RoomOp = { kind: 'tab-meta', tabId: 't1', patch: { knowledge: verified } };
    expect(withoutPeerKnowledge('system', api)).toBe(api);
    const rename: RoomOp = {
      kind: 'tab-meta',
      tabId: 't1',
      patch: { name: 'x' },
      clear: ['cover'],
    };
    expect(withoutPeerKnowledge('P', rename)).toBe(rename);
    const tab = { kind: 'tab', tabId: 't1', tab: { id: 't1', name: 'x', elements: [] } } as RoomOp;
    expect(withoutPeerKnowledge('P', tab)).toBe(tab);
    const el: RoomOp = { kind: 'el', tabId: 't1', op: { kind: 'remove', id: 'a' } };
    expect(withoutPeerKnowledge('P', el)).toBe(el);
  });
});

describe('a received op on a page’s fields', () => {
  // The tabs on screen after one op from `from`, through the receiver the room connection runs.
  function receive(from: string, op: RoomOp, tabs: Tab[] = [page]): Tab[] {
    let next = tabs;
    const opts = {
      markSeen: vi.fn(),
      loadedTabIdsRef: { current: new Set(['t1']) },
      saveBaseline: {
        tabs: { current: tabs },
        name: { current: 'K' },
        journal: { current: createRemoteOpJournal() },
      },
      applyRemoteOp: (fn: (prev: Tab[]) => Tab[]) => void (next = fn(next)),
      countAppliedOp: vi.fn(),
      markTabLoaded: vi.fn(),
      setDocumentName: vi.fn(),
    } as unknown as RoomConnectionOptions;
    receiveRoomOp(from, op, {} as PresenceCoalescer, opts, { current: new Map() });
    return next;
  }

  it('never shows a peer’s Verify, nor a peer’s clear of the page’s fields', () => {
    const set = receive('P', { kind: 'tab-meta', tabId: 't1', patch: { knowledge: verified } });
    expect(set[0]!.knowledge).toEqual(owned);
    const cleared = receive('P', {
      kind: 'tab-meta',
      tabId: 't1',
      patch: {},
      clear: ['knowledge'],
    });
    expect(cleared[0]!.knowledge).toEqual(owned);
  });

  it('keeps the page’s fields through a peer’s whole tab, and takes the rest of it', () => {
    const op = {
      kind: 'tab',
      tabId: 't1',
      tab: { id: 't1', name: 'Renamed', elements: [], knowledge: verified },
    } as RoomOp;
    const [tab] = receive('P', op);
    expect(tab!.name).toBe('Renamed');
    expect(tab!.knowledge).toEqual(owned);
    const bare = { ...page, knowledge: undefined } as Tab;
    expect(receive('P', op, [bare])[0]!.knowledge).toBeUndefined();
  });

  it('shows the api’s Verify, owner change and clear live', () => {
    const set = receive('system', {
      kind: 'tab-meta',
      tabId: 't1',
      patch: { knowledge: verified },
    });
    expect(set[0]!.knowledge).toEqual(verified);
    const owner = receive('system', {
      kind: 'tab-meta',
      tabId: 't1',
      patch: { knowledge: { owner: 'acct_n' } },
    });
    expect(owner[0]!.knowledge).toEqual({ owner: 'acct_n' });
    const cleared = receive('system', {
      kind: 'tab-meta',
      tabId: 't1',
      patch: {},
      clear: ['knowledge'],
    });
    expect(cleared[0]!.knowledge).toBeUndefined();
  });
});
