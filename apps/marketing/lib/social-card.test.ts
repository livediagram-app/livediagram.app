import { describe, expect, it } from 'vitest';

import { cardSubtitle, CARD_SUBTITLE_MAX } from './social-card';
import { LANDING_SECTIONS } from './landing-content';

describe('cardSubtitle', () => {
  it('keeps text that already fits', () => {
    expect(cardSubtitle('Short and sweet.')).toBe('Short and sweet.');
  });

  it('uses the first sentence when the whole text is too long', () => {
    const text = `First sentence fits. ${'Then a great deal more '.repeat(10)}`;
    expect(cardSubtitle(text)).toBe('First sentence fits.');
  });

  it('cuts at a whole word, never mid-word, and drops trailing punctuation', () => {
    const text = `Switch a tab to Plan and the work moves onto boards of cards: columns with WIP limits, swimlanes, card types with fields and more`;
    const out = cardSubtitle(text);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(CARD_SUBTITLE_MAX);
    expect(text.startsWith(out.slice(0, -1))).toBe(true);
    expect(text[out.length - 1]).toMatch(/[\s,]/);
  });

  it('cuts a single unbroken word at the limit', () => {
    expect(cardSubtitle('x'.repeat(200), 10)).toBe(`${'x'.repeat(9)}…`);
  });

  it('gives every feature category a subtitle that fits two lines and ends on a word', () => {
    for (const s of LANDING_SECTIONS) {
      const out = cardSubtitle(s.description);
      expect(out.length, s.id).toBeLessThanOrEqual(CARD_SUBTITLE_MAX);
      expect(out, s.id).toMatch(/(?:[.!?]|\w…)$/);
    }
  });
});
