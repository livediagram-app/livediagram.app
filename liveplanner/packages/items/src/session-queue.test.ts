import { describe, expect, it } from 'vitest';
import { item } from './test-items';
import type { ItemTypeDef } from './item-types';
import {
  SESSION_QUEUE_MAX,
  isSessionKindId,
  isSessionOutcome,
  nextToGo,
  outcomeFits,
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

  it('leaves out a card with no stage', () => {
    const none = item({ title: 'N' }, { type: 'work' });
    expect(
      sessionQueue({
        items: [none, a],
        types: TYPES,
        pick: { typeIds: ['work'], statuses: ['backlog'] },
      }).toGo,
    ).toEqual([a]);
  });

  it('orders cards decided at the same moment by rank', () => {
    const q = sessionQueue({
      items: [a, b],
      types: TYPES,
      pick: { typeIds: ['work'], statuses: ['backlog'] },
      decided: {
        [a.id]: { at: 5 },
        [b.id]: { at: 5 },
      },
    });
    expect(q.decided).toEqual([b, a]);
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

  it('never takes a card on into a Done-like stage: it stays', () => {
    expect(sessionTarget(card('R', 'ready'), TYPES, PLAN)).toBeNull();
    // A phase marks Done too, whatever the stage is called.
    const phases = new Map([['ready', 'done' as const]]);
    expect(sessionTarget(card('T', 'detail'), TYPES, PLAN, undefined, { phases })).toBeNull();
  });

  it('steps past a Backlog-like stage to the next open one', () => {
    const idea: ItemTypeDef = { ...work, id: 'idea', statuses: ['new', 'icebox', 'todo', 'done'] };
    const c = card('I', 'new', { type: 'idea' });
    expect(sessionTarget(c, [idea], ['new', 'icebox', 'todo', 'done'])).toBe('todo');
  });

  // docs/specs/026-plan/session-tabs.md "Bug Triage": its Next Stage also steps past a waiting stage.
  it('steps past the stages a kind passes (Bug Triage’s Needs Info) to the next open one', () => {
    const triaged: ItemTypeDef = {
      ...work,
      id: 'tb',
      statuses: ['new', 'needs-info', 'confirmed', 'wont-fix'],
    };
    const order = ['new', 'needs-info', 'confirmed', 'wont-fix'];
    const names = new Map([['needs-info', 'Needs Info']]);
    const c = card('N', 'new', { type: 'tb' });
    expect(sessionTarget(c, [triaged], order, undefined, { names })).toBe('needs-info');
    expect(sessionTarget(c, [triaged], order, undefined, { names, pass: ['needs info'] })).toBe(
      'confirmed',
    );
  });

  // The Sprint Board template lists each type's waiting stages after Done: To Do … Done, Backlog, Ready.
  describe('a type that lists its waiting stages after Done', () => {
    const story: ItemTypeDef = {
      ...work,
      id: 'story',
      statuses: ['s-todo', 's-doing', 's-review', 's-done', 's-backlog', 's-ready'],
    };
    const plan = ['s-todo', 's-doing', 's-review', 's-done', 's-backlog', 's-ready'];
    const names = new Map([
      ['s-todo', 'To Do'],
      ['s-doing', 'Doing'],
      ['s-review', 'Review'],
      ['s-done', 'Done'],
      ['s-backlog', 'Backlog'],
      ['s-ready', 'Ready'],
    ]);
    const at = (status: string) => card('S', status, { type: 'story' });

    it('commits a Ready card to the type’s first open stage, To Do', () => {
      expect(sessionTarget(at('s-ready'), [story], plan, undefined, { names })).toBe('s-todo');
    });

    it('refines a Backlog card on to Ready, the open stage after it', () => {
      expect(sessionTarget(at('s-backlog'), [story], plan, undefined, { names })).toBe('s-ready');
    });

    it('still moves work in progress on, and leaves Done alone', () => {
      expect(sessionTarget(at('s-doing'), [story], plan, undefined, { names })).toBe('s-review');
      expect(sessionTarget(at('s-review'), [story], plan, undefined, { names })).toBeNull();
    });

    it('stays when the type has no open stage at all', () => {
      const bare: ItemTypeDef = { ...story, statuses: ['s-done', 's-backlog'] };
      expect(sessionTarget(at('s-backlog'), [bare], plan, undefined, { names })).toBeNull();
    });
  });

  it('answers null with no later stage, or a stage the type does not use', () => {
    expect(sessionTarget(card('D', 'done'), TYPES, PLAN)).toBeNull();
    expect(sessionTarget(card('X', 'fixing'), TYPES, PLAN)).toBeNull();
    // A card with no stage at all has none after it.
    expect(sessionTarget(item({ title: 'N' }, { type: 'work' }), TYPES, PLAN)).toBeNull();
  });
});

describe('nextToGo', () => {
  const [a, b, c] = [card('A', 'backlog'), card('B', 'backlog'), card('C', 'backlog')];
  it('moves to the card after, else the one before, else the first, else none', () => {
    expect(nextToGo([a, b, c], b.id)).toBe(c);
    expect(nextToGo([a, b, c], c.id)).toBe(b);
    expect(nextToGo([a, b, c], 'gone')).toBe(a);
    expect(nextToGo([a, b, c])).toBe(a);
    expect(nextToGo([a, b, c], null)).toBe(a);
    expect(nextToGo([a], a.id)).toBeNull();
    expect(nextToGo([], a.id)).toBeNull();
  });
});

it('knows its session kinds and outcomes', () => {
  expect(isSessionKindId('refinement')).toBe(true);
  expect(isSessionKindId('standup')).toBe(false);
  expect(isSessionOutcome('skipped')).toBe(true);
  expect(isSessionOutcome('done')).toBe(false);
  expect(isSessionKindId('planning')).toBe(true);
  expect(isSessionOutcome('committed')).toBe(true);
  expect(isSessionKindId('triage')).toBe(true);
  expect(isSessionOutcome('accepted')).toBe(true);
  expect(isSessionOutcome('closed')).toBe(true);
});

it('offers each kind its own outcomes', () => {
  expect(outcomeFits('planning', 'committed')).toBe(true);
  expect(outcomeFits('planning', 'skipped')).toBe(true);
  expect(outcomeFits('planning', 'refined')).toBe(false);
  expect(outcomeFits('planning', 'flagged')).toBe(false);
  expect(outcomeFits('refinement', 'committed')).toBe(false);
  expect(outcomeFits('refinement', 'flagged')).toBe(true);
  expect(outcomeFits('triage', 'accepted')).toBe(true);
  expect(outcomeFits('triage', 'closed')).toBe(true);
  expect(outcomeFits('triage', 'flagged')).toBe(true);
  expect(outcomeFits('triage', 'refined')).toBe(false);
  expect(outcomeFits('refinement', 'closed')).toBe(false);
});
