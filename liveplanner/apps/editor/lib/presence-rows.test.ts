import { describe, expect, it } from 'vitest';
import type { Participant } from './identity';
import {
  buildParticipantsByTab,
  buildRemoteCursorRows,
  buildRemoteSelectionsByElement,
  resolveOwnerBadge,
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
    projectTeamId: null,
    now: 1000,
  };

  // docs/specs/007-editor/split-view.md "Presence"
  it('shows someone working side by side on both of their tabs', () => {
    const peer = p('peer');
    const m = buildParticipantsByTab({
      ...common,
      tabs: [{ id: 't1' }, { id: 't2' }, { id: 't3' }],
      projectShareable: true,
      remoteTabFocus: new Map([['peer', 't2']]),
      remoteBesideTabs: new Map([['peer', 't1']]),
      selfBesideTabId: 't3',
      livePresence: [self, peer],
      livePresenceById: byId(self, peer),
      lastSeen: new Map([['peer', 1000]]),
    });
    // The peer edits t2 and has t1 beside it: on both, online on ours (we are on t1).
    expect(m.get('t2')?.map((x) => x.id)).toEqual(['peer']);
    expect(m.get('t1')?.find((x) => x.id === 'peer')?.status).toBe('online');
    // We show on our own other pane's tab too.
    expect(m.get('t3')?.map((x) => x.id)).toEqual(['me']);
  });

  it('returns an empty map for a private (unshared) project', () => {
    const m = buildParticipantsByTab({
      ...common,
      projectShareable: false,
      remoteTabFocus: new Map(),
      livePresence: [self],
      livePresenceById: byId(self),
      lastSeen: new Map(),
    });
    expect(m.size).toBe(0);
  });

  it('shows presence for a team project even when not shared (docs/specs/013-workspace/team-shared-projects.md)', () => {
    const m = buildParticipantsByTab({
      ...common,
      projectShareable: false,
      projectTeamId: 'team-1',
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
      projectShareable: true,
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
      projectShareable: true,
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
      projectShareable: true,
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
      projectShareable: true,
      remoteTabFocus: new Map(), // no focus op yet
      livePresence: [self, a],
      livePresenceById: byId(self, a),
      lastSeen: new Map([['a', 1000]]),
    });
    // tabs[0] is t1 (the active tab) -> online
    expect(m.get('t1')!.some((x) => x.id === 'a')).toBe(true);
  });

  it('drops our own other browser tabs, which share our collab key (docs/specs/012-collaboration/collaborator-enhancements.md)', () => {
    const me = p('me', { key: 'k-me' });
    const myOtherTab = p('sock-2', { key: 'k-me' });
    const m = buildParticipantsByTab({
      ...common,
      selfParticipant: me,
      projectShareable: true,
      remoteTabFocus: new Map([['sock-2', 't2']]),
      livePresence: [me, myOtherTab],
      livePresenceById: byId(me, myOtherTab),
      lastSeen: new Map([['sock-2', 1000]]),
    });
    expect([...m.values()].flat().map((x) => x.id)).toEqual(['me']);
  });

  it("collapses a peer's several connections to their most recently active one", () => {
    const stale = p('sock-a1', { key: 'k-a' });
    const fresh = p('sock-a2', { key: 'k-a' });
    const m = buildParticipantsByTab({
      ...common,
      projectShareable: true,
      remoteTabFocus: new Map([
        ['sock-a1', 't1'],
        ['sock-a2', 't2'],
      ]),
      livePresence: [self, stale, fresh],
      livePresenceById: byId(self, stale, fresh),
      lastSeen: new Map([
        ['sock-a1', 500],
        ['sock-a2', 900],
      ]),
    });
    expect(m.get('t1')!.map((x) => x.id)).toEqual(['me']);
    expect(m.get('t2')!.map((x) => x.id)).toEqual(['sock-a2']);
  });

  it('keeps peers with no collab key apart (older clients fall back to their id)', () => {
    const a = p('a');
    const b = p('b');
    const m = buildParticipantsByTab({
      ...common,
      projectShareable: true,
      remoteTabFocus: new Map([
        ['a', 't1'],
        ['b', 't1'],
      ]),
      livePresence: [self, a, b],
      livePresenceById: byId(self, a, b),
      lastSeen: new Map(),
    });
    expect(m.get('t1')!.map((x) => x.id)).toEqual(['me', 'a', 'b']);
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

describe('resolveOwnerBadge', () => {
  const base = {
    isOwner: false,
    selfParticipant: p('me'),
    livePresence: [] as Participant[],
    projectOwnerId: null as string | null,
    projectOwnerName: null as string | null,
    projectOwnerColor: null as string | null,
  };

  it('returns self when the viewer IS the owner', () => {
    expect(resolveOwnerBadge({ ...base, isOwner: true })).toEqual(p('me'));
  });

  it('matches the live presence row by id when the owner id is known', () => {
    const owner = p('owner-1', { status: 'online' });
    const out = resolveOwnerBadge({
      ...base,
      livePresence: [p('other'), owner],
      projectOwnerId: 'owner-1',
    });
    expect(out).toBe(owner);
  });

  it('matches live presence by name + colour when the id is redacted', () => {
    // Visitors get ownerId '' from the share endpoint, so the live row
    // can only be matched on the joined name + colour pair.
    const owner = p('anon', { name: 'Ada', color: '#abcdef' });
    const out = resolveOwnerBadge({
      ...base,
      livePresence: [owner],
      projectOwnerName: 'Ada',
      projectOwnerColor: '#abcdef',
    });
    expect(out).toBe(owner);
  });

  it('falls back to a synthetic offline row keyed off the joined name', () => {
    const out = resolveOwnerBadge({
      ...base,
      projectOwnerName: 'Ada',
      projectOwnerColor: '#abcdef',
    });
    expect(out).toEqual({ id: 'owner', name: 'Ada', color: '#abcdef', status: 'offline' });
  });

  it('returns null when the owner has no participant record at all', () => {
    expect(resolveOwnerBadge(base)).toBeNull();
  });
});

// docs/specs/013-workspace/share-roles.md: a Viewer only looks, so its selection holds nothing.
describe('buildRemoteSelectionsByElement holds', () => {
  it("marks a Viewer's selection as not holding, a Participant's and an Editor's as holding", () => {
    const peer = (id: string, role?: 'view' | 'participate' | 'edit') =>
      [id, { id, name: id, color: '#000', status: 'online', lastActiveAt: 0, role }] as const;
    const presence = new Map([
      peer('v', 'view'),
      peer('p', 'participate'),
      peer('e', 'edit'),
      peer('old'),
    ]);
    const selections = new Map([
      ['v', { elementId: 'a' }],
      ['p', { elementId: 'b' }],
      ['e', { elementId: 'c' }],
      ['old', { elementId: 'd' }],
    ]);
    const out = buildRemoteSelectionsByElement(selections, presence, 'self', 't');
    expect(out.get('a')?.[0]?.holds).toBe(false);
    expect(out.get('b')?.[0]?.holds).toBe(true);
    expect(out.get('c')?.[0]?.holds).toBe(true);
    expect(out.get('d')?.[0]?.holds).toBe(true);
  });
});
