// Write It Up's trigger (docs/specs/013-workspace/suggestions.md): the person's own status writes noted cheaply; a
// done card with a decision, or a done Milestone, found when idle.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveplanner/items';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  doneWriteUpCard,
  hasDecision,
  noteStatusWrite,
  onStatusWrite,
  resetWriteUpWatchForTests,
  WATCH_MAX,
  writeUpCardBody,
} from './write-up-trigger';

afterEach(() => resetWriteUpWatchForTests());

const card = (id: string, status: string, description = '', type = 'task'): Item =>
  ({ id, type, fields: { title: `Card ${id}`, status, description } }) as unknown as Item;

const isDone = (status: string | undefined) => status === 'done';

describe('hasDecision', () => {
  it('reads a decision in the words', () => {
    for (const text of [
      'We decided to ship on Fridays.',
      'Decision: Postgres.',
      'Agreed with the vendor',
      "We're going with option B",
      'We will move the launch',
      'Opted for the cheaper plan',
      'Resolved: keep the old logo',
    ])
      expect(hasDecision(text)).toBe(true);
  });

  it('reads none in ordinary words', () => {
    for (const text of [
      '',
      'Fix the login bug',
      'Go to the shop',
      'willing to help',
      'Decimal places',
    ])
      expect(hasDecision(text)).toBe(false);
  });

  it('is linear on a long description (measured)', () => {
    const text = 'the quick brown fox jumps over the lazy dog '.repeat(2_000);
    const ms = cpuMsOf(() => hasDecision(text));
    expect(ms).toBeLessThan(cpuBudgetMs(20));
  });
});

describe('the watch', () => {
  it('notes moves, many moves and status patches, never undos or other writes, and tells who listens', () => {
    const heard = vi.fn();
    onStatusWrite(heard);
    noteStatusWrite({ kind: 'move', id: 'a', move: { status: 'done' } });
    noteStatusWrite({
      kind: 'moves',
      moves: [
        { id: 'b', move: { status: 'done' } },
        { id: 'x', move: {} },
      ],
    });
    noteStatusWrite({ kind: 'patch', id: 'c', patch: { set: { status: 'done' } } });
    noteStatusWrite({ kind: 'move', id: 'u', move: { status: 'done' }, undo: true });
    noteStatusWrite({ kind: 'patch', id: 'p', patch: { set: { title: 'T' } } });
    noteStatusWrite({ kind: 'delete', id: 'd' });
    expect(heard).toHaveBeenCalledTimes(3);
    const items = new Map(
      ['a', 'b', 'c', 'u', 'p', 'x'].map((id) => [id, card(id, 'done', 'We decided')]),
    );
    const order: string[] = [];
    let found = doneWriteUpCard(items, isDone);
    while (found) {
      order.push(found.item.id);
      items.delete(found.item.id);
      found = doneWriteUpCard(items, isDone);
    }
    expect(order).toEqual(['c', 'b', 'a']);
  });

  it('finds a done card with a decision or a done Milestone, not one still open or without one', () => {
    noteStatusWrite({ kind: 'move', id: 'plain', move: { status: 'done' } });
    noteStatusWrite({ kind: 'move', id: 'open', move: { status: 'doing' } });
    const items = new Map([
      ['plain', card('plain', 'done', 'Fixed the bug')],
      ['open', card('open', 'doing', 'We decided')],
    ]);
    expect(doneWriteUpCard(items, isDone)).toBeNull();
    noteStatusWrite({ kind: 'move', id: 'm', move: { status: 'done' } });
    items.set('m', card('m', 'done', '', 'milestone'));
    expect(doneWriteUpCard(items, isDone)).toMatchObject({ item: { id: 'm' }, milestone: true });
  });

  it('leaves practice cards and gone cards out, and keeps at most WATCH_MAX', () => {
    noteStatusWrite({ kind: 'move', id: 'practice', move: { status: 'done' } });
    const items = new Map([['practice', card('practice', 'done', 'We decided')]]);
    expect(doneWriteUpCard(items, isDone, new Set(['practice']))).toBeNull();
    for (let i = 0; i <= WATCH_MAX; i++)
      noteStatusWrite({ kind: 'move', id: `c${i}`, move: { status: 'done' } });
    noteStatusWrite({ kind: 'move', id: 'c1', move: { status: 'done' } });
    const all = new Map(
      Array.from({ length: WATCH_MAX + 1 }, (_, i) => [`c${i}`, card(`c${i}`, 'done', 'agreed')]),
    );
    expect(doneWriteUpCard(all, isDone)?.item.id).toBe('c1');
    all.delete('c1');
    // c0 was the oldest and fell out of the watch.
    const seen: string[] = [];
    let next = doneWriteUpCard(all, isDone);
    while (next) {
      seen.push(next.item.id);
      all.delete(next.item.id);
      next = doneWriteUpCard(all, isDone);
    }
    expect(seen).not.toContain('c0');
  });

  it("takes a card's description as the page's body", () => {
    expect(writeUpCardBody(card('a', 'done', '  We decided.  '))).toBe('We decided.');
    expect(writeUpCardBody({ id: 'b', fields: {} } as unknown as Item)).toBe('');
  });
});
