import { describe, expect, it } from 'vitest';
import { importingStepOf } from './board-scene-import';

describe('importingStepOf', () => {
  it('names the board of how many, with its images once it has any', () => {
    expect(importingStepOf({ board: 2, boards: 3, done: 1, total: 4 })).toEqual({
      step: 'importing',
      board: 2,
      boards: 3,
      images: { done: 1, total: 4 },
    });
    expect(importingStepOf({ done: 0, total: 0 })).toEqual({
      step: 'importing',
      board: 1,
      boards: 1,
    });
  });

  it('takes the board count from the caller when the report does not say', () => {
    expect(importingStepOf({ board: 1, done: 0, total: 0 }, 5).boards).toBe(5);
  });
});
