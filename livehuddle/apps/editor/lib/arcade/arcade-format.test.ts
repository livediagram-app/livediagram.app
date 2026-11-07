import { describe, expect, it } from 'vitest';
import { formatArcadeScore } from './arcade-format';

describe('formatArcadeScore', () => {
  it("groups thousands with a comma, whatever the reader's locale", () => {
    expect(formatArcadeScore(1240)).toBe('1,240');
    expect(formatArcadeScore(40)).toBe('40');
  });
});
