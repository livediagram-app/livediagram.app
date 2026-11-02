import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_ALSO_IN,
  TEMPLATE_CATEGORIES,
  isInTemplateCategory,
  templateCategories,
  templateCategory,
} from './template-categories';
import { isBlankTemplate } from './template-modes';
import { templateKeywords } from './template-keywords';
import { templateMatchesQuery } from './template-search';
import { TEMPLATES, type TemplateKind } from './templates';

// docs/specs/008-canvas/canvas-and-palette.md "Template categories".
describe('template categories', () => {
  const ids = TEMPLATE_CATEGORIES.map((c) => c.id);

  it('are the use-case categories, alphabetical by label, Title Case, with even descriptions', () => {
    expect(TEMPLATE_CATEGORIES.map((c) => c.label)).toEqual([
      'Careers',
      'Events and Celebrations',
      'Home and Hobbies',
      'Lessons and Learning',
      'Marketing and Social',
      'Pitches and Launches',
      'Plans and Proposals',
      'Reports',
      'Speeches and Talks',
      'Team and Meetings',
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
      careers: 2,
      events: 2,
      home: 2,
      learning: 3,
      marketing: 4,
      pitches: 3,
      plans: 4,
      reports: 4,
      speeches: 2,
      team: 3,
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
    expect(isInTemplateCategory('slide-deck', 'pitches')).toBe(true);
    expect(isInTemplateCategory('floor-plan', 'home')).toBe(true);
    // Cross-listed: the toast is a speech for a big day.
    expect(templateCategories('wedding-toast')).toEqual(['speeches', 'events']);
    expect(isInTemplateCategory('blank', 'pitches')).toBe(false);
  });

  it('leaves no category empty', () => {
    for (const id of ids) {
      const inIt = TEMPLATES.filter((t) => isInTemplateCategory(t.kind, id));
      expect(inIt.length, id).toBeGreaterThan(0);
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
    expect(find('powerpoint')).toEqual(expect.arrayContaining(['slide-deck', 'blank-slide-deck']));
    expect(find('cv')).toContain('resume');
    expect(find('prfaq')).toEqual(['working-backwards']);
    expect(find('instagram')).toContain('social-carousel');
    expect(find('floorplan')).toContain('floor-plan');
    // A category label finds what is in it; every word must match.
    expect(find('marketing storyboard')).toContain('storyboard');
    expect(find('marketing storyboard')).not.toContain('resume');
    expect(find('careers')).toEqual(expect.arrayContaining(['resume', 'cover-letter']));
    // A category's search words find what is in it, cross-listed or not.
    expect(find('school')).toEqual(
      expect.arrayContaining(['lesson-plan', 'class-lesson', 'class-presentation', 'how-it-works']),
    );
    expect(find('minutes')).toEqual(['meeting-notes']);
    expect(find('rfc')).toEqual(['design-doc']);
    expect(find('poster zebra')).toEqual([]);
    expect(find('')).toHaveLength(TEMPLATES.length);
  });

  it('reads punctuation and hyphens as no part of a word, in the query and the templates alike', () => {
    const find = (q: string) =>
      TEMPLATES.filter((t) => templateMatchesQuery(t, q)).map((t) => t.kind);
    expect(find('how-it-works')).toContain('how-it-works');
    expect(find('howitworks')).toContain('how-it-works');
    expect(find('pr-faq')).toContain('working-backwards');
    // Run together, a hyphenated name is found too ("floor plan" from the kind floor-plan).
    expect(find('floor plan')).toContain('floor-plan');
    // A query of punctuation alone is no query.
    expect(find(' - ')).toHaveLength(TEMPLATES.length);
  });

  it('matches the whole catalogue in well under a frame (it runs on every keystroke)', () => {
    const t0 = performance.now();
    for (let i = 0; i < 100; i++)
      TEMPLATES.filter((t) => templateMatchesQuery(t, 'slide deck page'));
    expect((performance.now() - t0) / 100).toBeLessThan(4);
  });
});
