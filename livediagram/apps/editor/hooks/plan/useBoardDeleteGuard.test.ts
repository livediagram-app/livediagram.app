import { describe, expect, it } from 'vitest';
import { boardDeleteCopy } from './useBoardDeleteGuard';

// docs/specs/026-plan/plan-board.md "Deleting a board".
describe('boardDeleteCopy', () => {
  it('names one type and its cards', () => {
    expect(boardDeleteCopy(['Task'], 3)).toEqual({
      title: 'Delete Its Cards Too?',
      message:
        'No other board shows Task. Delete the Task card type too? Its 3 cards go to the Trash, where they can be restored.',
    });
  });

  it('names several types, one card, or none', () => {
    expect(boardDeleteCopy(['Task', 'Bug', 'Idea'], 1).message).toBe(
      'No other board shows Task, Bug and Idea. Delete the Task, Bug and Idea card types too? Their 1 card goes to the Trash, where it can be restored.',
    );
    expect(boardDeleteCopy(['Task'], 0).message).toBe(
      'No other board shows Task. Delete the Task card type too? No cards use it.',
    );
  });
});
