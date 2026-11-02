import { describe, expect, it } from 'vitest';
import { FONTS } from '@liveworkspace/model-core/fonts';
import { MARKER_FONT_ID } from './finish';
import { isPlannerExcludedStack, PLANNER_EXCLUDED_FONT_IDS, PLANNER_FONTS } from './planner-fonts';

const stackOf = (id: string) => FONTS.find((f) => f.id === id)!.stack;

describe('planner fonts', () => {
  it('leaves Permanent Marker out of what liveplanner offers', () => {
    expect(PLANNER_EXCLUDED_FONT_IDS).toEqual(['permanent-marker']);
    expect(PLANNER_FONTS.map((f) => f.id)).not.toContain('permanent-marker');
  });

  it('offers every other face, in catalogue order', () => {
    expect(PLANNER_FONTS).toEqual(FONTS.filter((f) => f.id !== 'permanent-marker'));
    expect(PLANNER_FONTS).toHaveLength(FONTS.length - 1);
  });

  // The other apps read the shared catalogue: it keeps every face.
  it('leaves the shared catalogue whole', () => {
    expect(FONTS.map((f) => f.id)).toEqual([
      'inter',
      'poppins',
      'nunito',
      'oswald',
      'space-grotesk',
      'lora',
      'abril-fatface',
      'roboto-slab',
      'roboto-mono',
      'caveat',
      'permanent-marker',
    ]);
  });

  it('names only faces the catalogue holds', () => {
    for (const id of PLANNER_EXCLUDED_FONT_IDS) expect(FONTS.some((f) => f.id === id)).toBe(true);
  });

  it('knows an excluded face by its stack', () => {
    expect(isPlannerExcludedStack(stackOf(MARKER_FONT_ID))).toBe(true);
    expect(isPlannerExcludedStack(stackOf('caveat'))).toBe(false);
    expect(isPlannerExcludedStack("'Inter', sans-serif")).toBe(false);
  });
});
