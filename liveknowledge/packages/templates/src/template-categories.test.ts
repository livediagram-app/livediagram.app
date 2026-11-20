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
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';

// docs/specs/008-canvas/canvas-and-palette.md "Template categories".
describe('template categories', () => {
  const ids = TEMPLATE_CATEGORIES.map((c) => c.id);

  it('are the use-case categories, alphabetical by label, Title Case, with even descriptions', () => {
    expect(TEMPLATE_CATEGORIES.map((c) => c.label)).toEqual([
      'Careers',
      'Learning',
      'Marketing',
      'Plans',
      'Reports',
      'Teams',
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
      careers: 1,
      learning: 1,
      marketing: 2,
      plans: 5,
      reports: 2,
      team: 2,
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
    expect(isInTemplateCategory('design-doc', 'plans')).toBe(true);
    // Cross-listed: a team's newsletter goes round the team.
    expect(templateCategories('newsletter')).toEqual(['marketing', 'team']);
    expect(isInTemplateCategory('blank', 'plans')).toBe(false);
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
    // No slide or infographic template is listed, so none is found.
    expect(find('powerpoint')).toEqual([]);
    expect(find('instagram')).toEqual([]);
    expect(find('prfaq')).toEqual(['working-backwards']);
    // A category label finds what is in it; every word must match.
    expect(find('marketing newsletter')).toContain('newsletter');
    expect(find('marketing newsletter')).not.toContain('cover-letter');
    expect(find('careers')).toEqual(['cover-letter']);
    // A category's search words find what is in it.
    expect(find('school')).toEqual(['lesson-plan']);
    expect(find('minutes')).toEqual(['meeting-notes']);
    expect(find('rfc')).toEqual(['design-doc']);
    expect(find('handbook')).toEqual(['onboarding-handbook']);
    expect(find('footnotes')).toEqual(['research-report']);
    expect(find('case study')).toEqual(['case-study']);
    expect(find('newsletter')).toEqual(['newsletter']);
    expect(find('poster zebra')).toEqual([]);
    expect(find('')).toHaveLength(TEMPLATES.length);
  });

  it('reads punctuation and hyphens as no part of a word, in the query and the templates alike', () => {
    const find = (q: string) =>
      TEMPLATES.filter((t) => templateMatchesQuery(t, q)).map((t) => t.kind);
    expect(find('case-study')).toContain('case-study');
    expect(find('casestudy')).toContain('case-study');
    expect(find('pr-faq')).toContain('working-backwards');
    // Run together, a hyphenated name is found too ("design doc" from the kind design-doc).
    expect(find('design doc')).toContain('design-doc');
    // A query of punctuation alone is no query.
    expect(find(' - ')).toHaveLength(TEMPLATES.length);
  });

  it('matches the whole catalogue in well under a frame (it runs on every keystroke)', () => {
    const t0 = cpuNowMs();
    for (let i = 0; i < 100; i++)
      TEMPLATES.filter((t) => templateMatchesQuery(t, 'slide deck page'));
    expect((cpuNowMs() - t0) / 100).toBeLessThan(cpuBudgetMs(4));
  });
});
