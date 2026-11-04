// What the room keeps for the calls' server checks (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Trust",
// "Share roles"; video-and-screen-bubbles.md "Share roles"): positions, hands, let-speaks, stopped shares and each
// tab's rooms and stages, answering the mint route and gating a let-speak. Role tests for #483, #495 and #469.
import { describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  RoomCalls,
  ROOM_WAKE_GRACE_MS,
  tabCallsOf,
  type CallSessionHolder,
  type RoomCallsHost,
} from './room-calls';

// A room 0..1000 x 0..600 and a stage letting Participants speak, far off in the open.
const room = { id: 'room', type: 'shape', shape: 'room', x: 0, y: 0, width: 1000, height: 600 };
const stage = {
  id: 'stage',
  type: 'shape',
  shape: 'stage',
  x: 3000,
  y: 3000,
  width: 400,
  height: 160,
  stageSpeakers: 'take-part',
};
const TAB = JSON.stringify({ id: 't', elements: [room, stage] });

type Session = CallSessionHolder;

function setup(sessions: Session[], over: Partial<RoomCallsHost> = {}) {
  let now = 1_000_000;
  const host: RoomCallsHost = {
    now: () => now,
    sessions: () => sessions,
    readTab: vi.fn((tabId: string, knownRev: number | null) =>
      tabId === 't' ? { rev: 1, data: knownRev === 1 ? null : TAB } : null,
    ),
    ...over,
  };
  const calls = new RoomCalls(host);
  // Past the wake grace, unless a test says otherwise.
  now += ROOM_WAKE_GRACE_MS;
  return {
    calls,
    host,
    walk: (id: string, x: number, y: number, tabId = 't') =>
      calls.noteAvatar(id, { kind: 'avatar', tabId, avatar: { x, y, walking: false } }),
    at: (ms: number) => {
      now = ms;
    },
  };
}

const s = (presenceId: string, role: string, callSession?: string): Session => ({
  presenceId,
  role,
  ...(callSession ? { callSession } : {}),
});
const mic = (sessionId: string) => ({ sessionId, trackName: 'mic' });
const screen = (sessionId: string) => ({ sessionId, trackName: 'screen' });
const letSpeak = (targetId: string, on = true) => ({
  kind: 'avatar-let-speak',
  tabId: 't',
  targetId,
  on,
});
const hand = (raised: boolean) => ({ kind: 'avatar-hand', tabId: 't', raised });

