// Send to Plan's chips kept live (liveworkspace/docs/specs/004-index/send-to-plan.md "The chip"): a burst of changes to
// sent cards told to the index once, with each card's column and done state; a card in the Trash or deleted told
// gone; a card that was never sent costing nothing.
import { DatabaseSync } from 'node:sqlite';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import type { PlanCardChange } from '@liveworkspace/index-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SentCards } from './sent-cards';

let db: DatabaseSync;

beforeEach(() => {
  vi.useFakeTimers();
  db = new DatabaseSync(':memory:');
});
afterEach(() => vi.useRealTimers());

const card = (id: string, status: string, sent = true) => ({
  id,
  fields: { title: `Card ${id}`, status, ...(sent ? { sentFrom: '{}' } : {}) },
});

const items = (upserts: unknown[], removed: string[] = []) => ({
  kind: 'items',
  upserts,
  removed,
  rev: 1,
});

function cards(planId: string | null = 'P', places = true) {
  const told = vi.fn(async (_plan: string, _cards: readonly PlanCardChange[]) => ({ told: 1 }));
  const store = new SentCards(
    nodeItemSql(db),
    () => planId,
    async () =>
      places
        ? {
            columnOf: (s) => ({ todo: 'To Do', done: 'Done' })[s as 'todo'] ?? '',
            isDone: (s) => s === 'done',
          }
        : null,
    () => ({ planCardsChanged: told }),
  );
  return { store, told };
}

describe('sent cards', () => {
  it('tells a burst once, each card at its newest, with its column and done state', async () => {
    const { store, told } = cards();
    store.changed(items([card('a', 'todo'), card('b', 'todo')]));
    store.changed(items([card('a', 'done'), card('x', 'todo', false)]));
    expect(told).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(told).toHaveBeenCalledTimes(1);
    expect(told).toHaveBeenCalledWith('P', [
      { id: 'a', title: 'Card a', column: 'Done', done: true, gone: false },
      { id: 'b', title: 'Card b', column: 'To Do', done: false, gone: false },
    ]);
  });

  it('tells a sent card deleted or in the Trash as gone, and never one that was not sent', async () => {
    const { store, told } = cards();
    store.changed(items([card('a', 'todo'), card('t', 'trash')]));
    await vi.runAllTimersAsync();
    told.mockClear();
    store.changed(items([], ['a', 'never']));
    await vi.runAllTimersAsync();
    expect(told).toHaveBeenCalledWith('P', [
      { id: 'a', title: '', column: '', done: false, gone: true },
    ]);
    told.mockClear();
    // Forgotten once gone: deleting it again tells nothing.
    store.changed(items([], ['a']));
    store.changed({ kind: 'tab-meta' });
    store.changed(items([card('y', 'todo', false)]));
    await vi.runAllTimersAsync();
    expect(told).not.toHaveBeenCalled();
  });

  it('tells nothing without a plan or its board, and only logs a failed tell', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const none = cards(null);
    none.store.changed(items([card('a', 'todo')]));
    await vi.runAllTimersAsync();
    expect(none.told).not.toHaveBeenCalled();
    const unread = cards('P', false);
    unread.store.changed(items([card('a', 'todo')]));
    await vi.runAllTimersAsync();
    expect(unread.told).not.toHaveBeenCalled();
    const failing = cards();
    failing.told.mockRejectedValueOnce(new Error('down'));
    failing.store.changed(items([card('a', 'todo')]));
    await vi.runAllTimersAsync();
    expect(console.warn).toHaveBeenCalled();
    await failing.store.flush();
  });
});
