import { describe, expect, it } from 'vitest';
import {
  isPollStyle,
  POLL_STYLES,
  POLL_STYLE_LABEL,
  pollStyleCarriesOptions,
  pollStyleNeedsOptions,
  pollStyleUsesRoster,
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

  it('sorts every style into exactly one source of answers', () => {
    // Three ways a poll can get its answers, and the pair of predicates has to
    // agree on which is which. This used to be one question asked twice —
    // "needs a written list" === "has no fixed tokens" — which held only while
    // `choice` was the sole style with its own list. `collaborators` broke the
    // equivalence: it has no fixed tokens AND is not written by the author, so
    // the two predicates now answer different questions and the split is
    // stated here in full.
    const bySource = { fixed: [], author: [], roster: [], none: [] } as Record<string, string[]>;
    for (const style of POLL_STYLES) {
      if (style === 'text') bySource.none!.push(style);
      else if (pollStyleUsesRoster(style)) bySource.roster!.push(style);
      else if (pollStyleNeedsOptions(style)) bySource.author!.push(style);
      else bySource.fixed!.push(style);
    }
    expect(bySource).toEqual({
      fixed: ['yesNo', 'yesNoAbstain', 'rating'],
      author: ['choice'],
      roster: ['collaborators'],
      none: ['text'],
    });
    // A style has fixed tokens exactly when it does NOT carry its own list,
    // free text aside — that is the invariant the old test was reaching for.
    for (const style of POLL_STYLES) {
      if (style === 'text') continue;
      expect(pollStyleTokens(style).length === 0, style).toBe(pollStyleCarriesOptions(style));
    }
  });

  it('reads the frozen roster for a collaborators poll, like a written list', () => {
    // Downstream there is no difference: both carry their answers in
    // `options`, which is what keeps one tally path serving every style.
    expect(pollStyleTokens('collaborators', ['Ariel', 'Pete'])).toEqual(['Ariel', 'Pete']);
    // Before it starts it has none, which is why sanitisePoll's minimum
    // applies to it.
    expect(pollStyleTokens('collaborators')).toEqual([]);
  });

  it('does not ask the author to type the roster', () => {
    // The composer shows an answer EDITOR on this predicate, and a roster the
    // author could edit would be a roster that disagrees with who is here.
    expect(pollStyleNeedsOptions('collaborators')).toBe(false);
    expect(pollStyleCarriesOptions('collaborators')).toBe(true);
    expect(pollStyleUsesRoster('collaborators')).toBe(true);
    expect(pollStyleUsesRoster('choice')).toBe(false);
  });

  it('hands back a copy, so a caller cannot edit the fixed sets', () => {
    const tokens = pollStyleTokens('yesNo');
    tokens.push('Maybe');
    expect(pollStyleTokens('yesNo')).toEqual(['Yes', 'No']);
  });
});
