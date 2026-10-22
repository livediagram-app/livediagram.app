import { describe, expect, it } from 'vitest';

import { cardSubtitle, CARD_SUBTITLE_MAX } from '@livepages/ui';
import { LANDING_SECTIONS } from './landing-content';

// cardSubtitle itself is tested with the card in @livepages/ui (src/social-card.test.ts); this holds
// marketing's own copy to it.
describe('feature category card subtitles', () => {
  it('gives every feature category a subtitle that fits two lines and ends on a word', () => {
    for (const s of LANDING_SECTIONS) {
      const out = cardSubtitle(s.description);
      expect(out.length, s.id).toBeLessThanOrEqual(CARD_SUBTITLE_MAX);
      expect(out, s.id).toMatch(/(?:[.!?]|\w…)$/);
    }
  });
});
