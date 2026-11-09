import { describe, expect, it } from 'vitest';
import { REACTION_EMOJI, REACTION_LABEL, REACTIONS } from './reaction-bursts';

describe('reaction bursts', () => {
  it('names and draws each of the five reactions, and nothing else', () => {
    expect(REACTIONS).toEqual(['confetti', 'sparkles', 'hearts', 'applause', 'fireworks']);
    expect(Object.keys(REACTION_LABEL)).toEqual([...REACTIONS]);
    expect(Object.keys(REACTION_EMOJI)).toEqual([...REACTIONS]);
  });

  it('gives every reaction a distinct label and glyph', () => {
    expect(new Set(Object.values(REACTION_LABEL)).size).toBe(REACTIONS.length);
    expect(new Set(Object.values(REACTION_EMOJI)).size).toBe(REACTIONS.length);
  });
});
