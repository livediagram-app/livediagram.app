import { describe, expect, it } from 'vitest';
import {
  AVATAR_SAY_MAX_CHARS,
  AVATAR_SAY_MAX_WORDS,
  clampSayText,
  countWords,
  parseAvatarSay,
  withinSayLimits,
} from './avatar-say';
import { isPresenceOpKind } from './room-messages';

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i % 10}`).join(' ');
const op = (over: Record<string, unknown> = {}) => ({
  kind: 'avatar-say',
  tabId: 't1',
  id: 'b1',
  text: 'hello there',
  x: 10,
  y: -20,
  ...over,
});

describe('countWords', () => {
  it('counts runs of non-space, whatever the spacing', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords('hi')).toBe(1);
    expect(countWords('  hi   there\nfriend ')).toBe(3);
  });
});

describe('clampSayText (docs/specs/008-canvas/avatar-mode.md "Typing a message")', () => {
  it('turns newlines into spaces', () => {
    expect(clampSayText('one\ntwo\r\nthree')).toBe('one two three');
  });

  it('keeps at most fifty words', () => {
    const clamped = clampSayText(words(60));
    expect(countWords(clamped)).toBe(AVATAR_SAY_MAX_WORDS);
    expect(clamped).toBe(words(50));
  });

  it('keeps a trailing space while under the limits', () => {
    expect(clampSayText('hello ')).toBe('hello ');
  });

  it('keeps at most three hundred characters', () => {
    expect(clampSayText('x'.repeat(400))).toHaveLength(AVATAR_SAY_MAX_CHARS);
  });

  it('says whether a draft is within both limits', () => {
    expect(withinSayLimits(words(50))).toBe(true);
    expect(withinSayLimits(words(51))).toBe(false);
    expect(withinSayLimits('x'.repeat(301))).toBe(false);
  });
});

describe('parseAvatarSay (docs/specs/008-canvas/avatar-mode.md "The wire")', () => {
  it('reads a well-formed op, trimmed', () => {
    expect(parseAvatarSay(op({ text: '  hi!  ' }))).toEqual({
      tabId: 't1',
      id: 'b1',
      text: 'hi!',
      x: 10,
      y: -20,
    });
  });

  it.each([
    ['not an object', null],
    ['a string', 'hi'],
    ['no tab', op({ tabId: undefined })],
    ['an empty id', op({ id: '' })],
    ['an over-long id', op({ id: 'x'.repeat(65) })],
    ['text not a string', op({ text: 42 })],
    ['blank text', op({ text: '   ' })],
    ['text over the characters', op({ text: 'x'.repeat(301) })],
    ['x not finite', op({ x: Number.NaN })],
    ['y missing', op({ y: undefined })],
  ])('refuses %s', (_name, value) => {
    expect(parseAvatarSay(value)).toBeNull();
  });

  it('clamps too many words that fit the characters rather than refusing them', () => {
    const parsed = parseAvatarSay(op({ text: words(70) }));
    expect(parsed && countWords(parsed.text)).toBe(50);
  });

  it('is markup-agnostic: text passes through as text', () => {
    expect(parseAvatarSay(op({ text: '<b>hi</b>' }))?.text).toBe('<b>hi</b>');
  });

  it('is a presence op: never ordered, logged or replayed', () => {
    expect(isPresenceOpKind('avatar-say')).toBe(true);
  });
});
