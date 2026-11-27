import { describe, expect, it } from 'vitest';
import {
  FACILITATOR_GRACE_MS,
  SESSION_CAPACITY_MAX,
  SESSION_KINDS,
  SESSION_TIMEBOX_MAX_MS,
  SESSION_TIMEBOX_MIN_MS,
  facilitatorAway,
  isFacilitator,
  lastDecided,
  newSessionTab,
  readSessionTab,
  timeboxLeftMs,
  withCurrent,
  withDecision,
  withFacilitator,
  withNoDecisions,
  withoutDecision,
} from './session-tab';
import { isPlanTabKind, tabKindOf } from './tab-kind';
import { SESSION_QUEUE_MAX } from '@liveplanner/items';

// docs/specs/026-plan/session-tabs.md, blueprint session-tabs.md "Data and persistence", "Behaviour and state".
const SAM = { id: 'k-sam', name: 'Sam', color: '#0ea5e9' };
const base = newSessionTab('refinement', { typeIds: ['work'], statuses: ['backlog'] });

describe('the session kind', () => {
  it('is a Plan tab kind that reads back as itself', () => {
    expect(isPlanTabKind('session')).toBe(true);
    expect(tabKindOf({ kind: 'session' })).toBe('session');
    expect(SESSION_KINDS.refinement.outcomes).toEqual(['refined', 'skipped', 'flagged']);
    expect(SESSION_KINDS.planning).toMatchObject({
      label: 'Sprint Planning',
      outcomes: ['committed', 'skipped'],
      completes: 'committed',
      tally: 'estimate',
    });
  });
});

