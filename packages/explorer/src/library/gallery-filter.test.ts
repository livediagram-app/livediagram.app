// The Image Gallery's Show switch (liveworkspace/docs/specs/004-index/one-explorer.md "The Library and Settings").
import { describe, expect, it } from 'vitest';
import { filterGallery, isUnused } from './gallery-filter';
import type { GalleryImage, GalleryUse } from './types';

const image = (i: number): GalleryImage => ({
  id: `img-${i}`,
  name: null,
  byteSize: 1,
  width: 1,
  height: 1,
});
const use: GalleryUse = { id: 'd1', title: 'Roadmap' };

describe('filterGallery', () => {
  const images = [image(1), image(2), image(3)];
  const usage = { 'img-1': [use], 'img-3': [] };

  it('keeps every image, the very list, on All', () => {
    expect(filterGallery(images, usage, 'all')).toBe(images);
  });

  it('keeps the images nothing places on Unused, in order (no entry, or an empty one)', () => {
    expect(filterGallery(images, usage, 'unused').map((i) => i.id)).toEqual(['img-2', 'img-3']);
    expect(isUnused(usage, 'img-1')).toBe(false);
    expect(isUnused(usage, 'img-2')).toBe(true);
  });

  it('filters a full gallery (500 images) well inside a frame', () => {
    const full = Array.from({ length: 500 }, (_, i) => image(i));
    const half = Object.fromEntries(full.filter((_, i) => i % 2).map((i) => [i.id, [use]]));
    // CPU time, not wall time, so a busy runner's waits don't count.
    const start = process.cpuUsage();
    for (let run = 0; run < 100; run++) filterGallery(full, half, 'unused');
    const used = process.cpuUsage(start);
    const each = (used.user + used.system) / 1000 / 100;
    expect(filterGallery(full, half, 'unused')).toHaveLength(250);
    // CPU budget, generous for a loaded CI runner: measured about 0.03 ms locally.
    expect(each).toBeLessThan(4);
  });
});
