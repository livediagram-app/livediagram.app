import { describe, expect, it } from 'vitest';
import { firstMatchingCategory, searchSettings } from './settings-search';

const CATEGORIES = [
  {
    id: 'editor',
    label: 'Editor',
    rows: [
      { key: 'guides', label: 'Alignment Guides', description: 'Snap lines.', section: 'Canvas' },
      {
        key: 'hover',
        label: 'Quick-Add on Hover',
        description: 'Opens the menu.',
        keywords: 'mouse',
      },
    ],
  },
  {
    id: 'panels',
    label: 'Panels',
    rows: [{ key: 'opacity', label: 'Panel Opacity', description: '' }],
  },
  {
    id: 'layers',
    label: 'Layers',
    parent: 'panels',
    rows: [{ key: 'preview', label: 'Show Previews', description: 'Thumbnails.' }],
  },
  {
    id: 'privacy',
    label: 'Privacy',
    rows: [{ key: 'telemetry', label: 'Usage Data', description: '' }],
  },
];

const keysFor = (query: string) =>
  searchSettings(CATEGORIES, query).categories.flatMap((c) =>
    c.rows.map((r) => (r as { key: string }).key),
  );

describe('searchSettings', () => {
  it('does nothing until the query is worth filtering on', () => {
    for (const query of ['', '   ', 'a']) {
      const result = searchSettings(CATEGORIES, query);
      expect(result.searching).toBe(false);
      expect(result.categories.flatMap((c) => c.rows)).toHaveLength(5);
    }
  });

  it('matches the label, description, keywords, section and category path', () => {
    expect(keysFor('alignment')).toEqual(['guides']);
    expect(keysFor('thumbnails')).toEqual(['preview']);
    expect(keysFor('mouse')).toEqual(['hover']);
    expect(keysFor('canvas')).toEqual(['guides']);
    // "Panels › Layers": a sub-category's rows match its parent's name.
    expect(keysFor('panels')).toEqual(['opacity', 'preview']);
    expect(keysFor('privacy')).toEqual(['telemetry']);
  });

  it('needs every term to match', () => {
    expect(keysFor('panels show')).toEqual(['preview']);
    expect(keysFor('panels zebra')).toEqual([]);
  });

  it('counts matches per category and in all', () => {
    const result = searchSettings(CATEGORIES, 'panel');
    expect(result.categories.map((c) => c.matchCount)).toEqual([0, 1, 1, 0]);
    expect(result.totalMatches).toBe(2);
  });
});

describe('firstMatchingCategory', () => {
  it('keeps the selection while it has matches, else moves to the first that has', () => {
    expect(firstMatchingCategory(searchSettings(CATEGORIES, 'panel'), 'layers')).toBe('layers');
    expect(firstMatchingCategory(searchSettings(CATEGORIES, 'panel'), 'editor')).toBe('panels');
    expect(firstMatchingCategory(searchSettings(CATEGORIES, ''), 'editor')).toBe('editor');
    expect(firstMatchingCategory(searchSettings(CATEGORIES, 'zebra'), 'editor')).toBeNull();
  });
});
