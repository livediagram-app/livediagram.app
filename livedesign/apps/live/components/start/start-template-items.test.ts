import { describe, expect, it } from 'vitest';
import {
  EXTRA_BLANK_TEMPLATES,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  popularKindsFor,
  templateCategory,
  templatePageKind,
} from '@livedesign/templates';
import { TEMPLATE_STARTS, templateStartFor } from './start-template-items';

// docs/specs/007-editor/start-diagramming.md
describe('the Pages template start', () => {
  const start = TEMPLATE_STARTS.pages;
  const listed = TEMPLATES.filter((t) => !t.hidden && t.kind !== 'blank').map((t) => t.kind);

  it('leads with Recommended, the Popular shelf, with no Blank Tab', () => {
    const recommended = start.groups[0]!;
    expect(recommended.id).toBe('recommended');
    expect(recommended.kinds).toEqual(popularKindsFor('pages'));
    expect(recommended.kinds).not.toContain('blank');
  });

  it('finds no Blank Tab by search', () => {
    expect(start.search('blank').flatMap((g) => g.kinds)).not.toContain('blank');
  });

  it('shows only groups holding a template', () => {
    for (const g of start.groups) expect(g.kinds.length, g.id).toBeGreaterThan(0);
  });

  // "There is no way out to a bigger picker": the start is the whole catalogue, so every listed template sits in a
  // group.
  it('lists every template in a group after Recommended', () => {
    const grouped = new Set(start.groups.slice(1).flatMap((g) => g.kinds));
    for (const k of listed) expect(grouped.has(k), k).toBe(true);
    expect(grouped.has('blank')).toBe(false);
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

// docs/specs/007-editor/start-diagramming.md "Page type"
describe('the start by page type', () => {
  const listed = TEMPLATES.filter((t) => !t.hidden && t.kind !== 'blank').map((t) => t.kind);
  const TYPES = ['logo', 'wireframe', 'photo'] as const;

  it('is the whole start under All Pages', () => {
    expect(templateStartFor('pages', 'all')).toBe(TEMPLATE_STARTS.pages);
  });

  it('holds only that kind of page, every group holding something, built once', () => {
    for (const type of TYPES) {
      const start = templateStartFor('pages', type);
      expect(templateStartFor('pages', type)).toBe(start);
      for (const g of start.groups) {
        expect(g.kinds.length, `${type} ${g.id}`).toBeGreaterThan(0);
        for (const k of g.kinds) expect(templatePageKind(k), `${type} ${k}`).toBe(type);
      }
    }
  });

  it('files every listed template under exactly one page type', () => {
    for (const k of listed) {
      const homes = TYPES.filter((type) =>
        templateStartFor('pages', type).groups.some(
          (g) => g.id !== 'recommended' && g.kinds.includes(k),
        ),
      );
      expect(homes, k).toEqual([templatePageKind(k)]);
    }
  });

  it('searches only within the page type', () => {
    const kinds = templateStartFor('pages', 'wireframe')
      .search('logo')
      .flatMap((g) => g.kinds);
    expect(kinds).not.toContain('logo-design');
    for (const k of kinds) expect(templatePageKind(k), k).toBe('wireframe');
  });
});
