import { describe, expect, it } from 'vitest';
import { TEMPLATES, isBlankTemplate } from '@liveknowledge/templates';
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
    const expected = TEMPLATES.filter((t) => !t.hidden && !isBlankTemplate(t.kind)).map(
      (t) => t.kind,
    );
    expect(kinds).toEqual(expected);
    for (const blank of ['blank', 'blank-illustration', 'blank-slide-deck']) {
      expect(kinds).not.toContain(blank);
    }
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
    expect(filterGallery(all, 'NEWSLETTER').map((t) => t.kind)).toEqual(['newsletter']);
  });

  it('matches the description and the category name', () => {
    expect(filterGallery(all, 'onboarding').map((t) => t.kind)).toContain('onboarding-handbook');
    expect(filterGallery(all, 'support').map((t) => t.kind)).toContain('case-study');
    expect(filterGallery(all, 'minutes').map((t) => t.kind)).toEqual(['meeting-notes']);
  });

  it('needs every word to hit somewhere', () => {
    const kinds = filterGallery(all, 'design doc').map((t) => t.kind);
    expect(kinds).toContain('design-doc');
    expect(kinds).not.toContain('newsletter');
    expect(filterGallery(all, 'newsletter zebra')).toEqual([]);
  });
});

describe('groupGallery', () => {
  it('keeps catalogue category order and drops emptied categories', () => {
    const groups = groupGallery(filterGallery(galleryTemplates(), 'minutes'));
    expect(groups.map((g) => g.label)).toEqual(['Handbooks']);
    expect(groups[0]?.templates.map((t) => t.kind)).toEqual(['meeting-notes']);
  });

  it('runs the categories alphabetically by name, Blank Slate first', () => {
    const shelves = galleryShelves();
    expect(shelves[0]!.label).toBe('Blank Slate');
    const names = shelves.slice(1).map((g) => g.label);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('shows each template on its own category', () => {
    const browse = groupGallery(galleryTemplates());
    const holding = (kind: string) =>
      browse.filter((g) => g.templates.some((t) => t.kind === kind)).map((g) => g.id);
    expect(holding('design-doc')).toEqual(['engineering']);
    expect(holding('lesson-plan')).toEqual(['onboarding']);
    // A cross-listed template shows on each of its categories.
    expect(holding('onboarding-handbook')).toEqual(['handbooks', 'onboarding']);
  });

  it('finds a template by its search words, as the editor does', () => {
    expect(filterGallery(galleryTemplates(), 'rfc').map((t) => t.kind)).toContain('design-doc');
    expect(filterGallery(galleryTemplates(), 'minutes').map((t) => t.kind)).toContain(
      'meeting-notes',
    );
  });
});

// docs/specs/019-marketing/marketing-site.md "Template gallery": the editor's template step's
// structure, Popular first.
describe('the shelves, as the template step lays them out', () => {
  it('opens on Blank Slate, only the blanks, then every category in catalogue order', () => {
    const shelves = galleryShelves();
    expect(shelves[0]?.id).toBe('popular');
    expect(shelves[0]?.templates.map((t) => t.kind)).toEqual(['blank-article']);
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
    // (A shelf of one template has no order to mix: liveknowledge's catalogue has several.)
    expect(shuffled.length).toBeGreaterThan(0);
    // Every shelf of four or more comes out mixed (a seeded mix of two or three may land as it was: Onboarding's
    // three do, one chance in six).
    const unmixed = first
      .filter((g) => g.templates.length > 3 && !shuffled.includes(g))
      .map((g) => g.id);
    expect(unmixed).toEqual([]);
  });
});
