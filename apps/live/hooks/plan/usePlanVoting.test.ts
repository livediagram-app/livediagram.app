import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, presetSetup } from '@livediagram/items';
import type { Element } from '@livediagram/document';
import { boardsTakeVotes } from './usePlanVoting';
import { sessionStripTools } from '@/components/canvas/SessionClusterStrip';

// docs/specs/012-collaboration/session-tools.md "The Session strip": Plan's Timer and Vote are for boards made for
// voting.
const board = (planBoard: unknown) =>
  ({ id: 'b', type: 'shape', shape: 'plan-board', planBoard }) as unknown as Element;

describe('a board made for voting', () => {
  it('is one taking a card type with a Votes field (a Retro’s Notes and Ideas)', () => {
    expect(boardsTakeVotes([board(presetSetup('retro'))], ITEM_TYPES)).toBe(true);
  });

  it('is not a Kanban of Tasks and Actions, nor an empty tab', () => {
    expect(boardsTakeVotes([board(presetSetup('kanban'))], ITEM_TYPES)).toBe(false);
    expect(boardsTakeVotes([], ITEM_TYPES)).toBe(false);
  });

  it('counts a type someone gave Votes', () => {
    const types = ITEM_TYPES.map((t) =>
      t.id === 'task' ? { ...t, fields: [...t.fields, 'votes'] } : t,
    );
    expect(boardsTakeVotes([board(presetSetup('kanban'))], types)).toBe(true);
  });
});

describe('the Session strip in Plan', () => {
  it('offers Timer and Vote only while Plan votes, and never a Poll', () => {
    expect(sessionStripTools('plan', false, true)).toEqual({
      timer: true,
      vote: true,
      poll: false,
    });
    expect(sessionStripTools('plan', false, false)).toBeNull();
    expect(sessionStripTools('facilitate', false, false)).toEqual({
      timer: true,
      vote: true,
      poll: true,
    });
  });
});
