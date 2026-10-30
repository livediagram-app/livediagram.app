import { describe, expect, it } from 'vitest';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { planBoardBodyCursor, planCardCursor } from './board-cursors';

// docs/specs/026-plan/plan-board.md "Working on a board", Cursors: a hand only where a press picks something up.
describe('planCardCursor', () => {
  // docs/specs/013-workspace/share-roles.md: an Editor and a Participant move cards; a Viewer only opens them.
  it.each([
    ['edit', 'grab'],
    ['participate', 'grab'],
    ['view', 'pointer'],
  ] as const)('a %s link sees %s over a card in Plan mode', (level, cursor) => {
    const can = resolveEditorCapabilities({ level, adderKey: 'k' });
    expect(planCardCursor(true, can.planCards)).toBe(cursor);
  });

  it('leaves the canvas cursor alone out of Plan mode', () => {
    expect(planCardCursor(false, true)).toBeUndefined();
  });
});

describe('planBoardBodyCursor', () => {
  it('shows the arrow between the cards in Plan mode, for every role, and nothing of its own outside it', () => {
    expect(planBoardBodyCursor(true)).toBe('default');
    expect(planBoardBodyCursor(false)).toBeUndefined();
  });
});
