import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { applyDeckSlidePatch, deckSlidePatch } from './slide-deck-patch';
import { parseStoredPresentation, type Slide } from './slide-deck';
import { withNoteCards } from './slide-notes';

// The unload save of a large deck (docs/specs/012-collaboration/speaker-note-cards.md "Saving") runs while the page
// goes: parsing the deck and its base, and comparing them slide by slide, must stay well inside a pagehide handler.

const slideOf = (i: number, text: string): Slide =>
  withNoteCards(
    { id: `s${i}`, tabId: 't', elementIds: [] },
    Array.from({ length: 20 }, (_, c) => ({ id: `c${c}`, text })),
  );

describe('the changed-slides patch at the deck cap', () => {
  it('makes and applies a patch of a 256 KB deck within budget', () => {
    // 64 slides of 20 cards, mirrored: about 256 KB each way.
    const base = JSON.stringify({
      decks: [{ slides: Array.from({ length: 64 }, (_, i) => slideOf(i, 'n'.repeat(95))) }],
    });
    const stored = parseStoredPresentation(base)!;
    const mine = JSON.stringify({
      decks: [
        {
          slides: stored.decks[0]!.slides.map((s, i) =>
            i === 30 ? slideOf(i, 'm'.repeat(95)) : s,
          ),
        },
      ],
    });
    expect(base.length).toBeGreaterThan(200 * 1024);
    const run = () => {
      const patch = deckSlidePatch(parseStoredPresentation(mine), parseStoredPresentation(base))!;
      expect(patch.slides).toHaveLength(1);
      applyDeckSlidePatch(stored, patch);
    };
    run();
    let best = Infinity;
    for (let pass = 0; pass < 3; pass++) best = Math.min(best, cpuMsOf(run));
    // A few milliseconds here.
    expect(best).toBeLessThan(cpuBudgetMs(60));
  });
});
