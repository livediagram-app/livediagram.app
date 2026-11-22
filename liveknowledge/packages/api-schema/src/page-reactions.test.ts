import { describe, expect, it } from 'vitest';
import { isReactionEmoji, REACTION_EMOJI_MAX_LENGTH } from './page-reactions';

// docs/specs/030-knowledgebase/page-reactions.md "What a reaction is": any one emoji, nothing else.
describe('isReactionEmoji', () => {
  it.each(['👏', '❤️', '👍🏽', '🎉', '👀', '🇬🇧', '👨‍👩‍👧‍👦', '1️⃣', '#⃣', '🏳️‍🌈'])('takes %s', (emoji) => {
    expect(isReactionEmoji(emoji)).toBe(true);
  });

  it.each([
    ['text', 'clap'],
    ['two emoji', '👏👏'],
    ['an emoji and text', '👏 yes'],
    ['an empty string', ''],
    ['spaces round it', ' 👏'],
    ['a digit alone', '1'],
    ['too long', '👏'.repeat(REACTION_EMOJI_MAX_LENGTH)],
  ])('refuses %s', (_, value) => {
    expect(isReactionEmoji(value)).toBe(false);
  });

  it('refuses what is not a string', () => {
    expect(isReactionEmoji(undefined)).toBe(false);
    expect(isReactionEmoji(42)).toBe(false);
  });
});
