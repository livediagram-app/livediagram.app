import { describe, expect, it } from 'vitest';
import {
  NO_BOARD_CARD_REASON,
  cardTileRefusal,
  cardTypesTakenKey,
  cardTypesTakenOnTab,
} from './board-card-types';

// docs/specs/026-plan/plan-mode.md "The palette": a card tile no board on the tab takes is greyed out.
describe('the card types a tab’s boards take', () => {
  it('is none without a board, and every tile says to add one', () => {
    const taken = cardTypesTakenOnTab([]);
    expect(taken).toEqual({ kind: 'none' });
    expect(cardTileRefusal(taken, 'task', 'Task')).toBe(NO_BOARD_CARD_REASON);
    expect(cardTypesTakenOnTab([null, undefined])).toEqual({ kind: 'none' });
  });

  it('is every type when a board names none', () => {
    const taken = cardTypesTakenOnTab([{ addTypes: ['task'] }, {}]);
    expect(taken).toEqual({ kind: 'all' });
    expect(cardTileRefusal(taken, 'bug', 'Bug')).toBeNull();
  });

  it('is the union of the boards’ Card Types, refusing the rest by name', () => {
    const taken = cardTypesTakenOnTab([{ addTypes: ['task'] }, { addTypes: ['note', 'task'] }]);
    expect(cardTileRefusal(taken, 'note', 'Note')).toBeNull();
    expect(cardTileRefusal(taken, 'project', 'Project')).toBe(
      'No board on this tab takes Project cards',
    );
  });

  it('takes nothing from an Archive board', () => {
    const taken = cardTypesTakenOnTab([{ archive: true }]);
    expect(cardTileRefusal(taken, 'task', 'Task')).toBe('No board on this tab takes Task cards');
    expect(cardTypesTakenOnTab([{ archive: true }, { addTypes: ['task'] }])).toEqual({
      kind: 'some',
      types: new Set(['task']),
    });
  });

  it('keys the same reading the same way, whatever the order', () => {
    expect(cardTypesTakenKey(cardTypesTakenOnTab([{ addTypes: ['b', 'a'] }]))).toBe(
      cardTypesTakenKey(cardTypesTakenOnTab([{ addTypes: ['a'] }, { addTypes: ['b'] }])),
    );
    expect(cardTypesTakenKey({ kind: 'none' })).toBe('none');
  });
});
