import { describe, expect, it } from 'vitest';
import { readContentsPlacement, withContentsPlacement } from './contents-placement';

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
    const next = withContentsPlacement({ alignmentGuides: true }, 'button');
    expect(next).toEqual({ alignmentGuides: true, contentsPlacement: 'button' });
    expect(readContentsPlacement(withContentsPlacement(next, 'sidebar'))).toBe('sidebar');
  });
});
