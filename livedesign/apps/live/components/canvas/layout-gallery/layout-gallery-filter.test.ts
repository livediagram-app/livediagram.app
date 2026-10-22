// docs/specs/007-editor/pages-mode.md "The layout gallery": what it shows for each chip and search.
import { describe, expect, it } from 'vitest';
import { SLIDE_LAYOUT_CATEGORIES, SLIDE_LAYOUTS, type PageLayoutId } from '@livepages/templates';
import {
  ALL_LAYOUTS,
  categoryCounts,
  gallerySections,
  matchesQuery,
  surprisePick,
  type GalleryLayout,
} from './layout-gallery-filter';

const layout = (id: string, category: string, label = id, description = ''): GalleryLayout => ({
  id: id as PageLayoutId,
  category,
  label,
  description,
});
const cats = [
  { id: 'a', label: 'Openers' },
  { id: 'b', label: 'Pictures' },
  { id: 'c', label: 'Empty' },
];
const all = [
  layout('one', 'a', 'Title Slide', 'A large title'),
  layout('two', 'b', 'Text and Picture', 'Words on the left, a picture on the right'),
  layout('three', 'b', 'Hero Picture', 'A picture filling the slide'),
];

describe('gallerySections', () => {
  it('shows every layout in its category’s section under All, an empty category left out', () => {
    const sections = gallerySections(all, cats, ALL_LAYOUTS, '');
    expect(sections.map((s) => [s.label, s.layouts.map((l) => l.id)])).toEqual([
      ['Openers', ['one']],
      ['Pictures', ['two', 'three']],
    ]);
  });

  it('shows one category as one unnamed run', () => {
    expect(gallerySections(all, cats, 'b', '')).toEqual([
      { id: null, label: null, layouts: [all[1], all[2]] },
    ]);
  });

  it('searches every category at once, every word matching name, description or category', () => {
    const ids = (q: string) =>
      gallerySections(all, cats, ALL_LAYOUTS, q).flatMap((s) => s.layouts.map((l) => l.id));
    expect(ids('picture')).toEqual(['two', 'three']);
    expect(ids('LEFT picture')).toEqual(['two']);
    expect(ids('openers')).toEqual(['one']);
    expect(ids('nothing like it')).toEqual([]);
  });

  it('searches within the chosen category only', () => {
    expect(gallerySections(all, cats, 'a', 'picture')).toEqual([]);
  });
});

describe('matchesQuery', () => {
  it('matches anything while nothing is typed', () => {
    expect(matchesQuery(all[0]!, 'Openers', '   ')).toBe(true);
  });
});

describe('categoryCounts', () => {
  it('counts All and each category, leaving out an empty one', () => {
    expect(categoryCounts(all, cats)).toEqual([
      { id: ALL_LAYOUTS, label: 'All', count: 3 },
      { id: 'a', label: 'Openers', count: 1 },
      { id: 'b', label: 'Pictures', count: 2 },
    ]);
  });

  it('covers every slide layout across the slide categories', () => {
    const counts = categoryCounts(SLIDE_LAYOUTS, SLIDE_LAYOUT_CATEGORIES);
    expect(counts[0]!.count).toBe(SLIDE_LAYOUTS.length);
    expect(counts.slice(1).reduce((n, c) => n + c.count, 0)).toBe(SLIDE_LAYOUTS.length);
  });
});

describe('surprisePick', () => {
  it('picks by the random number across what is shown', () => {
    expect(surprisePick(all, null, 0)).toBe('one');
    expect(surprisePick(all, null, 0.99)).toBe('three');
  });

  it('never lands on the last pick while there is another', () => {
    for (const r of [0, 0.4, 0.99])
      expect(surprisePick(all, 'one' as PageLayoutId, r)).not.toBe('one');
  });

  it('lands on the only layout shown, and on nothing when none is', () => {
    expect(surprisePick([all[0]!], 'one' as PageLayoutId, 0.5)).toBe('one');
    expect(surprisePick([], null, 0.5)).toBeNull();
  });
});
