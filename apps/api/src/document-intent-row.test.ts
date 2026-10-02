import { describe, expect, it } from 'vitest';
import { readBoardType, readOpensIn } from './document-intent-row';

// The recorded creation intent as stored text (docs/specs/013-workspace/default-folders.md "Recorded
// intent"): an editor mode or a board type reads as itself; anything else, null included, is unknown.

describe('readOpensIn', () => {
  it.each(['diagram', 'draw'] as const)('reads %s', (mode) => {
    expect(readOpensIn(mode)).toBe(mode);
  });

  it.each([null, 'whiteboard', 'pixel', ''])('reads %j as unknown', (value) => {
    expect(readOpensIn(value)).toBeNull();
  });
});

describe('readBoardType', () => {
  it.each(['event-storming', 'retrospective', 'kanban'] as const)('reads %s', (board) => {
    expect(readBoardType(board)).toBe(board);
  });

  it.each([null, 'mindmap', ''])('reads %j as none', (value) => {
    expect(readBoardType(value)).toBeNull();
  });
});
