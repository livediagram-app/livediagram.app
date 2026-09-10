import { describe, expect, it } from 'vitest';
import {
  isPollStyle,
  POLL_STYLES,
  POLL_STYLE_LABEL,
  pollStyleNeedsOptions,
  pollStyleTokens,
} from './poll-style';

describe('poll styles', () => {
  it('names every style', () => {
    // A style with no label renders as an unlabelled row in both poll
    // composers, which nothing at runtime notices.
    for (const style of POLL_STYLES) {
      expect(POLL_STYLE_LABEL[style]?.trim(), style).toBeTruthy();
    }
  });

  it('accepts the known tokens and nothing else', () => {
    expect(isPollStyle('yesNo')).toBe(true);
    expect(isPollStyle('choice')).toBe(true);
    expect(isPollStyle('ranked-ballot')).toBe(false);
    expect(isPollStyle(undefined)).toBe(false);
  });

  it('reads the written list for choices only', () => {
    expect(pollStyleTokens('choice', ['Tea', 'Coffee'])).toEqual(['Tea', 'Coffee']);
    expect(pollStyleTokens('yesNo', ['Tea', 'Coffee'])).toEqual(['Yes', 'No']);
    expect(pollStyleTokens('yesNoAbstain')).toEqual(['Yes', 'No', 'Abstain']);
    expect(pollStyleTokens('rating')).toEqual(['1', '2', '3', '4', '5']);
    // Free text is counted by listing the answers, not by tallying tokens.
    expect(pollStyleTokens('text')).toEqual([]);
  });

  it('agrees with itself about which styles need a written list', () => {
    // The two are the same question asked twice: a style needs options
    // exactly when it has no tokens of its own.
    for (const style of POLL_STYLES) {
      if (style === 'text') continue;
      expect(pollStyleTokens(style).length === 0, style).toBe(pollStyleNeedsOptions(style));
    }
  });

  it('hands back a copy, so a caller cannot edit the fixed sets', () => {
    const tokens = pollStyleTokens('yesNo');
    tokens.push('Maybe');
    expect(pollStyleTokens('yesNo')).toEqual(['Yes', 'No']);
  });
});
