import { describe, expect, it } from 'vitest';
import { TEMPLATES, isBlankTemplate } from '@liveknowledge/templates';
import {
  filterGallery,
  galleryShelves,
  galleryTemplates,
  groupGallery,
  BLANK_START,
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

  it('runs the categories alphabetically by name, with no Blank Slate shelf', () => {
    const shelves = galleryShelves();
    expect(shelves.map((g) => g.label)).not.toContain('Blank Slate');
    const names = shelves.map((g) => g.label);
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

// docs/specs/019-marketing/marketing-site.md "Templates": Blank Knowledgebase leads the category tiles but is no
// category (owner 2026-11-21): a link that makes a blank knowledgebase.
describe('the shelves and the blank', () => {
  it('opens on the first category; the blank is the start tile, on no shelf', () => {
    const shelves = galleryShelves();
    expect(shelves.map((s) => s.id)).toEqual(groupGallery(galleryTemplates()).map((g) => g.id));
    for (const shelf of shelves)
      for (const t of shelf.templates) expect(isBlankTemplate(t.kind), t.kind).toBe(false);
    expect(BLANK_START).toMatchObject({ label: 'Blank Knowledgebase', kind: 'blank-article' });
  });
});
