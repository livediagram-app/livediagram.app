import { describe, expect, it } from 'vitest';
import {
  contentsSidebarClearancePx,
  readContentsSide,
  readContentsPlacement,
  withContentsPlacement,
} from './contents-placement';

describe('contents placement', () => {
  it('is the sidebar until the person minimises it', () => {
    expect(readContentsPlacement({})).toBe('sidebar');
    expect(readContentsPlacement({ contentsPlacement: 'sidebar' })).toBe('sidebar');
    expect(readContentsPlacement({ contentsPlacement: 'button' })).toBe('button');
  });

  it('reads anything unknown as the sidebar', () => {
    expect(readContentsPlacement({ contentsPlacement: 'left' as never })).toBe('sidebar');
  });

  it('writes the choice and keeps every other preference', () => {
    const next = withContentsPlacement({ drawPattern: 'grid' }, 'button');
    expect(next).toEqual({ drawPattern: 'grid', contentsPlacement: 'button' });
    expect(readContentsPlacement(withContentsPlacement(next, 'sidebar'))).toBe('sidebar');
  });
});

describe('contentsSidebarClearancePx', () => {
  it('starts the corners on its side past the sidebar, its width at the panel scale', () => {
    // Flush against the edge: the sidebar's width, then the usual 16 px inset.
    expect(contentsSidebarClearancePx(1)).toBe(236 + 16);
    expect(contentsSidebarClearancePx(1.2)).toBeCloseTo(236 * 1.2 + 16, 6);
  });
});

describe('readContentsSide', () => {
  it('is the left until the person moves it right; anything else reads as the left', () => {
    expect(readContentsSide(null)).toBe('left');
    expect(readContentsSide('right')).toBe('right');
    expect(readContentsSide('top')).toBe('left');
  });
});
