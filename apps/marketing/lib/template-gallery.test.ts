import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '@livediagram/templates';
import {
  filterGallery,
  galleryTemplates,
  groupGallery,
  templateCreateHref,
} from './template-gallery';

describe('galleryTemplates (spec/16)', () => {
  it('has one card for every listed template except Blank', () => {
    const kinds = galleryTemplates().map((t) => t.kind);
    const expected = TEMPLATES.filter((t) => !t.hidden && t.kind !== 'blank').map((t) => t.kind);
    expect(kinds).toEqual(expected);
    expect(kinds).not.toContain('blank');
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('labels every card with its category', () => {
    for (const t of galleryTemplates()) expect(t.categoryLabel, t.kind).not.toBe('');
  });
});

describe('filterGallery', () => {
  const all = galleryTemplates();

  it('returns everything for an empty or blank query', () => {
    expect(filterGallery(all, '')).toBe(all);
    expect(filterGallery(all, '   ')).toBe(all);
  });

  it('matches the title, case-insensitively', () => {
    expect(filterGallery(all, 'KANBAN').map((t) => t.kind)).toEqual(['kanban']);
  });

  it('matches the description and the category name', () => {
    expect(filterGallery(all, 'central idea').map((t) => t.kind)).toContain('mindmap');
    expect(filterGallery(all, 'technical').map((t) => t.kind)).toContain('sequence-diagram');
  });

  it('needs every word to hit somewhere', () => {
    const kinds = filterGallery(all, 'mind tree').map((t) => t.kind);
    expect(kinds).toContain('mindmap-tree');
    expect(kinds).not.toContain('mindmap-bubble');
    expect(filterGallery(all, 'kanban zebra')).toEqual([]);
  });
});

describe('groupGallery', () => {
  it('keeps catalogue category order and drops emptied categories', () => {
    const groups = groupGallery(filterGallery(galleryTemplates(), 'kanban'));
    expect(groups.map((g) => g.label)).toEqual(['Agile']);
    expect(groups[0]?.templates.map((t) => t.kind)).toEqual(['kanban']);
  });
});

describe('templateCreateHref', () => {
  it('links into the editor bypass (spec/14)', () => {
    expect(templateCreateHref('swot')).toBe('/new?template=swot');
  });
});
