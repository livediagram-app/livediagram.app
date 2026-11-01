// A pass's header writes its level in small white capitals on the level's solid colour, so that colour carries white
// at AA (4.5:1). Viewer's violet-500 read 4.4:1.
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@liveworkspace/brand/colour';
import { LEVEL_PASS } from './parts';

// Tailwind's light-mode fills a pass header may use, as sRGB. Brand-700 is each product's own and AA by its theme.
const SOLIDS: Record<string, string> = {
  'bg-teal-700': '#00786f',
  'bg-violet-600': '#7f22fe',
};

describe('pass header colours', () => {
  it('carry white words at 4.5:1 or more', () => {
    for (const level of ['participate', 'view'] as const) {
      const fill = LEVEL_PASS[level].solid.split(' ')[0]!;
      expect(SOLIDS[fill], `${level}: ${fill}`).toBeDefined();
      expect(contrastRatio('#ffffff', SOLIDS[fill]!)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
