import { describe, expect, it } from 'vitest';
import { PAGE_ARROW_STEP, pageScrollOf } from './page-keys';

// docs/specs/030-knowledgebase/page-surface.md "A reading column": Page Up and Down, Home and End behave as on a
// web page.
describe('pageScrollOf', () => {
  it('moves most of a window on Page Down, Page Up and Space', () => {
    expect(pageScrollOf('PageDown', false, 1000)).toEqual({ by: 880 });
    expect(pageScrollOf('PageUp', false, 1000)).toEqual({ by: -880 });
    expect(pageScrollOf(' ', false, 1000)).toEqual({ by: 880 });
    expect(pageScrollOf(' ', true, 1000)).toEqual({ by: -880 });
  });

  it('goes to the top on Home and the foot on End', () => {
    expect(pageScrollOf('Home', false, 1000)).toEqual({ to: 'top' });
    expect(pageScrollOf('End', false, 1000)).toEqual({ to: 'bottom' });
  });

  it('moves a few lines on an arrow, and never less than that on a tiny window', () => {
    expect(pageScrollOf('ArrowDown', false, 1000)).toEqual({ by: PAGE_ARROW_STEP });
    expect(pageScrollOf('ArrowUp', false, 1000)).toEqual({ by: -PAGE_ARROW_STEP });
    expect(pageScrollOf('PageDown', false, 10)).toEqual({ by: PAGE_ARROW_STEP });
  });

  it('leaves every other key alone', () => {
    for (const key of ['a', 'Enter', 'Tab', 'ArrowLeft', 'ArrowRight', 'Escape'])
      expect(pageScrollOf(key, false, 1000)).toBeNull();
  });
});
