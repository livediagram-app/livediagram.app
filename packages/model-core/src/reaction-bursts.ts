// The bursts a Reaction Pad throws (livediagram's and livehuddle's docs/specs/009-elements/reaction-pad.md), and a
// walking character in livehuddle (its docs/specs/008-canvas/avatar-mode.md "Keyboard actions"): the five reactions,
// their names and glyphs. Each of the two products' model packages re-exports them beside the pad's own vocabulary.
// Pure data.

// Five reactions, chosen to cover distinct THINGS
// PEOPLE MEAN rather than five ways of saying "nice": celebrate a result,
// admire an idea, show warmth to a person, thank a speaker, mark the moment a
// thing shipped. A sixth would be decoration.
export const REACTIONS = ['confetti', 'sparkles', 'hearts', 'applause', 'fireworks'] as const;
export type Reaction = (typeof REACTIONS)[number];

/** Menu + hover card name for a reaction. */
export const REACTION_LABEL: Record<Reaction, string> = {
  confetti: 'Confetti',
  sparkles: 'Sparkles',
  hearts: 'Hearts',
  applause: 'Applause',
  fireworks: 'Fireworks',
};

/** The glyph the pad wears, and the particle each burst throws. */
export const REACTION_EMOJI: Record<Reaction, string> = {
  confetti: '🎉',
  sparkles: '✨',
  hearts: '💜',
  applause: '👏',
  fireworks: '🎆',
};