describe('RoomCalls hearing (#483)', () => {
  const sessions = [
    s('ed', 'edit', 'S-ed'),
    s('pt', 'participate', 'S-pt'),
    s('vw', 'view', 'S-vw'),
  ];

  it('lets everyone in a room hear each other, Editor, Participant and Viewer alike', () => {
    const { calls, walk } = setup(sessions);
    walk('ed', 100, 300);
    walk('pt', 900, 300);
    walk('vw', 500, 500);
    expect(calls.hearing('S-vw', [mic('S-ed'), mic('S-pt')])).toEqual(['heard', 'heard']);
    expect(calls.hearing('S-pt', [mic('S-ed')])).toEqual(['heard']);
  });

  it('refuses a subscriber outside the room, whatever their level', () => {
    const { calls, walk } = setup(sessions);
    walk('pt', 500, 300);
    walk('ed', 500, 1200);
    walk('vw', 2000, 2000);
    expect(calls.hearing('S-ed', [mic('S-pt')])).toEqual(['apart']);
    expect(calls.hearing('S-vw', [mic('S-pt')])).toEqual(['apart']);
  });

  it('names nobody for a session the room has not been shown, and waits for a publisher it cannot place', () => {
    const { calls, walk } = setup([...sessions, s('new', 'edit')]);
    walk('ed', 100, 100);
    expect(calls.hearing('S-unknown', [mic('S-ed')])).toEqual(['unknown-session']);
    expect(calls.hearing('S-ed', [mic('S-nobody')])).toEqual(['unplaced']);
    // Walking stopped (`avatar: null`) forgets the position.
    calls.noteAvatar('ed', { kind: 'avatar', tabId: 't', avatar: null });
    walk('pt', 100, 100);
    expect(calls.hearing('S-pt', [mic('S-ed')])).toEqual(['unplaced']);
  });

  it('allows what it cannot place for its first minute', () => {
    const { calls, walk, at } = setup(sessions);
    at(1_000_000);
    walk('ed', 100, 100);
    expect(calls.hearing('S-ed', [mic('S-pt'), mic('S-nobody')])).toEqual(['heard', 'heard']);
  });

  it('ignores a position that is not one', () => {
    const { calls, walk } = setup(sessions);
    walk('ed', 100, 100);
    calls.noteAvatar('ed', { kind: 'avatar', tabId: 't', avatar: { x: 'far', y: 1 } });
    calls.noteAvatar('pt', null);
    walk('pt', 100, 100);
    expect(calls.hearing('S-pt', [mic('S-ed')])).toEqual(['unplaced']);
  });

  it('lets a stage speaker reach the tab: an Editor, or a Participant on a stage that lets them', () => {
    const { calls, walk } = setup(sessions);
    walk('pt', 3200, 3080);
    walk('vw', 100, 100);
    expect(calls.hearing('S-vw', [mic('S-pt')])).toEqual(['heard']);
    // A Viewer on the stage speaks to nobody: the room's walls stand.
    const viewerOnStage = setup([s('vw', 'view', 'S-vw'), s('pt', 'participate', 'S-pt')]);
    viewerOnStage.walk('vw', 3200, 3080);
    viewerOnStage.walk('pt', 100, 100);
    expect(viewerOnStage.calls.hearing('S-pt', [mic('S-vw')])).toEqual(['apart']);
  });

  it('reads each tab once per answer, and parses it again only when its revision moves', () => {
    const { calls, walk, host } = setup(sessions);
    walk('ed', 100, 100);
    walk('pt', 900, 500);
    calls.hearing('S-ed', [mic('S-pt'), mic('S-pt')]);
    expect(host.readTab).toHaveBeenCalledTimes(1);
    calls.hearing('S-ed', [mic('S-pt')]);
    expect(host.readTab).toHaveBeenLastCalledWith('t', 1);
  });

  it('treats a tab the room does not hold as the open floor', () => {
    const { calls, walk } = setup(sessions);
    walk('ed', 100, 100, 'gone');
    walk('pt', 150, 100, 'gone');
    expect(calls.hearing('S-ed', [mic('S-pt')])).toEqual(['heard']);
    // A revision with no body to read is the open floor too.
    const bodiless = setup(sessions, { readTab: () => ({ rev: 2, data: null }) });
    bodiless.walk('ed', 100, 100);
    bodiless.walk('pt', 150, 100);
    expect(bodiless.calls.hearing('S-ed', [mic('S-pt')])).toEqual(['heard']);
  });

  it('answers a crowded subscribe in well under a millisecond a track', () => {
    const crowd: Session[] = [];
    for (let i = 0; i < 100; i++) crowd.push(s(`p${i}`, 'participate', `S${i}`));
    const { calls, walk } = setup(crowd);
    for (let i = 0; i < 100; i++) walk(`p${i}`, (i * 97) % 4000, (i * 53) % 3000);
    const asks = Array.from({ length: 16 }, (_, i) => mic(`S${i + 1}`));
    const ms = cpuMsOf(() => {
      for (let n = 0; n < 100; n++) calls.hearing('S0', asks);
    });
    // 100 subscribes of 16 tracks in a room of 100. Measured about 8 ms on a laptop (about 80 µs a subscribe).
    expect(ms).toBeLessThan(cpuBudgetMs(150));
  });
});

