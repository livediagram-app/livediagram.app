import { describe, expect, it } from 'vitest';
import { TEMPLATES, isBlankTemplate, templateEditorMode } from '@liveplanner/templates';
import {
  filterGallery,
  galleryShelves,
  galleryTemplates,
  groupGallery,
  popularTemplates,
} from './template-gallery';

describe('galleryTemplates (docs/specs/019-marketing/marketing-site.md)', () => {
  it('has one category card for every listed template but the blanks', () => {
    const kinds = galleryTemplates().map((t) => t.kind);
    const expected = TEMPLATES.filter(
      (t) => !t.hidden && !isBlankTemplate(t.kind) && templateEditorMode(t.kind) === 'plan',
    ).map((t) => t.kind);
    expect(kinds).toEqual(expected);
    for (const blank of ['blank-plan', 'blank-spreadsheet', 'blank-form']) {
      expect(kinds).not.toContain(blank);
    }
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('carries the mode each template opens in, and lists only Plan templates', () => {
    for (const t of galleryTemplates()) {
      expect(t.mode, t.kind).toBe(templateEditorMode(t.kind));
      expect(t.mode, t.kind).toBe('plan');
    }
    for (const kind of ['flowchart', 'mindmap', 'retrospective', 'slide-deck', 'whiteboard']) {
      expect(galleryTemplates().map((t) => t.kind)).not.toContain(kind);
    }
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
    expect(filterGallery(all, 'candidates').map((t) => t.kind)).toContain('job-application-form');
    expect(filterGallery(all, 'finance').map((t) => t.kind)).toContain('budget-planner');
  });

  it('needs every word to hit somewhere', () => {
    const kinds = filterGallery(all, 'form bug').map((t) => t.kind);
    expect(kinds).toContain('bug-report-form');
    expect(kinds).not.toContain('bug-triage');
    expect(filterGallery(all, 'kanban zebra')).toEqual([]);
  });
});

describe('groupGallery', () => {
  it('keeps catalogue category order and drops emptied categories', () => {
    const groups = groupGallery(filterGallery(galleryTemplates(), 'kanban'));
    expect(groups.map((g) => g.label)).toEqual(['Planning']);
    expect(groups[0]?.templates.map((t) => t.kind)).toEqual(['kanban']);
  });

  it('runs the categories alphabetically by name, Blank Slate first', () => {
    const shelves = galleryShelves();
    expect(shelves[0]!.label).toBe('Blank Slate');
    const names = shelves.slice(1).map((g) => g.label);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('shows a cross-listed template on each of its categories', () => {
    const browse = groupGallery(galleryTemplates());
    const holding = (kind: string) =>
      browse.filter((g) => g.templates.some((t) => t.kind === kind)).map((g) => g.id);
    expect(holding('invoice')).toEqual(['finance', 'spreadsheets']);
  });

  it('finds a template by its search words, as the editor does', () => {
    expect(filterGallery(galleryTemplates(), 'mortgage').map((t) => t.kind)).toContain(
      'loan-calculator',
    );
  });
});

// docs/specs/019-marketing/marketing-site.md "Template gallery": the editor's template step's
// structure, Popular first.
describe('the shelves, as the template step lays them out', () => {
  it('opens on Blank Slate, only the Plan blanks, then every category in catalogue order', () => {
    const shelves = galleryShelves();
    expect(shelves[0]?.id).toBe('popular');
    expect(shelves[0]?.templates.map((t) => t.kind)).toEqual([
      'blank-plan',
      'blank-spreadsheet',
      'blank-form',
    ]);
    for (const t of popularTemplates()) expect(isBlankTemplate(t.kind), t.kind).toBe(true);
    expect(shelves.slice(1).map((s) => s.id)).toEqual(
      groupGallery(galleryTemplates()).map((g) => g.id),
    );
  });
});

describe('the shelf order', () => {
  it('mixes each category once, the same way every time', () => {
    const first = groupGallery(galleryTemplates());
    const again = groupGallery(galleryTemplates());
    expect(again.map((g) => g.templates.map((t) => t.kind))).toEqual(
      first.map((g) => g.templates.map((t) => t.kind)),
    );
    // Every category keeps exactly its own templates, cross-listed ones included...
    for (const g of first) {
      const catalogue = galleryTemplates().filter((t) => t.categories.includes(g.id as never));
      expect(new Set(g.templates.map((t) => t.kind))).toEqual(
        new Set(catalogue.map((t) => t.kind)),
      );
    }
    // ...but not in the order they were added.
    const shuffled = first.filter((g) => {
      const catalogue = galleryTemplates()
        .filter((t) => t.categories.includes(g.id as never))
        .map((t) => t.kind);
      return g.templates.map((t) => t.kind).join() !== catalogue.join();
    });
    expect(shuffled.length).toBeGreaterThan(first.length / 2);
  });
});
