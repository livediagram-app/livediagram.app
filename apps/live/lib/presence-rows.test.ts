import { describe, expect, it } from 'vitest';
import type { Participant } from './identity';
import {
  buildLaserTrailRows,
  buildParticipantsByTab,
  buildRemoteCursorRows,
  buildRemoteSelectionsByElement,
} from './presence-rows';

const p = (id: string, over: Partial<Participant> = {}): Participant => ({
  id,
  name: id.toUpperCase(),
  color: '#123456',
  status: 'online',
  ...over,
});

const byId = (...ps: Participant[]) => new Map(ps.map((x) => [x.id, x] as const));

describe('buildParticipantsByTab', () => {
  const self = p('me');
  const common = {
    activeId: 't1',
    selfParticipant: self,
    tabs: [{ id: 't1' }, { id: 't2' }],
    diagramTeamId: null,
    now: 1000,
  };

  it('returns an empty map for a private (unshared) diagram', () => {
    const m = buildParticipantsByTab({
      ...common,
      diagramShareable: false,
      remoteTabFocus: new Map(),
      livePresence: [self],
      livePresenceById: byId(self),
      lastSeen: new Map(),
    });
    expect(m.size).toBe(0);
  });

  it('shows presence for a team diagram even when not shared (spec/35)', () => {
    const m = buildParticipantsByTab({
      ...common,
      diagramShareable: false,
      diagramTeamId: 'team-1',
      remoteTabFocus: new Map(),
      livePresence: [self],
      livePresenceById: byId(self),
      lastSeen: new Map(),
    });
    expect(m.size).toBeGreaterThan(0);
  });

  it('always puts self online on the active tab when shared', () => {
    const m = buildParticipantsByTab({
      ...common,
      diagramShareable: true,
      remoteTabFocus: new Map(),
      livePresence: [self],
      livePresenceById: byId(self),
      lastSeen: new Map(),
    });
    expect(m.get('t1')).toEqual([{ ...self, status: 'online', lastActiveAt: 1000 }]);
  });

  it('marks a recent peer on my tab online, on another tab away', () => {
    const a = p('a');
    const b = p('b');
    const m = buildParticipantsByTab({
      ...common,
      diagramShareable: true,
      remoteTabFocus: new Map([
        ['a', 't1'],
        ['b', 't2'],
      ]),
      livePresence: [self, a, b],
      livePresenceById: byId(self, a, b),
      lastSeen: new Map([
        ['a', 1000],
        ['b', 1000],
      ]),
    });
    expect(m.get('t1')!.find((x) => x.id === 'a')!.status).toBe('online');
    expect(m.get('t2')!.find((x) => x.id === 'b')!.status).toBe('away');
  });

  it('lets idle override tab-focus (long-idle peer is offline)', () => {
    const a = p('a');
    const m = buildParticipantsByTab({
      ...common,
      diagramShareable: true,
      remoteTabFocus: new Map([['a', 't1']]), // on my tab...
      livePresence: [self, a],
      livePresenceById: byId(self, a),
      lastSeen: new Map([['a', 1000 - 60 * 60 * 1000]]), // ...but idle an hour
    });
    expect(m.get('t1')!.find((x) => x.id === 'a')!.status).toBe('offline');
  });

  it('defaults a joiner with no tab-focus op to the first tab', () => {
    const a = p('a');
    const m = buildParticipantsByTab({
      ...common,
      diagramShareable: true,
      remoteTabFocus: new Map(), // no focus op yet
      livePresence: [self, a],
      livePresenceById: byId(self, a),
      lastSeen: new Map([['a', 1000]]),
    });
    // tabs[0] is t1 (the active tab) -> online
    expect(m.get('t1')!.some((x) => x.id === 'a')).toBe(true);
  });
});

describe('buildRemoteCursorRows', () => {
  const self = p('me');
  const a = p('a');
  it('keeps active-tab peer cursors, drops self / off-canvas / other-tab', () => {
    const cursors = new Map<string, { tabId: string; x: number; y: number } | null>([
      ['me', { tabId: 't1', x: 1, y: 1 }], // self -> dropped
      ['a', { tabId: 't1', x: 5, y: 6 }], // kept
      ['b', null], // off-canvas -> dropped
      ['c', { tabId: 't2', x: 9, y: 9 }], // other tab -> dropped
    ]);
    const rows = buildRemoteCursorRows(cursors, byId(self, a, p('c')), 'me', 't1');
    expect(rows).toEqual([{ id: 'a', name: 'A', color: '#123456', x: 5, y: 6 }]);
  });
});

describe('buildLaserTrailRows', () => {
  it('puts the local trail first, then active-tab present peers', () => {
    const self = p('me', { color: '#fff' });
    const a = p('a', { color: '#aaa' });
    const rows = buildLaserTrailRows({
      localLaserTrail: [{ x: 0, y: 0, t: 1 }],
      remoteLaserTrails: new Map([
        ['a', { tabId: 't1', points: [{ x: 1, y: 1, t: 2 }] }],
        ['b', { tabId: 't2', points: [{ x: 2, y: 2, t: 3 }] }], // other tab -> dropped
      ]),
      livePresenceById: byId(self, a),
      selfId: 'me',
      selfColor: '#fff',
      activeId: 't1',
    });
    expect(rows.map((r) => r.participantId)).toEqual(['me', 'a']);
    expect(rows[0]!.color).toBe('#fff');
  });
});

describe('buildRemoteSelectionsByElement', () => {
  it('groups remote selectors per element, dropping self + deselected', () => {
    const a = p('a');
    const b = p('b');
    const out = buildRemoteSelectionsByElement(
      new Map([
        ['a', { elementId: 'el1', tabId: 't1' }],
        ['b', { elementId: 'el1', tabId: 't1' }],
        ['me', { elementId: 'el2', tabId: 't1' }], // self -> dropped
        ['c', { elementId: null, tabId: 't1' }], // deselected -> dropped
      ]),
      byId(a, b),
      'me',
      't1',
    );
    expect(out.get('el1')!.map((x) => x.id)).toEqual(['a', 'b']);
    expect(out.has('el2')).toBe(false);
  });

  it('drops selections scoped to a different tab, keeps tab-unknown legacy frames', () => {
    const a = p('a');
    const b = p('b');
    const out = buildRemoteSelectionsByElement(
      new Map([
        // Same element id living on ANOTHER tab (a duplicated tab's
        // verbatim copy): must not badge or lock our copy.
        ['a', { elementId: 'el1', tabId: 'other-tab' }],
        // Older peer, no tabId: shown everywhere (the old behaviour).
        ['b', { elementId: 'el1' }],
      ]),
      byId(a, b),
      'me',
      't1',
    );
    expect(out.get('el1')!.map((x) => x.id)).toEqual(['b']);
  });
});
