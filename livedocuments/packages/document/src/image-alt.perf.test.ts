import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { createImage, createShape } from './factories';
import { cleanImageAlts } from './image-alt';
import type { Element } from './index';

// docs/specs/009-elements/blueprints/images.md "Performance and limits": the alt-text clean runs in the stored-element
// migrations, on every element op and every tab load, so a tab of MAX_ELEMENTS_PER_TAB-sized content has to stay
// cheap. Timed in CPU time as the fastest of several rounds, x10 for CI and coverage.
const fastest = (fn: () => void, rounds = 5, perRound = 20): number => {
  for (let i = 0; i < 5; i++) fn();
  let best = Infinity;
  for (let r = 0; r < rounds; r++) {
    const ms = cpuMsOf(() => {
      for (let i = 0; i < perRound; i++) fn();
    });
    best = Math.min(best, ms / perRound);
  }
  return best;
};

// A busy, picture-heavy tab: `count` elements, half of them pictures carrying `alt`.
const tab = (alt: string, count = 2000): Element[] =>
  Array.from({ length: count }, (_, i) =>
    i % 2
      ? { ...createImage(0, 0), id: `i${i}`, imageId: `img${i}`, alt }
      : { ...createShape('square', 0, 0), id: `s${i}` },
  );

// Measured locally (Apple silicon, under load): a clean 2,000-element tab 1.6 ms, 1,000 dirty alts that fit 0.8 ms,
// 100 over-cap alts 7 ms (the grapheme-safe cut, about 60 us each, is api-kit's clipText).
describe('alt text clean budgets', { timeout: 30_000 }, () => {
  it('an already-clean tab of 2,000 elements stays under 4 ms (x10 for CI and coverage)', () => {
    const elements = tab(
      'A chart of quarterly sales, rising from 4 to 9 million. '.repeat(4).trim(),
    );
    expect(fastest(() => cleanImageAlts(elements))).toBeLessThan(cpuBudgetMs(4));
  });

  it('1,000 dirty alts that fit the cap stay under 4 ms (x10 for CI and coverage)', () => {
    const elements = tab(' \u202EA chart\nof sales \u200B ');
    expect(fastest(() => cleanImageAlts(elements))).toBeLessThan(cpuBudgetMs(4));
  });

  // Only an agent, an import or an old file name brings one: cut once, then stored clean (the fast path above).
  it('100 alts over the cap stay under 20 ms (x10 for CI and coverage)', () => {
    const elements = tab(` \u202E${'word \n'.repeat(200)}\u200B `, 200);
    expect(fastest(() => cleanImageAlts(elements))).toBeLessThan(cpuBudgetMs(20));
  });
});
