import { describe, expect, it } from 'vitest';
import { cornerOf } from './useArticleZoneCorner';

describe('the floating draft bar', () => {
  it('stands 24 px inside the article zone, left of a docked rail', () => {
    // A 1440 x 900 window, the zone ending where a 320 px rail starts.
    expect(cornerOf({ right: 1120, bottom: 900 }, { width: 1440, height: 900 })).toEqual({
      right: 344,
      bottom: 24,
    });
  });

  it('never leaves the window when the zone runs past it', () => {
    expect(cornerOf({ right: 1600, bottom: 2400 }, { width: 1440, height: 900 })).toEqual({
      right: 24,
      bottom: 24,
    });
  });
});
