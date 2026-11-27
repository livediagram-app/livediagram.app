// The Image Gallery's Show switch (liveworkspace/docs/specs/004-index/one-explorer.md "The Library and Settings").
import { describe, expect, it } from 'vitest';
import {
  appOfUse,
  filterGallery,
  galleryCounts,
  imageName,
  nameMatches,
  nameWords,
  isLibraryHeld,
  isUnchecked,
  isUnused,
  UNKNOWN_USAGE,
} from './gallery-filter';
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

  // Work Tracker 1128: a picture only a Library item holds was listed Unused, inviting its deletion.
  it('never keeps a picture only a Library item holds on Unused', () => {
    const held: GalleryUsage = { ...usage, library: new Set(['img-2']) };
    expect(isLibraryHeld(held, 'img-2')).toBe(true);
    expect(isUnused(held, 'img-2')).toBe(false);
    expect(filterGallery(images, held, 'unused').map((i) => i.id)).toEqual(['img-3']);
    // An older api says nothing of the Library.
    expect(isLibraryHeld(usage, 'img-2')).toBe(false);
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

// Work Tracker 1491: by name, and by the app whose items place an image.
describe('the Gallery’s name field and app chips', () => {
  const named = (i: number, name: string | null): GalleryImage => ({ ...image(i), name });
  const images = [named(1, 'Dark Logo v2.png'), named(2, 'team photo.jpg'), named(3, null)];
  const usage: GalleryUsage = {
    uses: {
      'img-1': [{ id: 'd1', title: 'Board' }],
      'img-2': [
        { id: 'p1', title: 'Brief', app: 'livedocuments' },
        { id: 'd2', title: 'Map', app: 'livediagram' },
        { id: 'p2', title: 'Notes', app: 'livedocuments', trashed: true },
      ],
    },
    unchecked: new Set<string>(),
  };

  it('keeps the images whose name holds every word, in any order and case', () => {
    expect(nameWords('  Logo   DARK ')).toEqual(['logo', 'dark']);
    expect(nameWords('')).toEqual([]);
    expect(nameMatches(images[0]!, ['logo', 'dark'])).toBe(true);
    expect(nameMatches(images[0]!, ['logo', 'zebra'])).toBe(false);
    expect(nameMatches(images[2]!, [])).toBe(true);
    expect(imageName(images[2]!)).toBe('Untitled image');
    expect(filterGallery(images, usage, 'all', { query: 'untitled' }).map((i) => i.id)).toEqual([
      'img-3',
    ]);
    // Nothing typed and All: the very list.
    expect(filterGallery(images, usage, 'all', { query: '   ' })).toBe(images);
  });

  it('keeps the images an app’s items place, the host’s for an unnamed use, and narrows with the name', () => {
    expect(appOfUse({ id: 'x', title: 'X' }, 'livedesign')).toBe('livedesign');
    expect(appOfUse({ id: 'x', title: 'X', app: 'nonsense' }, 'livedesign')).toBe('livedesign');
    const docs = filterGallery(images, usage, 'livedocuments', { host: 'livediagram' });
    expect(docs.map((i) => i.id)).toEqual(['img-2']);
    const diagram = filterGallery(images, usage, 'livediagram', { host: 'livediagram' });
    expect(diagram.map((i) => i.id)).toEqual(['img-1', 'img-2']);
    expect(
      filterGallery(images, usage, 'livediagram', { host: 'livediagram', query: 'logo' }),
    ).toHaveLength(1);
    // With no host named, an unnamed use is livediagram's.
    expect(filterGallery(images, usage, 'livediagram').map((i) => i.id)).toEqual([
      'img-1',
      'img-2',
    ]);
    expect(filterGallery(images, usage, 'unused', { query: 'photo' })).toEqual([]);
  });

  it('counts the unused and each app’s images once, an image in two apps under both, in the apps’ order', () => {
    expect(galleryCounts(images, usage, 'livediagram')).toEqual({
      unused: 1,
      apps: [
        { app: 'livediagram', count: 2 },
        { app: 'livedocuments', count: 1 },
      ],
    });
    expect(galleryCounts(images, UNKNOWN_USAGE, 'livediagram')).toEqual({ unused: 0, apps: [] });
  });

  it('counts a full gallery (500 images) well inside a frame', () => {
    const full = Array.from({ length: 500 }, (_, i) => named(i, `image ${i}.png`));
    const half: GalleryUsage = {
      uses: Object.fromEntries(
        full.filter((_, i) => i % 2).map((i) => [i.id, [use, { ...use, app: 'livedocuments' }]]),
      ),
      unchecked: new Set(),
    };
    const start = process.cpuUsage();
    for (let run = 0; run < 100; run++) {
      galleryCounts(full, half, 'livediagram');
      filterGallery(full, half, 'livedocuments', { query: 'image 4' });
    }
    const used = process.cpuUsage(start);
    const each = (used.user + used.system) / 1000 / 100;
    expect(galleryCounts(full, half, 'livediagram').apps).toEqual([
      { app: 'livediagram', count: 250 },
      { app: 'livedocuments', count: 250 },
    ]);
    // CPU budget, generous for a loaded CI runner.
    expect(each).toBeLessThan(8);
  });
});
