import { describe, expect, it } from 'vitest';
import { continuousHeightNeeded } from './continuous-page-height';

// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The continuous page".
describe('continuousHeightNeeded', () => {
  const frame = { top: 72, margin: 64, height: 984 };

  it('is the margins round the writing, to a whole px', () => {
    expect(continuousHeightNeeded(frame, 500, undefined)).toBe(72 + 500 + 64);
    expect(continuousHeightNeeded(frame, 500.2, undefined)).toBe(72 + 501 + 64);
    expect(continuousHeightNeeded(frame, 30000, undefined)).toBe(72 + 30000 + 64);
  });

  it('keeps the room the notes at the foot take', () => {
    // The text must end 120 px above the frame's foot: the notes' room.
    expect(continuousHeightNeeded(frame, 500, 984 - 120)).toBe(72 + 500 + 120 + 64);
    // A limit at or past the foot leaves no notes' room.
    expect(continuousHeightNeeded(frame, 500, 984)).toBe(72 + 500 + 64);
    expect(continuousHeightNeeded(frame, 500, 1200)).toBe(72 + 500 + 64);
  });

  it('never reads a writing above its own top', () => {
    expect(continuousHeightNeeded(frame, -4, undefined)).toBe(72 + 64);
  });
});