describe('RoomCalls let-speak (#495)', () => {
  const sessions = [
    s('ed', 'edit', 'S-ed'),
    s('pt', 'participate', 'S-pt'),
    s('vw', 'view', 'S-vw'),
    s('hand', 'participate', 'S-hand'),
  ];

  it('lets an Editor anywhere let a raised hand speak, and the hand is then heard tab-wide', () => {
    const { calls, walk } = setup(sessions);
    walk('ed', 100, 100);
    walk('hand', 2000, 2000);
    walk('vw', 100, 100);
    calls.noteHand('hand', hand(true));
    expect(calls.letSpeak('ed', letSpeak('hand'))).toBe(true);
    expect(calls.hearing('S-vw', [mic('S-hand')])).toEqual(['heard']);
    // Done takes it back.
    expect(calls.letSpeak('ed', letSpeak('hand', false))).toBe(true);
    expect(calls.hearing('S-vw', [mic('S-hand')])).toEqual(['apart']);
  });

  it('lets a Participant only from a stage that lets them speak', () => {
    const { calls, walk } = setup(sessions);
    walk('pt', 100, 100);
    expect(calls.letSpeak('pt', letSpeak('hand'))).toBe(false);
    walk('pt', 3200, 3080);
    expect(calls.letSpeak('pt', letSpeak('hand'))).toBe(true);
  });

  it('refuses a Viewer, a sender the room cannot place, and a malformed op', () => {
    const { calls, walk } = setup(sessions);
    walk('vw', 3200, 3080);
    expect(calls.letSpeak('vw', letSpeak('hand'))).toBe(false);
    expect(calls.letSpeak('pt', letSpeak('hand'))).toBe(false);
    expect(calls.letSpeak('ed', { kind: 'avatar-let-speak', targetId: 'hand' })).toBe(false);
  });

  it('forgets who let a hand speak once it goes down, or never had it up', () => {
    const { calls, walk } = setup(sessions);
    walk('hand', 2000, 2000);
    walk('vw', 100, 100);
    expect(calls.letSpeak('ed', letSpeak('hand'))).toBe(true);
    expect(calls.hearing('S-vw', [mic('S-hand')])).toEqual(['apart']);
    calls.noteHand('hand', hand(true));
    calls.letSpeak('ed', letSpeak('hand'));
    calls.noteHand('hand', hand(false));
    calls.noteHand('hand', { kind: 'avatar-hand' });
    expect(calls.hearing('S-vw', [mic('S-hand')])).toEqual(['apart']);
  });
});

describe('RoomCalls stopped shares (#469)', () => {
  it("keeps a stopped screen from new viewers until the sharer's call says it is off", () => {
    const sessions = [s('ed', 'edit', 'S-ed'), s('sharer', 'edit', 'S-sh')];
    const { calls, walk } = setup(sessions);
    walk('ed', 100, 100);
    walk('sharer', 200, 100);
    calls.stopShare('sharer');
    expect(calls.hearing('S-ed', [screen('S-sh'), mic('S-sh')])).toEqual(['stopped', 'heard']);
    // Still sharing: the stop stands.
    const locator = { sessionId: 'S-sh', trackName: 'screen', token: 'k' };
    calls.noteTrack('sharer', { kind: 'call-track', tabId: 't', track: null, screen: locator });
    calls.noteTrack('sharer', { kind: 'junk' });
    expect(calls.hearing('S-ed', [screen('S-sh')])).toEqual(['stopped']);
    calls.noteTrack('sharer', { kind: 'call-track', tabId: 't', track: null, screen: null });
    expect(calls.hearing('S-ed', [screen('S-sh')])).toEqual(['heard']);
  });

  it('forgets everything about a session that left', () => {
    const sessions = [s('ed', 'edit', 'S-ed'), s('sharer', 'edit', 'S-sh')];
    const { calls, walk } = setup(sessions);
    walk('ed', 100, 100);
    walk('sharer', 200, 100);
    calls.stopShare('sharer');
    calls.forget('sharer');
    expect(calls.hearing('S-ed', [screen('S-sh')])).toEqual(['unplaced']);
  });
});

describe('tabCallsOf', () => {
  it('reads the rooms and stages on visible layers, and nothing from a tab that does not parse', () => {
    expect(tabCallsOf(TAB).zones.map((z) => z.id)).toEqual(['room']);
    expect(tabCallsOf(TAB).stages.map((z) => z.id)).toEqual(['stage']);
    const hidden = JSON.stringify({
      elements: [{ ...room, layerId: 'l2' }],
      layers: [
        { id: 'l1', name: 'One' },
        { id: 'l2', name: 'Two', visible: false },
      ],
    });
    expect(tabCallsOf(hidden).zones).toEqual([]);
    for (const bad of ['{', 'null', '{"elements":3}']) {
      expect(tabCallsOf(bad)).toEqual({ zones: [], stages: [] });
    }
  });
});