describe('readSessionTab', () => {
  it('reads nothing from a missing, malformed or later-release session', () => {
    expect(readSessionTab(undefined)).toBeNull();
    expect(readSessionTab([])).toBeNull();
    expect(readSessionTab({ sessionKind: 'standup', setup: {} })).toBeNull();
  });

  it('reads a whole session back', () => {
    const stored = {
      ...base,
      setup: {
        typeIds: ['work', 'work', '', 3],
        statuses: ['backlog'],
        sortBy: [{ field: 'priority', dir: 'desc' }],
        targets: { work: 'ready', bug: 4, '': 'x' },
        timeboxMs: 120_000,
      },
      facilitator: SAM,
      currentId: 'c1',
      cardStartedAt: 10,
      decided: { c0: { outcome: 'skipped', at: 5, by: 'Sam' }, c9: { outcome: 'nope', at: 1 } },
    };
    expect(readSessionTab(stored)).toEqual({
      v: 1,
      sessionKind: 'refinement',
      setup: {
        typeIds: ['work'],
        statuses: ['backlog'],
        sortBy: [{ field: 'priority', dir: 'desc' }],
        targets: { work: 'ready' },
        timeboxMs: 120_000,
      },
      facilitator: SAM,
      currentId: 'c1',
      cardStartedAt: 10,
      decided: { c0: { outcome: 'skipped', at: 5, by: 'Sam' } },
    });
  });

  it('bounds the timebox, fills a facilitator’s colour and drops what does not read', () => {
    const read = readSessionTab({
      sessionKind: 'refinement',
      setup: { timeboxMs: 1, targets: { bug: 4 } },
      facilitator: { id: 'k', name: 'Ali' },
      decided: { c: { outcome: 'refined', at: 1 } },
    })!;
    expect(read.setup).toEqual({ typeIds: [], statuses: [], timeboxMs: SESSION_TIMEBOX_MIN_MS });
    expect(read.facilitator?.color).toBe('#64748b');
    expect(read.decided).toEqual({ c: { outcome: 'refined', at: 1, by: '' } });
    const long = readSessionTab({ sessionKind: 'refinement', setup: { timeboxMs: 9e9 } })!;
    expect(long.setup.timeboxMs).toBe(SESSION_TIMEBOX_MAX_MS);
    const none = readSessionTab({
      sessionKind: 'refinement',
      setup: null,
      facilitator: { id: '', name: 'x' },
      timeboxMs: -1,
      decided: 'x',
    })!;
    expect(none).toEqual({ v: 1, sessionKind: 'refinement', setup: { typeIds: [], statuses: [] } });
    expect(
      readSessionTab({
        sessionKind: 'refinement',
        setup: { typeIds: Array.from({ length: 80 }, (_, i) => `t${i}`) },
      })!.setup.typeIds,
    ).toHaveLength(50);
    expect(
      readSessionTab({ sessionKind: 'refinement', decided: { c: 'x' } })!.decided,
    ).toBeUndefined();
    // Outcomes stop at the queue's cap.
    const many = Object.fromEntries(
      Array.from({ length: SESSION_QUEUE_MAX + 5 }, (_, i) => [
        `c${i}`,
        { outcome: 'skipped', at: i },
      ]),
    );
    expect(
      Object.keys(readSessionTab({ sessionKind: 'refinement', decided: many })!.decided!),
    ).toHaveLength(SESSION_QUEUE_MAX);
  });

  it('reads Bug Triage’s close stages and what each decision did, dropping what does not read', () => {
    const s = readSessionTab({
      sessionKind: 'triage',
      setup: { typeIds: ['bug'], statuses: ['new'], closeTargets: { bug: 'wont-fix', x: 4 } },
      decided: {
        a: {
          outcome: 'closed',
          at: 1,
          by: 'S',
          from: 'new',
          to: 'wont-fix',
          flagSet: true,
          reason: '  Not a Bug ',
          duplicateOf: 'z',
          linked: 'f-dup',
        },
        // A move with one end, a flag not true, an empty reason and a link with no duplicate all drop.
        b: { outcome: 'accepted', at: 2, from: 'new', flagSet: 1, reason: ' ', linked: 'f-dup' },
      },
    })!;
    expect(s.setup.closeTargets).toEqual({ bug: 'wont-fix' });
    expect(s.decided?.a).toEqual({
      outcome: 'closed',
      at: 1,
      by: 'S',
      from: 'new',
      to: 'wont-fix',
      flagSet: true,
      reason: 'Not a Bug',
      duplicateOf: 'z',
      linked: 'f-dup',
    });
    expect(s.decided?.b).toEqual({ outcome: 'accepted', at: 2, by: '' });
    expect(
      readSessionTab({ sessionKind: 'triage', setup: { closeTargets: { x: 4 } } })!.setup
        .closeTargets,
    ).toBeUndefined();
    expect(SESSION_KINDS.triage).toMatchObject({
      label: 'Bug Triage',
      outcomes: ['accepted', 'closed', 'skipped', 'flagged'],
      completes: 'accepted',
      closes: 'closed',
    });
  });

  it('keeps a Sprint Planning capacity as whole points within bounds, else none', () => {
    const cap = (capacity: unknown) =>
      readSessionTab({ sessionKind: 'planning', setup: { capacity } })!.setup.capacity;
    expect(cap(30)).toBe(30);
    expect(cap(12.6)).toBe(13);
    expect(cap(1e9)).toBe(SESSION_CAPACITY_MAX);
    expect(cap(0)).toBeUndefined();
    expect(cap(0.2)).toBeUndefined();
    expect(cap(-4)).toBeUndefined();
    expect(cap('30')).toBeUndefined();
    expect(cap(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(readSessionTab({ sessionKind: 'planning' })!.sessionKind).toBe('planning');
  });
});

describe('the facilitator', () => {
  it('is taken, handed over and stepped down from', () => {
    const held = withFacilitator(base, SAM);
    expect(isFacilitator(held, 'k-sam')).toBe(true);
    expect(isFacilitator(base, 'k-sam')).toBe(false);
    expect(withFacilitator(held, undefined)).toEqual(base);
  });

  it('is away only past the grace', () => {
    expect(facilitatorAway(0, FACILITATOR_GRACE_MS - 1)).toBe(false);
    expect(facilitatorAway(0, FACILITATOR_GRACE_MS)).toBe(true);
  });
});

describe('moving through the queue', () => {
  it('decides a card and moves on, restarting the clock', () => {
    const s = withDecision(withCurrent(base, 'c1', 5), 'c1', 'refined', 'Sam', 20, 'c2');
    expect(s.decided).toEqual({ c1: { outcome: 'refined', at: 20, by: 'Sam' } });
    expect([s.currentId, s.cardStartedAt]).toEqual(['c2', 20]);
    const done = withDecision(s, 'c2', 'skipped', 'Sam', 30, null);
    expect(done.currentId).toBeUndefined();
    expect(done.cardStartedAt).toBeUndefined();
  });

  it('undoes one outcome, and starts again', () => {
    const two = withDecision(
      withDecision(base, 'a', 'refined', 'S', 1, 'b'),
      'b',
      'flagged',
      'S',
      2,
      null,
    );
    expect(Object.keys(withoutDecision(two, 'a').decided!)).toEqual(['b']);
    expect(withoutDecision(withoutDecision(two, 'a'), 'b').decided).toBeUndefined();
    expect(withoutDecision(base, 'a')).toBe(base);
    expect(withNoDecisions(two)).toEqual(base);
  });

  // docs/specs/026-plan/session-tabs.md "The action bar" (Undo Last), "Bug Triage".
  it('keeps what an outcome did, and names the latest decision', () => {
    expect(lastDecided(base)).toBeNull();
    const closed = withDecision(base, 'a', 'closed', 'S', 5, 'b', {
      from: 'new',
      to: 'wont-fix',
      reason: 'Not a Bug',
      duplicateOf: 'z',
      linked: 'f-dup',
    });
    expect(closed.decided?.a).toEqual({
      outcome: 'closed',
      at: 5,
      by: 'S',
      from: 'new',
      to: 'wont-fix',
      reason: 'Not a Bug',
      duplicateOf: 'z',
      linked: 'f-dup',
    });
    const two = withDecision(closed, 'b', 'flagged', 'S', 9, null, { flagSet: true });
    expect(lastDecided(two)).toEqual({ itemId: 'b', decision: two.decided!.b });
    // By when each was decided, whatever order the record keeps them in.
    const swapped = { ...two, decided: { b: two.decided!.b!, a: two.decided!.a! } };
    expect(lastDecided(swapped)?.itemId).toBe('b');
  });
});

describe('the timebox', () => {
  it('counts down from the card’s start, never below nothing', () => {
    const boxed = withCurrent(
      newSessionTab('refinement', { typeIds: [], statuses: [], timeboxMs: 60_000 }),
      'c',
      1000,
    );
    expect(timeboxLeftMs(boxed, 31_000)).toBe(30_000);
    expect(timeboxLeftMs(boxed, 999_000)).toBe(0);
    expect(timeboxLeftMs(base, 5)).toBeNull();
    expect(timeboxLeftMs({ ...boxed, cardStartedAt: undefined }, 5)).toBeNull();
  });
});
