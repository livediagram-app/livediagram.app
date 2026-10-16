import { describe, expect, it } from 'vitest';
import {
  contentsSidebarClearancePx,
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
  it('starts the left corners past the sidebar, its width at the panel scale', () => {
    expect(contentsSidebarClearancePx(1)).toBe(16 + 236 + 16);
    expect(contentsSidebarClearancePx(1.2)).toBeCloseTo(16 + 236 * 1.2 + 16, 6);
  });
});
