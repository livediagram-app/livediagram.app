import { describe, expect, it } from 'vitest';
import { EDITOR_MODES } from '@liveplanner/document';
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

  it('are the thirteen job-based categories, alphabetical by label, Title Case, with even descriptions', () => {
    expect(TEMPLATE_CATEGORIES.map((c) => c.label)).toEqual([
      'Brainstorm',
      'Design',
      'Finance',
      'Flowcharts',
      'Forms',
      'Org Charts',
      'Planning',
      'Presentations',
      'Spreadsheets',
      'Strategy',
      'Technical',
      'Timelines',
      'Workshops',
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
      planning: 9,
      finance: 6,
      spreadsheets: 5,
      forms: 6,
      meetings: 10,
      mindmaps: 8,
      timelines: 7,
      flowcharts: 5,
      strategy: 15,
      hierarchies: 7,
      design: 14,
      presentations: 17,
      technical: 10,
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
    expect(isInTemplateCategory('invoice', 'spreadsheets')).toBe(true);
    expect(isInTemplateCategory('funnel', 'finance')).toBe(true);
    expect(isInTemplateCategory('team-retro', 'planning')).toBe(true);
    expect(isInTemplateCategory('doodle-warmup', 'meetings')).toBe(true);
    expect(isInTemplateCategory('blank', 'flowcharts')).toBe(false);
  });

  it('leaves no category empty in every mode, and hides one only where a mode has none', () => {
    for (const id of ids) {
      const modes = EDITOR_MODES.filter((m) =>
        TEMPLATES.some((t) => isInTemplateCategory(t.kind, id) && templateEditorMode(t.kind) === m),
      );
      expect(modes.length, id).toBeGreaterThan(0);
    }
    // Spreadsheets is a Plan shelf; under Diagram, Finance keeps its money diagrams.
    const inMode = (id: (typeof ids)[number], mode: string) =>
      TEMPLATES.filter(
        (t) => isInTemplateCategory(t.kind, id) && templateEditorMode(t.kind) === mode,
      ).map((t) => t.kind);
    expect(inMode('spreadsheets', 'diagram')).toEqual([]);
    expect(inMode('finance', 'diagram').sort()).toEqual(['funnel', 'sankey']);
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
    expect(find('sprint')).toContain('project-planner');
    expect(find('standup')).toContain('project-planner');
    expect(find('mortgage')).toEqual(['loan-calculator']);
    expect(find('invoice')).toContain('invoice');
    expect(find('crm')).toEqual(expect.arrayContaining(['contact-list', 'sales-pipeline']));
    expect(find('kpi')).toContain('okrs');
    expect(find('retro')).toEqual(
      expect.arrayContaining(['retrospective', 'team-retro', 'sailboat']),
    );
    expect(find('persona')).toContain('user-persona');
    expect(find('erd')).toContain('er-diagram');
    expect(find('org')).toContain('orgchart');
    // A category label finds what is cross-listed in it; every word must match.
    expect(find('finance funnel')).toContain('funnel');
    expect(find('finance funnel')).not.toContain('swot');
    expect(find('kanban zebra')).toEqual([]);
    expect(find('')).toHaveLength(TEMPLATES.length);
  });

  it('reads punctuation and hyphens as no part of a word, in the query and the templates alike', () => {
    const find = (q: string) =>
      TEMPLATES.filter((t) => templateMatchesQuery(t, q)).map((t) => t.kind);
    expect(find('to-do')).toContain('task-tracker');
    expect(find('todo')).toContain('task-tracker');
    // Run together, a hyphenated name is found too ("er diagram" from the kind er-diagram).
    expect(find('erdiagram')).toContain('er-diagram');
    // A query of punctuation alone is no query.
    expect(find(' - ')).toHaveLength(TEMPLATES.length);
  });

  it('shares a sheet template’s words with the Plan template made from it', () => {
    expect(templateKeywords('guest-list')).toContain('wedding');
    expect(templateKeywords('budget-planner')).toContain('household');
  });

  it('matches the whole catalogue in well under a frame (it runs on every keystroke)', () => {
    const t0 = performance.now();
    for (let i = 0; i < 100; i++)
      TEMPLATES.filter((t) => templateMatchesQuery(t, 'plan board sheet'));
    expect((performance.now() - t0) / 100).toBeLessThan(4);
  });
});
