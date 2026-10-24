import { describe, expect, it } from 'vitest';
import { SHELF_SCROLL_GAP, SHELF_SCROLL_TOP_INSET, shelfScrollTarget } from './shelf-scroll';

// docs/specs/019-marketing/marketing-site.md "Template gallery": an opened shelf out of view is
// scrolled to, one in view is left be.
const VH = 800;

describe('shelfScrollTarget', () => {
  it('leaves a shelf that shows whole be', () => {
    expect(shelfScrollTarget({ top: 200, bottom: 600 }, VH, 3000)).toBeNull();
  });

  it('scrolls up to a shelf above the screen, its heading clear of the header', () => {
    expect(shelfScrollTarget({ top: -500, bottom: -100 }, VH, 3000)).toBe(
      3000 - 500 - SHELF_SCROLL_TOP_INSET - SHELF_SCROLL_GAP,
    );
  });

  it('scrolls to a shelf hidden under the header, or cut off at the bottom', () => {
    expect(shelfScrollTarget({ top: 40, bottom: 440 }, VH, 1000)).not.toBeNull();
    expect(shelfScrollTarget({ top: 600, bottom: 1000 }, VH, 1000)).toBe(
      1000 + 600 - SHELF_SCROLL_TOP_INSET - SHELF_SCROLL_GAP,
    );
  });

  it('counts a shelf taller than the screen as shown once its top shows', () => {
    expect(shelfScrollTarget({ top: 100, bottom: 1400 }, VH, 0)).toBeNull();
    expect(shelfScrollTarget({ top: -300, bottom: 1000 }, VH, 2000)).not.toBeNull();
  });

  it('never scrolls above the page top', () => {
    expect(shelfScrollTarget({ top: -50, bottom: 300 }, VH, 20)).toBe(0);
  });
});
