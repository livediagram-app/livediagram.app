import { describe, expect, it } from 'vitest';
import {
  POPULAR_TEMPLATE_KINDS,
  TEMPLATES,
  isBlankTemplate,
  templateEditorMode,
} from '@livediagram/templates';
import {
  byMode,
  filterGallery,
  galleryShelves,
  galleryTemplates,
  groupGallery,
  modeCounts,
  popularFor,
  popularTemplates,
  POPULAR_PER_MODE,
  searchShelves,
} from './template-gallery';

describe('galleryTemplates (docs/specs/019-marketing/marketing-site.md)', () => {
  it('has one category card for every listed template but the three blanks', () => {
    const kinds = galleryTemplates().map((t) => t.kind);
    const expected = TEMPLATES.filter((t) => !t.hidden && !isBlankTemplate(t.kind)).map(
      (t) => t.kind,
    );
    expect(kinds).toEqual(expected);
    for (const blank of ['blank', 'whiteboard', 'blank-illustration']) {
      expect(kinds).not.toContain(blank);
    }
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('carries the mode each template opens in', () => {
    for (const t of galleryTemplates()) expect(t.mode, t.kind).toBe(templateEditorMode(t.kind));
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
    expect(filterGallery(all, 'offsite plan').map((t) => t.kind)).toContain('mindmap');
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

// docs/specs/019-marketing/marketing-site.md "Template gallery": the editor's template step's
// structure, Popular first, and its mode filter.
describe('the shelves, as the template step lays them out', () => {
  it('opens on Popular, the three blanks first, then every category in catalogue order', () => {
    const shelves = galleryShelves('all');
    expect(shelves[0]?.id).toBe('popular');
    expect(shelves[0]?.templates.map((t) => t.kind)).toEqual([...POPULAR_TEMPLATE_KINDS]);
    expect(
      popularTemplates()
        .slice(0, 3)
        .map((t) => t.kind),
    ).toEqual(['blank', 'whiteboard', 'blank-illustration']);
    expect(shelves.slice(1).map((s) => s.id)).toEqual(
      groupGallery(galleryTemplates()).map((g) => g.id),
    );
  });

  it('narrows every shelf to one mode and drops the shelves it empties', () => {
    for (const mode of ['diagram', 'draw', 'illustrate'] as const) {
      const shelves = galleryShelves(mode);
      expect(shelves.length, mode).toBeGreaterThan(0);
      for (const shelf of shelves) {
        expect(shelf.templates.length).toBeGreaterThan(0);
        for (const t of shelf.templates) expect(t.mode, `${mode} ${t.kind}`).toBe(mode);
      }
    }
  });

  it('counts each template once per choice', () => {
    const counts = modeCounts();
    expect(counts.diagram + counts.draw + counts.illustrate + counts.plan + counts.facilitate).toBe(
      counts.all,
    );
    expect(counts.all).toBe(TEMPLATES.filter((t) => !t.hidden).length);
    expect(counts.draw).toBe(byMode(galleryTemplates(), 'draw').length + 1);
  });

  it('finds a blank under Popular and the rest under their categories', () => {
    const shelves = searchShelves('whiteboard', 'all');
    expect(shelves[0]).toMatchObject({ id: 'popular' });
    expect(shelves[0]?.templates.map((t) => t.kind)).toEqual(['whiteboard']);
    expect(searchShelves('kanban', 'draw')).toEqual([]);
  });
});

describe('the shelf order', () => {
  it('mixes each category once, the same way every time', () => {
    const first = groupGallery(galleryTemplates());
    const again = groupGallery(galleryTemplates());
    expect(again.map((g) => g.templates.map((t) => t.kind))).toEqual(
      first.map((g) => g.templates.map((t) => t.kind)),
    );
    // Every category keeps exactly its own templates...
    for (const g of first) {
      const catalogue = galleryTemplates().filter((t) => t.category === g.id);
      expect(new Set(g.templates.map((t) => t.kind))).toEqual(
        new Set(catalogue.map((t) => t.kind)),
      );
    }
    // ...but not in the order they were added.
    const shuffled = first.filter((g) => {
      const catalogue = galleryTemplates()
        .filter((t) => t.category === g.id)
        .map((t) => t.kind);
      return g.templates.map((t) => t.kind).join() !== catalogue.join();
    });
    expect(shuffled.length).toBeGreaterThan(first.length / 2);
  });
});

describe('Popular under a mode', () => {
  it('holds at least five of the mode, its blank first', () => {
    const blanks = {
      diagram: 'blank',
      draw: 'whiteboard',
      illustrate: 'blank-illustration',
    } as const;
    for (const mode of ['diagram', 'draw', 'illustrate'] as const) {
      const kinds = popularFor(mode).map((t) => t.kind);
      expect(kinds.length, mode).toBeGreaterThanOrEqual(POPULAR_PER_MODE);
      expect(kinds[0], mode).toBe(blanks[mode]);
      expect(new Set(kinds).size).toBe(kinds.length);
      for (const t of popularFor(mode)) expect(t.mode, `${mode} ${t.kind}`).toBe(mode);
    }
  });

  it('leaves Everything as the catalogue lists it', () => {
    expect(popularFor('all').map((t) => t.kind)).toEqual([...POPULAR_TEMPLATE_KINDS]);
  });
});
