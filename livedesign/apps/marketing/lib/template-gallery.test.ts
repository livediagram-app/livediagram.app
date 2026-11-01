import { describe, expect, it } from 'vitest';
import { TEMPLATES, isBlankTemplate } from '@livedesign/templates';
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
    for (const blank of ['blank', 'blank-illustration', 'blank-logo']) {
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
    expect(filterGallery(all, 'LOGO DESIGN').map((t) => t.kind)).toEqual(['logo-design']);
  });

  it('matches the description and the category name', () => {
    expect(filterGallery(all, 'landing page').map((t) => t.kind)).toContain('wireframe-website');
    expect(filterGallery(all, 'productivity').map((t) => t.kind)).toContain('wireframe-dashboard');
  });

  it('needs every word to hit somewhere', () => {
    const kinds = filterGallery(all, 'watch wireframe').map((t) => t.kind);
    expect(kinds).toContain('wireframe-watch-app');
    expect(kinds).not.toContain('wireframe-website');
    expect(filterGallery(all, 'logo zebra')).toEqual([]);
  });
});

describe('groupGallery', () => {
  it('keeps catalogue category order and drops emptied categories', () => {
    const groups = groupGallery(filterGallery(galleryTemplates(), 'logo design'));
    expect(groups.map((g) => g.label)).toEqual(['Branding']);
    expect(groups[0]?.templates.map((t) => t.kind)).toEqual(['logo-design']);
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
    expect(holding('logo-design')).toEqual(['branding']);
    expect(holding('wireframe-website')).toEqual(['websites']);
    // A cross-listed template shows on each of its categories.
    expect(holding('wireframe-online-store')).toEqual(['shopping', 'websites']);
  });

  it('finds a template by its search words, as the editor does', () => {
    expect(filterGallery(galleryTemplates(), 'branding').map((t) => t.kind)).toContain(
      'logo-design',
    );
    expect(filterGallery(galleryTemplates(), 'saas').map((t) => t.kind)).toContain(
      'wireframe-dashboard',
    );
  });
});

// docs/specs/019-marketing/marketing-site.md "Template gallery": the editor's template step's
// structure, Popular first.
describe('the shelves, as the template step lays them out', () => {
  it('opens on Blank Slate, only the blanks, then every category in catalogue order', () => {
    const shelves = galleryShelves();
    expect(shelves[0]?.id).toBe('popular');
    expect(shelves[0]?.templates.map((t) => t.kind)).toEqual([
      'blank-illustration',
      'blank-logo',
      'blank-wireframe-phone',
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
    // ...but not in the order they were added: every shelf with more than one template is mixed.
    const mixable = first.filter((g) => g.templates.length > 1);
    expect(mixable.length).toBeGreaterThan(0);
    for (const g of mixable) {
      const catalogue = galleryTemplates()
        .filter((t) => t.categories.includes(g.id as never))
        .map((t) => t.kind);
      expect(g.templates.map((t) => t.kind).join(), g.id).not.toBe(catalogue.join());
    }
  });
});
