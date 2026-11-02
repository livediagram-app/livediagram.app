import { describe, expect, it } from 'vitest';
import {
  EXTRA_BLANK_TEMPLATES,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  popularKindsFor,
  templateCategory,
} from '@livedesign/templates';
import { TEMPLATE_STARTS } from './start-template-items';

// docs/specs/007-editor/start-diagramming.md
describe('the Pages template start', () => {
  const start = TEMPLATE_STARTS.pages;
  const listed = TEMPLATES.filter(
    (t) => !t.hidden && t.kind !== 'blank-illustration' && t.kind !== 'blank',
  ).map((t) => t.kind);

  it('leads with Recommended, the Popular shelf, its blank first', () => {
    const recommended = start.groups[0]!;
    expect(recommended.id).toBe('recommended');
    expect(recommended.kinds).toEqual(popularKindsFor('pages'));
    expect(recommended.kinds[0]).toBe('blank-illustration');
  });

  it('shows only groups holding a template', () => {
    for (const g of start.groups) expect(g.kinds.length, g.id).toBeGreaterThan(0);
  });

  // "There is no way out to a bigger picker": the start is the whole catalogue, so every listed template sits in a
  // group.
  it('lists every template in a group after Recommended', () => {
    const grouped = new Set(start.groups.slice(1).flatMap((g) => g.kinds));
    for (const k of listed) expect(grouped.has(k), k).toBe(true);
    expect(grouped.has('blank-illustration')).toBe(false);
  });

  it('searches the catalogue, each match once, and nothing for a blank query', () => {
    expect(start.search('  ')).toEqual([]);
    expect(start.search('zzzqqq')).toEqual([]);
    const kinds = start.search('logo').flatMap((g) => g.kinds);
    expect(kinds).toContain('logo-design');
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

describe('Start Making Pages', () => {
  it('groups after Recommended and Blank Pages by the catalogue categories, in their order', () => {
    expect(TEMPLATE_STARTS.pages.groups.map((g) => g.name)).toEqual([
      'Recommended',
      'Blank Pages',
      ...TEMPLATE_CATEGORIES.map((c) => c.label),
    ]);
  });

  it('puts the blanks of a page kind in Blank Pages, and every other template under its primary category', () => {
    const groups = TEMPLATE_STARTS.pages.groups;
    expect(groups[1]!.kinds).toEqual([...EXTRA_BLANK_TEMPLATES]);
    for (const g of groups.slice(2))
      for (const k of g.kinds) expect(templateCategory(k), k).toBe(g.id);
    const kinds = groups.slice(1).flatMap((g) => g.kinds);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});
