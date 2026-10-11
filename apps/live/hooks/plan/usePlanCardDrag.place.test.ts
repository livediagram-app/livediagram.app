import { describe, expect, it } from 'vitest';
import { dragPlace } from './usePlanCardDrag';

// docs/specs/026-plan/items.md "Trash": a card let go on the Trash drop target is trashed, wherever the board is.
const board = { left: 0, top: 0, right: 1000, bottom: 800 };
const trash = { left: 760, top: 720, right: 900, bottom: 768 };

describe('dragPlace', () => {
  it('reads the board as inside, and past its edge as outside', () => {
    expect(dragPlace(500, 400, board, [trash])).toEqual({ outside: false, overTrash: false });
    expect(dragPlace(1100, 400, board, [trash])).toEqual({ outside: true, overTrash: false });
  });

  // A maximised board runs under the bottom-right controls, so the Trash floats over it: the drop target wins.
  it('puts a pointer on the Trash over the Trash even where the board runs under it', () => {
    expect(dragPlace(800, 740, board, [trash])).toEqual({ outside: true, overTrash: true });
  });

  it('finds the Trash off the board too, and nothing with no Trash on screen', () => {
    const off = { left: 1010, top: 700, right: 1100, bottom: 760 };
    expect(dragPlace(1050, 730, board, [off])).toEqual({ outside: true, overTrash: true });
    expect(dragPlace(800, 740, board, [])).toEqual({ outside: false, overTrash: false });
  });
});
