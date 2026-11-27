import { describe, expect, it } from 'vitest';
import { item } from './test-items';
import type { ItemTypeDef } from './item-types';
import {
  SESSION_QUEUE_MAX,
  isSessionKindId,
  isSessionOutcome,
  nextToGo,
  sessionQueue,
  sessionTarget,
} from './session-queue';

// docs/specs/026-plan/session-tabs.md "The queue", "The action bar": what a session works through, and where
// Refined takes each card.
const work: ItemTypeDef = {
  id: 'work',
  label: 'Work',
  newTitle: 'New work',
  glyph: 'task',
  color: '#7c3aed',
  fields: ['title', 'status', 'priority'],
  statuses: ['backlog', 'detail', 'ready', 'done'],
};
const bug: ItemTypeDef = { ...work, id: 'bug', label: 'Bug', statuses: ['new', 'fixing', 'done'] };
const TYPES = [work, bug];
const PLAN = ['backlog', 'new', 'detail', 'ready', 'fixing', 'done'];

const card = (title: string, status: string, extra: Parameters<typeof item>[1] = {}) =>
  item({ title, status }, { type: 'work', ...extra });

describe('sessionQueue', () => {
  const a = card('A', 'backlog', { rank: 'b' });
  const b = card('B', 'backlog', { rank: 'a' });
  const c = card('C', 'detail', { rank: 'c' });
  const d = card('D', 'ready');
  const e = card('E', 'new', { type: 'bug' });
  const archived = card('Gone', 'backlog', {
    fields: { title: 'Gone', status: 'backlog', archived: true },
  });
  const items = [a, b, c, d, e, archived];

  it('picks the chosen types in the chosen stages, in rank order, leaving out archived cards', () => {
    const q = sessionQueue({
      items,
      types: TYPES,
      pick: { typeIds: ['work'], statuses: ['backlog', 'detail'] },
    });
    expect(q.toGo.map((i) => i.fields['title'])).toEqual(['B', 'A', 'C']);
    expect(q.decided).toEqual([]);
    expect(q.capped).toBe(false);
  });

  it('sorts as a board sorts', () => {
    const hi = card('Hi', 'backlog', {
      fields: { title: 'Hi', status: 'backlog', priority: 'urgent' },
    });
    const q = sessionQueue({
      items: [a, hi],
      types: TYPES,
      pick: {
        typeIds: ['work'],
        statuses: ['backlog'],
        sortBy: [{ field: 'priority', dir: 'desc' }],
      },
    });
    expect(q.toGo.map((i) => i.fields['title'])).toEqual(['Hi', 'A']);
  });

  it('keeps decided cards first, by when they were decided, wherever they are now', () => {
    const q = sessionQueue({
      items,
      types: TYPES,
      pick: { typeIds: ['work', 'bug'], statuses: ['backlog', 'new'] },
      decided: { [d.id]: { at: 2 }, [a.id]: { at: 1 }, [archived.id]: { at: 0 } },
    });
    expect(q.decided.map((i) => i.fields['title'])).toEqual(['A', 'D']);
    expect(q.toGo.map((i) => i.fields['title'])).toEqual(['B', 'E']);
  });

  it('caps the queue', () => {
    const many = Array.from({ length: SESSION_QUEUE_MAX + 3 }, (_, i) => card(`c${i}`, 'backlog'));
    const q = sessionQueue({
      items: many,
      types: TYPES,
      pick: { typeIds: ['work'], statuses: ['backlog'] },
      decided: { [many[0]!.id]: { at: 1 } },
    });
    expect(q.decided.length + q.toGo.length).toBe(SESSION_QUEUE_MAX);
    expect(q.capped).toBe(true);
  });
});

describe('sessionTarget', () => {
  it('defaults to the next stage in the type’s order', () => {
    expect(sessionTarget(card('A', 'backlog'), TYPES, PLAN)).toBe('detail');
    expect(sessionTarget(card('E', 'new', { type: 'bug' }), TYPES, PLAN)).toBe('fixing');
  });

  it('takes the set-up’s stage for the type when the type uses it', () => {
    expect(sessionTarget(card('A', 'backlog'), TYPES, PLAN, { work: 'ready' })).toBe('ready');
    expect(sessionTarget(card('A', 'backlog'), TYPES, PLAN, { work: 'fixing' })).toBe('detail');
    expect(sessionTarget(card('R', 'ready'), TYPES, PLAN, { work: 'ready' })).toBeNull();
  });

  it('answers null with no later stage, or a stage the type does not use', () => {
    expect(sessionTarget(card('D', 'done'), TYPES, PLAN)).toBeNull();
    expect(sessionTarget(card('X', 'fixing'), TYPES, PLAN)).toBeNull();
  });
});

describe('nextToGo', () => {
  const [a, b, c] = [card('A', 'backlog'), card('B', 'backlog'), card('C', 'backlog')];
  it('moves to the card after, else the one before, else the first, else none', () => {
    expect(nextToGo([a, b, c], b.id)).toBe(c);
    expect(nextToGo([a, b, c], c.id)).toBe(b);
    expect(nextToGo([a, b, c], 'gone')).toBe(a);
    expect(nextToGo([a, b, c])).toBe(a);
    expect(nextToGo([a], a.id)).toBeNull();
    expect(nextToGo([], a.id)).toBeNull();
  });
});

it('knows its session kinds and outcomes', () => {
  expect(isSessionKindId('refinement')).toBe(true);
  expect(isSessionKindId('standup')).toBe(false);
  expect(isSessionOutcome('skipped')).toBe(true);
  expect(isSessionOutcome('done')).toBe(false);
});
