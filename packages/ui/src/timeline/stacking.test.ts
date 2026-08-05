import { describe, expect, it } from 'vitest';
import { buildStacks, bucketFor, stackLabel } from './stacking';
import type { TimelineEvent } from './types';

let seq = 0;
function event(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    sourceType: 'diagram',
    sourceId: `s${seq}`,
    eventType: 'diagram_edited',
    title: 'Diagram Updated',
    description: null,
    occurredAt: 1_754_380_800_000,
    actorId: 'owner-1',
    snapshot: {},
    ...overrides,
  };
}

describe('buildStacks', () => {
  it('collapses same-kind events into one stack', () => {
    const stacks = buildStacks([event(), event(), event()]);
    expect(stacks).toHaveLength(1);
    expect(stacks[0]!.events).toHaveLength(3);
  });

  it('keeps different kinds in separate stacks', () => {
    const stacks = buildStacks([event(), event({ eventType: 'diagram_renamed' })]);
    expect(stacks).toHaveLength(2);
  });

  // The behaviour the day-reading model depends on: a reader scans a
  // day by KIND of activity, not by what happened to run consecutively.
  it('groups by kind regardless of adjacency', () => {
    const stacks = buildStacks([
      event(),
      event({ eventType: 'diagram_renamed' }),
      event(),
      event(),
    ]);
    expect(stacks).toHaveLength(2);
    expect(stacks[0]!.events).toHaveLength(3);
    expect(stacks[1]!.events).toHaveLength(1);
  });

  it('places a stack at its most recent member, given newest-first input', () => {
    const newest = event({ id: 'newest', occurredAt: 3 });
    const stacks = buildStacks([
      event({ eventType: 'diagram_renamed', occurredAt: 4 }),
      newest,
      event({ occurredAt: 1 }),
    ]);
    // The edited stack sits second — where its newest member was —
    // rather than being pushed to the end.
    expect(stacks[1]!.key).toBe('newest');
  });

  it('never stacks comments, so the words are always readable', () => {
    const stacks = buildStacks([
      event({ eventType: 'comment_added' }),
      event({ eventType: 'comment_added' }),
    ]);
    expect(stacks).toHaveLength(2);
    expect(stacks.every((s) => s.events.length === 1)).toBe(true);
  });

  it('never stacks a deletion, so a tombstone cannot hide in a run', () => {
    const stacks = buildStacks([
      event({ eventType: 'diagram_deleted' }),
      event({ eventType: 'diagram_deleted' }),
    ]);
    expect(stacks).toHaveLength(2);
  });

  it('folds join and leave into one membership bucket', () => {
    const stacks = buildStacks([
      event({ sourceType: 'team', eventType: 'team_member_joined' }),
      event({ sourceType: 'team', eventType: 'team_member_left' }),
    ]);
    expect(stacks).toHaveLength(1);
    expect(stackLabel(stacks[0]!)).toBe('Members Changed');
  });

  it('returns an empty list for an empty day', () => {
    expect(buildStacks([])).toEqual([]);
  });
});

describe('bucketFor', () => {
  it('namespaces by source type so two products cannot collide', () => {
    expect(bucketFor(event({ sourceType: 'diagram', eventType: 'x' }))).toBe('diagram::x');
    expect(bucketFor(event({ sourceType: 'team', eventType: 'x' }))).toBe('team::x');
  });
});

describe('stackLabel', () => {
  it('uses a generic headline that is true of every member', () => {
    const stacks = buildStacks([event(), event()]);
    expect(stackLabel(stacks[0]!)).toBe('Diagrams Updated');
  });

  // A source type a newer worker invents still has to read correctly.
  it('falls back to the shared title for an unmapped bucket', () => {
    const stacks = buildStacks([
      event({ eventType: 'brand_new_thing', title: 'Something Happened' }),
      event({ eventType: 'brand_new_thing', title: 'Something Happened' }),
    ]);
    expect(stackLabel(stacks[0]!)).toBe('Something Happened');
  });
});
