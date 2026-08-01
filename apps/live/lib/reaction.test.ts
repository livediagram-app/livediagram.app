import { describe, expect, it } from 'vitest';

import {
  createShape,
  isReaction,
  isVotable,
  REACTION_DEFAULT,
  REACTION_EMOJI,
  REACTION_HINT,
  REACTION_LABEL,
  REACTIONS,
  SHAPE_KINDS,
  type ShapeElement,
} from '@livediagram/diagram';

// The reaction pad's model (spec/135).

describe('reaction pad', () => {
  it('is a registered shape kind', () => {
    expect(SHAPE_KINDS.has('reaction-pad')).toBe(true);
  });

  it('starts on the default reaction with a label naming the act', () => {
    const pad = createShape('reaction-pad', 0, 0) as ShapeElement;
    expect(pad.reaction).toBe(REACTION_DEFAULT);
    // The glyph carries the meaning, so the label says what pressing DOES.
    expect(pad.label).toBe('Celebrate');
  });

  it('describes all five reactions, with no gaps', () => {
    expect(REACTIONS).toHaveLength(5);
    for (const r of REACTIONS) {
      expect(REACTION_LABEL[r]).toBeTruthy();
      expect(REACTION_EMOJI[r]).toBeTruthy();
      // The hint is what separates confetti from fireworks, so it has to say
      // something rather than restate the name.
      expect(REACTION_HINT[r]).toBeTruthy();
      expect(REACTION_HINT[r].toLowerCase()).not.toBe(REACTION_LABEL[r].toLowerCase());
    }
    // Each glyph is distinct: two reactions that look identical are one.
    expect(new Set(REACTIONS.map((r) => REACTION_EMOJI[r])).size).toBe(5);
  });

  it('guards an unknown reaction name from a newer peer', () => {
    expect(isReaction('confetti')).toBe(true);
    expect(isReaction('interpretive-dance')).toBe(false);
    expect(isReaction(undefined)).toBe(false);
  });

  it('is a control, not a vote candidate', () => {
    // A dot vote turns a press into a dot, so a votable pad would mean two
    // different things depending on whether a vote happened to be running.
    expect(isVotable(createShape('reaction-pad', 0, 0))).toBe(false);
    expect(isVotable(createShape('square', 0, 0))).toBe(true);
  });
});
