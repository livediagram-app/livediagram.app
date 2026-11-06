import { describe, expect, it } from 'vitest';
import {
  EXTRA_BLANK_TEMPLATES,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  templateCategory,
} from '@livedocuments/templates';
import { TEMPLATE_START } from './start-template-items';

// docs/specs/007-editor/start-diagramming.md
describe('the Pages template start', () => {
  const start = TEMPLATE_START;
  const listed = TEMPLATES.filter(
    (t) => !t.hidden && t.kind !== 'blank-illustration' && t.kind !== 'blank',
  ).map((t) => t.kind);

  it('leads with Blank Pages, with no Recommended group', () => {
    expect(start.groups[0]!.id).toBe('blank-pages');
    expect(start.groups.some((g) => g.id === 'recommended')).toBe(false);
  });

  it('shows only groups holding a template', () => {
    for (const g of start.groups) expect(g.kinds.length, g.id).toBeGreaterThan(0);
  });

  // "There is no way out to a bigger picker": the start is the whole catalogue, so every listed template sits in a
  // group, each once.
  it('lists every template in exactly one group', () => {
    const kinds = start.groups.flatMap((g) => g.kinds);
    expect(new Set(kinds).size).toBe(kinds.length);
    for (const k of listed) expect(kinds, k).toContain(k);
    expect(kinds).not.toContain('blank-illustration');
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
  it('groups after Blank Pages by the catalogue categories, in their order', () => {
    expect(TEMPLATE_START.groups.map((g) => g.name)).toEqual([
      'Blank Pages',
      ...TEMPLATE_CATEGORIES.map((c) => c.label),
    ]);
  });

  it('puts the blanks of a page kind in Blank Pages, and every other template under its primary category', () => {
    const [blank, ...rest] = TEMPLATE_START.groups;
    expect(blank!.kinds).toEqual([...EXTRA_BLANK_TEMPLATES]);
    expect(blank!.kinds).toEqual(
      expect.arrayContaining(['blank-infographic', 'blank-article', 'blank-slide-deck']),
    );
    for (const g of rest) for (const k of g.kinds) expect(templateCategory(k), k).toBe(g.id);
  });
});
