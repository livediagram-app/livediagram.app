import { describe, expect, it } from 'vitest';
import { EDITOR_MODES } from '@livehuddle/document';
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

  it('are the fourteen use-case categories, alphabetical by label, Title Case, with even descriptions', () => {
    expect(TEMPLATE_CATEGORIES.map((c) => c.label)).toEqual([
      'Brainstorming',
      'Decisions',
      'Goals & Metrics',
      'Meetings & Workshops',
      'People & Teams',
      'Planning',
      'Processes & Workflows',
      'Product & UX',
      'Quizzes & Games',
      'Retrospectives',
      'Software & IT',
      'Strategy',
      'Teaching & Learning',
      'Virtual Spaces',
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
      ideas: 7,
      decisions: 7,
      goals: 6,
      meetings: 4,
      people: 4,
      planning: 5,
      processes: 4,
      product: 11,
      games: 6,
      retros: 5,
      software: 11,
      strategy: 8,
      learning: 3,
      spaces: 4,
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
    expect(isInTemplateCategory('okr-tree', 'strategy')).toBe(true);
    expect(isInTemplateCategory('venn', 'learning')).toBe(true);
    expect(isInTemplateCategory('blank', 'processes')).toBe(false);
  });

  it('leaves no category empty in every mode, and hides one only where a mode has none', () => {
    for (const id of ids) {
      const modes = EDITOR_MODES.filter((m) =>
        TEMPLATES.some((t) => isInTemplateCategory(t.kind, id) && templateEditorMode(t.kind) === m),
      );
      expect(modes.length, id).toBeGreaterThan(0);
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
    expect(find('1:1')).toContain('meeting-agenda');
    expect(find('retro')).toEqual(expect.arrayContaining(['retrospective', 'sailboat']));
    expect(find('persona')).toContain('user-persona');
    expect(find('erd')).toContain('er-diagram');
    expect(find('org')).toContain('orgchart');
    // The words the old artefact-shaped labels carried still find their templates.
    expect(find('flowcharts')).toEqual(expect.arrayContaining(['flowchart', 'swimlane']));
    expect(find('technical')).toEqual(expect.arrayContaining(['er-diagram', 'network-diagram']));
    expect(find('classroom')).toEqual(expect.arrayContaining(['kwl-chart', 'concept-map']));
    expect(find('eisenhower')).toContain('eisenhower-matrix');
    expect(find('pestel')).toContain('pestle-analysis');
    expect(find('30 60 90')).toContain('onboarding-plan');
    expect(find('lan')).toContain('network-diagram');
    // A category label finds what is cross-listed in it; every word must match.
    expect(find('metrics funnel')).toContain('funnel');
    expect(find('metrics funnel')).not.toContain('orgchart');
    expect(find('flowchart zebra')).toEqual([]);
    expect(find('')).toHaveLength(TEMPLATES.length);
  });

  it('reads punctuation and hyphens as no part of a word, in the query and the templates alike', () => {
    const find = (q: string) =>
      TEMPLATES.filter((t) => templateMatchesQuery(t, q)).map((t) => t.kind);
    expect(find('1-on-1')).toContain('meeting-agenda');
    expect(find('one-on-one')).toContain('meeting-agenda');
    // Run together, a hyphenated name is found too ("er diagram" from the kind er-diagram).
    expect(find('erdiagram')).toContain('er-diagram');
    // A query of punctuation alone is no query.
    expect(find(' - ')).toHaveLength(TEMPLATES.length);
  });

  it('matches the whole catalogue in well under a frame (it runs on every keystroke)', () => {
    const t0 = performance.now();
    for (let i = 0; i < 100; i++)
      TEMPLATES.filter((t) => templateMatchesQuery(t, 'flow chart map'));
    expect((performance.now() - t0) / 100).toBeLessThan(4);
  });
});
