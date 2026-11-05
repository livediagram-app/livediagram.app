import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { jukeboxAt } from './useSocialPieces';

// docs/specs/009-elements/social-pieces.md "Jukebox": the area check runs on every step your character takes. Each
// jukebox's room is found once per board, so a step costs one look-up per jukebox, however many rooms there are.
const ROOMS = Array.from({ length: 200 }, (_, i) => ({
  id: `r${i}`,
  x: (i % 20) * 600,
  y: Math.floor(i / 20) * 400,
  width: 480,
  height: 320,
}));
const JUKEBOXES = Array.from({ length: 50 }, (_, i) => ({
  id: `j${i}`,
  x: (i % 20) * 600 + 100,
  y: Math.floor(i / 20) * 400 + 100,
  width: 72,
  height: 112,
  source: 'https://example.com/a.mp3',
}));
const STEPS = 1000;
// About 10 µs a step here; before the cache it was about 420 µs, so 1000 steps took over 400 ms.
const BUDGET_MS = 60;

describe('the jukebox area check', () => {
  it(`walks ${STEPS} steps among 50 jukeboxes and 200 rooms inside ${cpuBudgetMs(BUDGET_MS)} ms`, () => {
    const walk = () => {
      for (let s = 0; s < STEPS; s++)
        jukeboxAt({ x: (s * 13) % 12000, y: (s * 7) % 4000 }, JUKEBOXES, ROOMS);
    };
    walk();
    const best = Math.min(...[0, 1, 2].map(() => cpuMsOf(walk)));
    expect(best).toBeLessThan(cpuBudgetMs(BUDGET_MS));
  });
});
