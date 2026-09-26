import { describe, expect, it } from 'vitest';
import {
  applyQaAction,
  parseQaAction,
  preferNewerQa,
  preferNewerQaAll,
  qaView,
  qaVoterId,
  withQaState,
  type QaActor,
  type QaNote,
} from './qa-board';
import { createShape } from './index';
import { isValidTab } from './validate';

const actor = (voterId = 'v1', now = 1000): QaActor => ({
  voterId,
  author: { name: 'Sam', color: '#f00' },
  now,
});

const note = (id: string, voters: string[] = [], extra: Partial<QaNote> = {}): QaNote => ({
  id,
  text: id,
  at: Number(id.replace(/\D/g, '')) || 0,
  voters,
  ...extra,
});

describe('applyQaAction', () => {
  it('adds a named note, stamped with the actor', () => {
    const out = applyQaAction([], { type: 'add', id: 'n1', text: 'Hi', anonymous: false }, actor());
    expect(out).toEqual([
      { id: 'n1', text: 'Hi', at: 1000, voters: [], author: { name: 'Sam', color: '#f00' } },
    ]);
  });

  it('adds an anonymous note with no author at all', () => {
    const [n] = applyQaAction([], { type: 'add', id: 'n1', text: 'Hi', anonymous: true }, actor());
    expect(n).not.toHaveProperty('author');
  });

  it('treats a retried add as the same note', () => {
    const once = applyQaAction([], { type: 'add', id: 'n1', text: 'Hi', anonymous: true }, actor());
    const twice = applyQaAction(
      once,
      { type: 'add', id: 'n1', text: 'Hi', anonymous: true },
      actor(),
    );
    expect(twice).toBe(once);
  });

  it('allows one vote per voter and sets rather than toggles', () => {
    const notes = [note('n1')];
    const on = applyQaAction(notes, { type: 'vote', noteId: 'n1', on: true }, actor('a'));
    expect(on[0]!.voters).toEqual(['a']);
    // A retried "on" is a no-op, not a withdrawal.
    expect(applyQaAction(on, { type: 'vote', noteId: 'n1', on: true }, actor('a'))).toBe(on);
    const both = applyQaAction(on, { type: 'vote', noteId: 'n1', on: true }, actor('b'));
    expect(both[0]!.voters).toEqual(['a', 'b']);
    const off = applyQaAction(both, { type: 'vote', noteId: 'n1', on: false }, actor('a'));
    expect(off[0]!.voters).toEqual(['b']);
  });

  it('freezes the count on a done note', () => {
    const notes = [note('n1', [], { state: 'done', doneAt: 5 })];
    expect(applyQaAction(notes, { type: 'vote', noteId: 'n1', on: true }, actor())).toBe(notes);
  });

  it('keeps one spotlight, returning the previous note to the queue', () => {
    const notes = [note('n1', [], { state: 'discussing' }), note('n2')];
    const out = applyQaAction(notes, { type: 'discuss', noteId: 'n2' }, actor());
    expect(out[0]!.state).toBeUndefined();
    expect(out[1]!.state).toBe('discussing');
    const cleared = applyQaAction(out, { type: 'discuss', noteId: null }, actor());
    expect(cleared.every((n) => n.state === undefined)).toBe(true);
  });

  it('closes, reopens and removes', () => {
    const notes = [note('n1'), note('n2')];
    const done = applyQaAction(notes, { type: 'done', noteId: 'n1' }, actor('v', 42));
    expect(done[0]).toMatchObject({ state: 'done', doneAt: 42 });
    const reopened = applyQaAction(done, { type: 'reopen', noteId: 'n1' }, actor());
    expect(reopened[0]).not.toHaveProperty('state');
    expect(reopened[0]).not.toHaveProperty('doneAt');
    expect(applyQaAction(notes, { type: 'remove', noteId: 'n2' }, actor())).toEqual([note('n1')]);
    expect(applyQaAction(notes, { type: 'clear' }, actor())).toEqual([]);
  });

  it('returns the same array for an action on a missing note', () => {
    const notes = [note('n1')];
    expect(applyQaAction(notes, { type: 'done', noteId: 'gone' }, actor())).toBe(notes);
  });
});

