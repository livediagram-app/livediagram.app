import { describe, expect, it } from 'vitest';
import type { ArcadeScore } from '@livehuddle/document';
import { ARCADE_RUN_MS_MAX } from '@livehuddle/document';
import { arcadePlaceLine, arcadeScoreFor } from './arcade-post';

// docs/specs/009-elements/social-pieces.md "High Scores": what a finished run posts, and where it lands.

const who = { key: 'k-me', name: 'Ann', now: 1_000, id: 'new' };
const row = (id: string, score: number, at = 0): ArcadeScore => ({
  id,
  name: 'Bo',
  score,
  ms: 600_000,
  by: 'k-bo',
  at,
});

describe('arcadeScoreFor', () => {
  it('posts a run that scored, signed with your key, at the place it takes', () => {
    const post = arcadeScoreFor({ score: 120, ms: 30_000 }, [row('a', 500), row('b', 50)], who);
    expect(post).toEqual({
      score: { id: 'new', name: 'Ann', score: 120, ms: 30_000, by: 'k-me', at: 1_000 },
      place: 2,
    });
  });

  it('takes the top of an empty table', () => {
    expect(arcadeScoreFor({ score: 10, ms: 1_000 }, undefined, who)?.place).toBe(1);
  });

  it('posts nothing for a run that scored nothing or played no time, or with no key', () => {
    expect(arcadeScoreFor({ score: 0, ms: 9_000 }, [], who)).toBeNull();
    expect(arcadeScoreFor({ score: 10, ms: 0 }, [], who)).toBeNull();
    expect(arcadeScoreFor({ score: 10, ms: 9_000 }, [], { ...who, key: null })).toBeNull();
  });

  it('announces no place for a score every screen would drop', () => {
    expect(arcadeScoreFor({ score: 10, ms: ARCADE_RUN_MS_MAX + 1 }, [], who)).toBeNull();
    expect(arcadeScoreFor({ score: 10, ms: 9_000 }, [], { ...who, name: '   ' })).toBeNull();
  });

  it('posts nothing that the table’s ten all beat, and a tie stays below the earlier score', () => {
    const full = Array.from({ length: 10 }, (_, i) => row(`r${i}`, 100 + i));
    expect(arcadeScoreFor({ score: 100, ms: 30_000 }, full, who)).toBeNull();
    expect(arcadeScoreFor({ score: 101, ms: 30_000 }, full, who)?.place).toBe(10);
  });
});

describe('arcadePlaceLine', () => {
  it('cheers the top and names any other place', () => {
    expect(arcadePlaceLine(1)).toBe('New High Score!');
    expect(arcadePlaceLine(4)).toBe('You Placed #4');
  });
});
