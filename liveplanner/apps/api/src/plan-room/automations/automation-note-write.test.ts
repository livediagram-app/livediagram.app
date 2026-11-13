// Blueprint automations.md "Worked out at run time": the plan's cards a wake holds for its branches (`cardsNow`) take a
// run's own write in place when it is the one write since they were read, and stay at their rev otherwise, so a
// write from anywhere else makes the next branch read every card afresh.
import { describe, expect, it } from 'vitest';
import type { Item } from '@liveplanner/items';
import { noteWrite, type RunState } from './automation-runner';

const PERSON = { id: 'p-sam', name: 'Sam Lee', color: '#2563eb' };
const card = (id: string, title: string, rev = 1): Item => ({
  id,
  type: 'task',
  key: Number(id.slice(1)),
  rank: 'i',
  fields: { title },
  rev,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

const held = (rev: number, items: Item[]): RunState => ({
  plan: null,
  today: 0,
  planCards: { rev, items },
});

describe('noteWrite', () => {
  it('puts a run’s write landed one rev past the cards held into them, and a new card at the end', () => {
    const state = held(10, [card('c1', 'One'), card('c2', 'Two')]);
    noteWrite(state, [card('c2', 'Two, edited', 2)], 11);
    noteWrite(state, [card('c3', 'Three')], 12);
    expect(state.planCards?.rev).toBe(12);
    expect(state.planCards?.items.map((i) => i.fields['title'])).toEqual([
      'One',
      'Two, edited',
      'Three',
    ]);
  });

  it('leaves the cards at their rev when another write came between, so the next read is afresh', () => {
    const state = held(10, [card('c1', 'One')]);
    // Rev 11 was someone else's: this write landed at 12.
    noteWrite(state, [card('c1', 'Mine', 2)], 12);
    expect(state.planCards).toEqual({ rev: 10, items: [card('c1', 'One')] });
  });

  it('does nothing while no cards are held', () => {
    const state: RunState = { plan: null, today: 0 };
    noteWrite(state, [card('c1', 'One')], 1);
    expect(state.planCards).toBeUndefined();
  });
});
