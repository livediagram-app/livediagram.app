import { describe, expect, it } from 'vitest';
import { EDITOR_MODES } from '@livedesign/design';
import {
  TEMPLATE_ALSO_IN,
  TEMPLATE_CATEGORIES,
  isInTemplateCategory,
  templateCategories,
  templateCategory,
} from './template-categories';
import { isBlankTemplate, templateEditorMode } from './template-modes';
import { templateKeywords } from './template-keywords';
import { templateMatchesQuery } from './template-search';
import { TEMPLATES, type TemplateKind } from './templates';

// docs/specs/008-canvas/canvas-and-palette.md "Template categories".
describe('template categories', () => {
  const ids = TEMPLATE_CATEGORIES.map((c) => c.id);

  it('are the use-case categories livedesign has, alphabetical by label, Title Case, with even descriptions', () => {
    expect(TEMPLATE_CATEGORIES.map((c) => c.label)).toEqual([
      'Branding',
      'Health and Fitness',
      'Music and Video',
      'Photos',
      'Shopping',
      'Sign Up and Onboarding',
      'Social and Messaging',
      'Travel and Transport',
      'Websites',
      'Work and Productivity',
    ]);
    const labels = TEMPLATE_CATEGORIES.map((c) => c.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'en')));
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of TEMPLATE_CATEGORIES) {
      expect(c.description.length, c.id).toBeGreaterThanOrEqual(40);
      expect(c.description.length, c.id).toBeLessThanOrEqual(50);
      expect(c.description, c.id).not.toMatch(/\u2014/);
    }
  });

  it('gives every template but the blanks exactly one primary category, and the blanks none', () => {
    for (const t of TEMPLATES) {
      const primary = templateCategory(t.kind);
      if (isBlankTemplate(t.kind)) {
        expect(primary, t.kind).toBeNull();
        expect(templateCategories(t.kind), t.kind).toEqual([]);
      } else {
        expect(ids, t.kind).toContain(primary);
        expect(templateCategories(t.kind)[0], t.kind).toBe(primary);
      }
    }
  });

  it('pins the primary counts', () => {
    const counts = ids.map((id) => TEMPLATES.filter((t) => templateCategory(t.kind) === id).length);
    expect(Object.fromEntries(ids.map((id, i) => [id, counts[i]]))).toEqual({
      branding: 5,
      health: 2,
      media: 3,
      photos: 1,
      shopping: 2,
      onboarding: 1,
      social: 2,
      travel: 2,
      websites: 4,
      work: 3,
    });
  });

  it('cross-lists only real templates into real categories, never their primary, never twice', () => {
    const kinds = new Set(TEMPLATES.map((t) => t.kind));
    for (const [kind, also] of Object.entries(TEMPLATE_ALSO_IN)) {
      expect(kinds.has(kind as TemplateKind), kind).toBe(true);
      expect(isBlankTemplate(kind as TemplateKind), kind).toBe(false);
      for (const c of also) expect(ids, `${kind} ${c}`).toContain(c);
      expect(also, kind).not.toContain(templateCategory(kind as TemplateKind));
      expect(new Set(also).size, kind).toBe(also.length);
    }
    expect(isInTemplateCategory('logo-design', 'branding')).toBe(true);
    expect(isInTemplateCategory('wireframe-mobile-app', 'shopping')).toBe(true);
    // Cross-listed: a store is a website and a shop.
    expect(isInTemplateCategory('wireframe-online-store', 'websites')).toBe(true);
    expect(isInTemplateCategory('wireframe-online-store', 'shopping')).toBe(true);
    expect(isInTemplateCategory('photo-edit', 'photos')).toBe(true);
    expect(isInTemplateCategory('blank', 'branding')).toBe(false);
  });

  it('leaves no category empty, every template in it opening in Pages', () => {
    for (const id of ids) {
      const inIt = TEMPLATES.filter((t) => isInTemplateCategory(t.kind, id));
      expect(inIt.length, id).toBeGreaterThan(0);
      for (const t of inIt) expect(EDITOR_MODES, t.kind).toContain(templateEditorMode(t.kind));
    }
  });
});

describe('template search words', () => {
  it('gives every template words of its own, lower case, each once', () => {
    for (const t of TEMPLATES) {
      const words = templateKeywords(t.kind);
      expect(words.length, t.kind).toBeGreaterThan(0);
      expect(new Set(words).size, t.kind).toBe(words.length);
      for (const w of words) expect(w, t.kind).toBe(w.toLowerCase());
    }
  });

  it('finds templates by the words people use', () => {
    const find = (q: string) =>
      TEMPLATES.filter((t) => templateMatchesQuery(t, q)).map((t) => t.kind);
    expect(find('brand')).toEqual(expect.arrayContaining(['logo-design', 'blank-logo']));
    expect(find('iphone')).toEqual(expect.arrayContaining(['blank-wireframe-phone']));
    expect(find('smartwatch')).toEqual([
      'blank-wireframe-watch',
      'wireframe-watch-app',
      'wireframe-fitness-watch',
      'wireframe-watch-music',
    ]);
    // A category label finds what is in it; every word must match.
    expect(find('productivity dashboard')).toContain('wireframe-dashboard');
    expect(find('productivity dashboard')).not.toContain('logo-design');
    expect(find('travel')).toEqual(
      expect.arrayContaining(['wireframe-travel-app', 'wireframe-ride-app']),
    );
    expect(find('emblem')).toContain('logo-emblems');
    expect(find('logo zebra')).toEqual([]);
    expect(find('')).toHaveLength(TEMPLATES.length);
  });

  it('reads punctuation and hyphens as no part of a word, in the query and the templates alike', () => {
    const find = (q: string) =>
      TEMPLATES.filter((t) => templateMatchesQuery(t, q)).map((t) => t.kind);
    expect(find('mobile-app')).toContain('wireframe-mobile-app');
    expect(find('mobileapp')).toContain('wireframe-mobile-app');
    expect(find('web-app')).toContain('wireframe-dashboard');
    // Run together, a hyphenated name is found too ("logo design" from the kind logo-design).
    expect(find('logo design')).toContain('logo-design');
    // A query of punctuation alone is no query.
    expect(find(' - ')).toHaveLength(TEMPLATES.length);
  });

  it('matches the whole catalogue in well under a frame (it runs on every keystroke)', () => {
    const t0 = performance.now();
    for (let i = 0; i < 100; i++)
      TEMPLATES.filter((t) => templateMatchesQuery(t, 'wireframe app page'));
    expect((performance.now() - t0) / 100).toBeLessThan(4);
  });
});
