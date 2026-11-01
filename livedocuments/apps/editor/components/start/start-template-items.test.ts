import { describe, expect, it } from 'vitest';
import {
  EXTRA_BLANK_TEMPLATES,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  stepPopularKinds,
  templateCategory,
} from '@livedocuments/templates';
import { TEMPLATE_START } from './start-template-items';

// docs/specs/007-editor/start-diagramming.md
describe('the Pages template start', () => {
  const start = TEMPLATE_START;
  const listed = TEMPLATES.filter(
    (t) => !t.hidden && t.kind !== 'blank-illustration' && t.kind !== 'blank',
  ).map((t) => t.kind);

  it('leads with Recommended, the Popular shelf with two picks swapped for blanks of a page kind', () => {
    const recommended = start.groups[0]!;
    expect(recommended.id).toBe('recommended');
    const swap: Partial<Record<string, string>> = {
      'blank-illustration': 'blank-infographic',
      article: 'blank-article',
    };
    expect(recommended.kinds).toEqual(stepPopularKinds().map((k) => swap[k] ?? k));
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
    const kinds = start.search('slide').flatMap((g) => g.kinds);
    expect(kinds).toContain('slide-deck');
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

describe('Start Making Pages', () => {
  it('groups after Recommended and Blank Pages by the catalogue categories, in their order', () => {
    expect(TEMPLATE_START.groups.map((g) => g.name)).toEqual([
      'Recommended',
      'Blank Pages',
      ...TEMPLATE_CATEGORIES.map((c) => c.label),
    ]);
  });

  it('puts the blanks of a page kind in Blank Pages, and every other template under its primary category', () => {
    const groups = TEMPLATE_START.groups;
    expect(groups[1]!.kinds).toEqual([...EXTRA_BLANK_TEMPLATES]);
    for (const g of groups.slice(2))
      for (const k of g.kinds) expect(templateCategory(k), k).toBe(g.id);
    const kinds = groups.slice(1).flatMap((g) => g.kinds);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('leads Recommended with the blanks of a page kind in place of Blank Illustration and the Project Brief', () => {
    // docs/specs/007-editor/start-diagramming.md "Recommended and groups".
    const recommended = TEMPLATE_START.groups[0]!.kinds;
    expect(recommended.slice(0, 3)).toEqual([
      'blank-infographic',
      'blank-article',
      'blank-slide-deck',
    ]);
    for (const k of ['blank-illustration', 'article', 'slide-deck'] as const)
      expect(recommended).not.toContain(k);
  });
});
