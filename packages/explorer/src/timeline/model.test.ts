import { describe, expect, it } from 'vitest';
import { TIMELINE_EVENT_TYPES } from '@liveworkspace/index-client';
import { makeEvent } from '../test/fakeClient';
import { EVENT_GLYPH_PATHS } from './icons';
import {
  buildMonthCells,
  buildStacks,
  collapseSameDayCreate,
  eventCategory,
  eventLabel,
  eventTone,
  groupByDay,
  isNewEvent,
  stackLabel,
} from './model';

const DAY = 24 * 60 * 60_000;
const noon = new Date(2026, 9, 21, 12).getTime();

describe('the Timeline’s rules', () => {
  it('groups by the reader’s day, newest first, and marks today', () => {
    const events = [
      makeEvent(1, { occurredAt: noon }),
      makeEvent(2, { occurredAt: noon - 60_000 }),
      makeEvent(3, { occurredAt: noon - DAY }),
    ];
    const groups = groupByDay(events, noon);
    expect(groups.map((g) => [g.key, g.events.length, g.isToday])).toEqual([
      ['2026-10-21', 2, true],
      ['2026-10-20', 1, false],
    ]);
    expect(groups[0]!.label).toBe('Wed, 21 Oct');
  });

  it('folds a day’s runs of one kind into a stack, and names it for every member', () => {
    const events = [
      makeEvent(1, { type: 'renamed' }),
      makeEvent(2, { type: 'edited' }),
      makeEvent(3, { type: 'renamed' }),
      makeEvent(4, { type: 'trashed' }),
      makeEvent(5, { type: 'restored' }),
    ];
    const stacks = buildStacks(events);
    expect(stacks.map((s) => [s.bucket, s.events.length])).toEqual([
      ['renamed', 2],
      ['edited', 1],
      ['trash', 2],
    ]);
    expect(stackLabel(stacks[0]!)).toBe('Plans Renamed');
    const mixed = buildStacks([
      makeEvent(1, { type: 'edited' }),
      makeEvent(2, { type: 'edited', app: 'livediagram' }),
    ]);
    expect(stackLabel(mixed[0]!)).toBe('Items Updated');
  });

  it('drops the edit of an item made the same day', () => {
    const made = makeEvent(1, { type: 'created', occurredAt: noon - 3_600_000 });
    const edit = makeEvent(1, { id: 'ed', type: 'edited', occurredAt: noon });
    const older = makeEvent(1, { id: 'old', type: 'edited', occurredAt: noon - 2 * DAY });
    expect(collapseSameDayCreate([edit, made, older]).map((e) => e.id)).toEqual([made.id, 'old']);
  });

  it('says what happened in the item’s own words', () => {
    expect(eventLabel(makeEvent(1, { type: 'renamed' }))).toBe('Plan Renamed');
    expect(eventLabel(makeEvent(1, { type: 'created', app: 'livediagram' }))).toBe(
      'Canvas Created',
    );
    expect(eventLabel(makeEvent(1, { type: 'created', detail: { source: 'ai' } }))).toBe(
      'Plan Made by AI',
    );
    expect(eventLabel(makeEvent(1, { type: 'edited' }))).toBe('Plan Updated');
  });

  it('gives every event type a tone, a category and a glyph of its own', () => {
    for (const type of TIMELINE_EVENT_TYPES) {
      expect(eventTone(type)).not.toBe('neutral');
      expect(eventCategory(type)).not.toBe('other');
    }
    const paths = Object.values(EVENT_GLYPH_PATHS);
    expect(new Set(paths).size).toBe(paths.length);
    expect(eventTone('trashed')).toBe('danger');
  });

  it('marks New only what arrived since the last look, and never the reader’s own doing', () => {
    const e = { occurredAt: noon, actorId: 'user_other' };
    expect(isNewEvent(e, null, 'user_me', noon)).toBe(false);
    expect(isNewEvent(e, noon - 1, 'user_me', noon)).toBe(true);
    expect(isNewEvent(e, noon, 'user_me', noon)).toBe(false);
    expect(isNewEvent({ ...e, actorId: 'user_me' }, noon - 1, 'user_me', noon)).toBe(false);
    // A clock skewed into the future is not New until it arrives.
    expect(isNewEvent({ ...e, occurredAt: noon + 1 }, noon - 1, 'user_me', noon)).toBe(false);
  });

  it('lays a month out in whole weeks, Monday first', () => {
    const cells = buildMonthCells('2026-10');
    expect(cells.length % 7).toBe(0);
    // 1 October 2026 is a Thursday: three pads, then the 1st.
    expect(cells.slice(0, 4).map((c) => c.day)).toEqual([null, null, null, 1]);
  });

  it('works out 10,000 events’ days, stacks and filters within budget', () => {
    const types = TIMELINE_EVENT_TYPES;
    const events = Array.from({ length: 10_000 }, (_, i) =>
      makeEvent(i, { type: types[i % types.length]!, occurredAt: noon - i * 600_000 }),
    );
    const start = performance.now();
    const groups = groupByDay(collapseSameDayCreate(events), noon);
    let stacks = 0;
    for (const g of groups) stacks += buildStacks(g.events).length;
    const ms = performance.now() - start;
    expect(groups.length).toBeGreaterThan(60);
    expect(stacks).toBeGreaterThan(groups.length);
    expect(ms).toBeLessThan(250);
  });
});