describe('parseQaAction', () => {
  it('accepts the vocabulary and rejects the malformed', () => {
    expect(parseQaAction({ type: 'add', id: 'x', text: '  q  ', anonymous: 1 })).toEqual({
      type: 'add',
      id: 'x',
      text: 'q',
      anonymous: false,
    });
    expect(parseQaAction({ type: 'add', id: 'x', text: '   ' })).toBeNull();
    expect(parseQaAction({ type: 'add', id: 'x', text: 'a'.repeat(281) })).toBeNull();
    expect(parseQaAction({ type: 'vote', noteId: 'n' })).toBeNull();
    expect(parseQaAction({ type: 'discuss', noteId: null })).toEqual({
      type: 'discuss',
      noteId: null,
    });
    expect(parseQaAction({ type: 'nuke' })).toBeNull();
    expect(parseQaAction(null)).toBeNull();
  });
});

describe('qaView', () => {
  it('sorts the queue by votes, oldest first on a tie, and splits the spotlight and drawer', () => {
    const view = qaView([
      note('n1', ['a']),
      note('n2', ['a', 'b']),
      note('n3', ['c']),
      note('n4', [], { state: 'discussing' }),
      note('n5', [], { state: 'done', doneAt: 1 }),
      note('n6', [], { state: 'done', doneAt: 9 }),
    ]);
    expect(view.discussing?.id).toBe('n4');
    expect(view.queue.map((n) => n.id)).toEqual(['n2', 'n1', 'n3']);
    expect(view.done.map((n) => n.id)).toEqual(['n6', 'n5']);
  });
});

describe('qaVoterId', () => {
  it('is stable, per board, and does not contain the owner id', async () => {
    const a = await qaVoterId('owner-1', 'board-1');
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(await qaVoterId('owner-1', 'board-1')).toBe(a);
    expect(await qaVoterId('owner-1', 'board-2')).not.toBe(a);
    expect(await qaVoterId('owner-2', 'board-1')).not.toBe(a);
  });
});

describe('preferNewerQa', () => {
  const board = (rev: number, notes: QaNote[]) => ({
    ...createShape('qa-board', 0, 0),
    id: 'b',
    qaRev: rev,
    qaNotes: notes,
  });

  it('keeps the newer board state when a stale copy lands', () => {
    const current = board(3, [note('n1', ['a'])]);
    const stale = { ...board(2, []), x: 50 };
    const merged = preferNewerQa(current, stale);
    expect(merged.x).toBe(50);
    expect(merged.qaNotes).toBe(current.qaNotes);
    expect(merged.qaRev).toBe(3);
  });

  it('takes a strictly newer incoming copy whole', () => {
    const incoming = board(4, [note('n2')]);
    expect(preferNewerQa(board(3, []), incoming)).toBe(incoming);
  });

  it('keeps the incoming object on a tie with equal content', () => {
    const incoming = board(3, [note('n1')]);
    expect(preferNewerQa(board(3, [note('n1')]), incoming)).toBe(incoming);
  });

  it('keeps the current notes on a tie with different content (an optimistic copy)', () => {
    const current = board(3, [note('n1')]);
    expect(preferNewerQa(current, board(3, [note('n1'), note('n9')])).qaNotes).toBe(
      current.qaNotes,
    );
  });

  it('leaves non-board lists untouched', () => {
    const els = [createShape('square', 0, 0)];
    expect(preferNewerQaAll([], els)).toBe(els);
  });

  it('withQaState only moves forward', () => {
    const el = board(3, []);
    expect(withQaState(el, [note('n1')], 3)).toBe(el);
    expect(withQaState(el, [note('n1')], 4).qaNotes).toHaveLength(1);
  });
});

describe('validation', () => {
  it('accepts a board and rejects a malformed note', () => {
    const el = {
      ...createShape('qa-board', 0, 0),
      qaRev: 1,
      qaNotes: [note('n1', ['a'], { author: { name: 'S', color: '#000' } })],
    };
    const tab = { id: 't', name: 'T', elements: [el] };
    expect(isValidTab(tab)).toBe(true);
    const bad = { ...tab, elements: [{ ...el, qaNotes: [{ id: 'n', text: 1 }] }] };
    expect(isValidTab(bad)).toBe(false);
  });
});
