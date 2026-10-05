import { describe, expect, it } from 'vitest';
import type { AgentPresence } from '@livediagram/api-schema';
import type { Participant } from './identity';
import {
  buildAgentFocusByElement,
  foldAgentPresence,
  splitPresenceFrame,
  withoutAgentRows,
} from './agent-presence-rows';

// docs/specs/024-agents/agent-presence.md "In the editor", blueprint "Editor" and "Presentation and UX".

const NOW = 1_000;
const self: Participant = { id: 'me', name: 'Webber', color: '#3b82f6', status: 'online' };
const peer: Participant = {
  id: 'p2',
  name: 'Ada',
  color: '#10b981',
  status: 'online',
  lastActiveAt: 900,
};

const agent = (over: Partial<AgentPresence> = {}): AgentPresence => ({
  id: 'a1',
  name: 'Webber',
  color: '#3b82f6',
  role: 'edit',
  tabId: 't1',
  status: 'adding payment',
  focus: [],
  joins: [],
  person: 0,
  ...over,
});

const fold = (
  participantsByTab: Map<string, Participant[]>,
  agents: AgentPresence[],
  activeId = 't1',
) =>
  foldAgentPresence({
    participantsByTab,
    agents,
    selfParticipant: self,
    activeId,
    tabIds: ['t1', 't2'],
    now: NOW,
  });

describe('splitPresenceFrame', () => {
  it('keeps valid agent entries apart from the participants', () => {
    const frame = {
      participants: [{ id: 'p2', name: 'Ada', color: '#10b981' }],
      agents: [agent()],
    };
    expect(splitPresenceFrame(frame)).toEqual({
      participants: frame.participants,
      agents: [agent()],
    });
  });

  it('reads a frame without agents as none', () => {
    expect(splitPresenceFrame({ participants: [] })).toEqual({ participants: [], agents: [] });
  });

  it('drops malformed entries and clamps long strings', () => {
    const long = 'x'.repeat(200);
    const { agents } = splitPresenceFrame({
      participants: [],
      agents: [
        null,
        'nope',
        { ...agent(), id: 3 },
        { ...agent(), role: 'admin' },
        { ...agent(), person: 'one' },
        { ...agent(), focus: 'web' },
        { ...agent(), joins: [1] },
        { ...agent(), status: 7 },
        {
          ...agent(),
          id: 'a2',
          status: long,
          name: long,
          focus: Array.from({ length: 30 }, (_, i) => `e${i}`),
        },
        { ...agent(), id: 'a3', status: undefined, self: true },
      ],
    });
    expect(agents.map((a) => a.id)).toEqual(['a2', 'a3']);
    expect(agents[0]!.status).toHaveLength(80);
    expect(agents[0]!.name).toHaveLength(120);
    expect(agents[0]!.focus).toHaveLength(20);
    expect(agents[1]).toMatchObject({ self: true });
    expect(agents[1]).not.toHaveProperty('status');
  });

  it('ignores an agents field that is not a list', () => {
    expect(splitPresenceFrame({ participants: [], agents: 'x' }).agents).toEqual([]);
  });
});

describe('foldAgentPresence', () => {
  it('puts my own agent’s status on my row when it is on my tab', () => {
    const out = fold(new Map([['t1', [self]]]), [agent({ self: true })]);
    expect(out.get('t1')).toEqual([{ ...self, statusLine: 'adding payment' }]);
  });

  it('puts an agent’s status on its owner’s row when the owner is on the tab', () => {
    const out = fold(new Map([['t1', [self, peer]]]), [
      agent({ name: 'Ada', joins: ['p0', 'p2'] }),
    ]);
    expect(out.get('t1')).toEqual([self, { ...peer, statusLine: 'adding payment' }]);
  });

  it('adds a standalone row when the owner is not on the tab, my own agent elsewhere included', () => {
    const out = fold(new Map([['t1', [self]]]), [
      agent({ id: 'a1', tabId: 't2', self: true, status: undefined }),
    ]);
    expect(out.get('t2')).toEqual([
      {
        id: 'a1',
        name: 'Webber',
        color: '#3b82f6',
        role: 'edit',
        status: 'online',
        lastActiveAt: NOW,
        agent: true,
      },
    ]);
    expect(out.get('t1')).toEqual([self]);
  });

  it('shows two tokens of one owner on one tab as one row with the later status', () => {
    const out = fold(new Map([['t1', [self]]]), [
      agent({ id: 'a1', person: 3, status: 'first' }),
      agent({ id: 'a2', person: 3, status: 'second' }),
      agent({ id: 'a3', person: 3, tabId: 't2', status: 'elsewhere' }),
    ]);
    expect(out.get('t1')!.map((p) => [p.id, p.statusLine])).toEqual([
      ['me', undefined],
      ['a1', 'second'],
    ]);
    expect(out.get('t2')!.map((p) => p.statusLine)).toEqual(['elsewhere']);
  });

  it('joins a person’s entries to their row when any entry names it', () => {
    const out = fold(new Map([['t1', [self, peer]]]), [
      agent({ id: 'a1', person: 1, name: 'Ada' }),
      agent({ id: 'a2', person: 1, name: 'Ada', joins: ['p2'], status: 'reviewing' }),
    ]);
    expect(out.get('t1')).toEqual([self, { ...peer, statusLine: 'reviewing' }]);
  });

  it('skips entries on tabs it does not know, and leaves the input untouched', () => {
    const input = new Map([['t1', [self]]]);
    const out = fold(input, [agent({ tabId: 'gone' }), agent({ self: true })]);
    expect(out.has('gone')).toBe(false);
    expect(input.get('t1')).toEqual([self]);
    expect(out.get('t1')![0]!.statusLine).toBe('adding payment');
  });

  it('leaves the owner’s row as it is when their agent set no status', () => {
    const out = fold(new Map([['t1', [self]]]), [agent({ self: true, status: undefined })]);
    expect(out.get('t1')).toEqual([self]);
  });

  it('returns the same map when there are no agents', () => {
    const input = new Map([['t1', [self]]]);
    expect(fold(input, [])).toBe(input);
  });
});

describe('withoutAgentRows', () => {
  it('leaves agents out of anything that counts people', () => {
    const rows: Participant[] = [
      self,
      { ...peer, statusLine: 'x' },
      { ...peer, id: 'a1', agent: true },
    ];
    expect(withoutAgentRows(rows).map((p) => p.id)).toEqual(['me', 'p2']);
  });
});

describe('buildAgentFocusByElement', () => {
  it('maps focused elements on the active tab to their owners, once per person', () => {
    const out = buildAgentFocusByElement(
      [
        agent({ focus: ['e1', 'e2', 'gone'] }),
        agent({ id: 'a2', focus: ['e1'] }),
        agent({ id: 'a3', person: 1, name: 'Ada', color: '#10b981', focus: ['e1'] }),
        agent({ id: 'a4', tabId: 't2', focus: ['e2'] }),
      ],
      't1',
      new Set(['e1', 'e2']),
    );
    expect(out).toEqual(
      new Map([
        [
          'e1',
          [
            { name: 'Webber', color: '#3b82f6' },
            { name: 'Ada', color: '#10b981' },
          ],
        ],
        ['e2', [{ name: 'Webber', color: '#3b82f6' }]],
      ]),
    );
  });
});
