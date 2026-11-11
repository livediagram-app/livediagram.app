// The Image Gallery's Show switch (liveworkspace/docs/specs/004-index/one-explorer.md "The Library and Settings").
import { describe, expect, it } from 'vitest';
import { filterGallery, isUnchecked, isUnused, UNKNOWN_USAGE } from './gallery-filter';
import type { GalleryImage, GalleryUsage, GalleryUse } from './types';

const image = (i: number): GalleryImage => ({
  id: `img-${i}`,
  name: null,
  byteSize: 1,
  width: 1,
  height: 1,
});
const use: GalleryUse = { id: 'd1', title: 'Roadmap' };

describe('filterGallery', () => {
  const images = [image(1), image(2), image(3), image(4)];
  // 1 is used, 2 and 3 checked and placed nowhere, 4 could not be checked.
  const usage: GalleryUsage = {
    uses: { 'img-1': [use], 'img-3': [] },
    unchecked: new Set(['img-4']),
  };

  it('keeps every image, the very list, on All', () => {
    expect(filterGallery(images, usage, 'all')).toBe(images);
  });

  it('keeps the images checked and placed nowhere on Unused, in order; never an unchecked one', () => {
    expect(filterGallery(images, usage, 'unused').map((i) => i.id)).toEqual(['img-2', 'img-3']);
    expect(isUnused(usage, 'img-1')).toBe(false);
    expect(isUnused(usage, 'img-2')).toBe(true);
    expect(isUnused(usage, 'img-4')).toBe(false);
    expect(isUnchecked(usage, 'img-4')).toBe(true);
    expect(isUnchecked(usage, 'img-2')).toBe(false);
  });

  it('keeps nothing on Unused when the usage could not be read at all', () => {
    expect(filterGallery(images, UNKNOWN_USAGE, 'unused')).toEqual([]);
    expect(isUnchecked(UNKNOWN_USAGE, 'img-2')).toBe(true);
  });

  it('counts a used image as used even when it is also listed unchecked', () => {
    const both: GalleryUsage = { uses: { 'img-1': [use] }, unchecked: 'all' };
    expect(isUnchecked(both, 'img-1')).toBe(false);
    expect(isUnused(both, 'img-1')).toBe(false);
  });

  it('filters a full gallery (500 images) well inside a frame', () => {
    const full = Array.from({ length: 500 }, (_, i) => image(i));
    const half: GalleryUsage = {
      uses: Object.fromEntries(full.filter((_, i) => i % 2).map((i) => [i.id, [use]])),
      unchecked: new Set(['img-0']),
    };
    // CPU time, not wall time, so a busy runner's waits don't count.
    const start = process.cpuUsage();
    for (let run = 0; run < 100; run++) filterGallery(full, half, 'unused');
    const used = process.cpuUsage(start);
    const each = (used.user + used.system) / 1000 / 100;
    expect(filterGallery(full, half, 'unused')).toHaveLength(249);
    // CPU budget, generous for a loaded CI runner: measured about 0.03 ms locally.
    expect(each).toBeLessThan(4);
  });
});
