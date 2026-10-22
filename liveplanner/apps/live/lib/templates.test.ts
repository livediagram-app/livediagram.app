import { describe, expect, it } from 'vitest';
import { buildTemplatedTab } from './template-builders';
import {
  isBlankTemplate,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  templateCanvasOverrides,
  templateCategory,
  untitledNameForTemplate,
  type TemplateKind,
} from '@liveplanner/templates';
import { getTheme } from './themes';

// `buildTemplatedTab` is the seam between /live/new (the welcome
// flow) and the editor: a freshly chosen template + theme has to
// land in the editor as a fully styled tab, or the user opens an
// "Untitled" project that doesn't match the option they picked.

// The catalogue's shape (count + no kind drift) is load-bearing across the picker and the MCP catalogue
// (docs/specs/026-plan/plan-templates.md "Plan's templates"). These tests pin the array so either the spec or the
// catalogue can't silently drift away from the other.
describe('TEMPLATES catalogue', () => {
  // List of every TemplateKind union member, kept in lockstep with
  // the catalogue. If a new kind lands in the union, both this list
  // AND the catalogue must grow; the test below catches a drift in
  // either direction.
  const ALL_KINDS: TemplateKind[] = [
    'blank',
    'kanban',
    'blank-plan',
    'blank-spreadsheet',
    'project-planner',
    'bug-triage',
    'team-retro',
    'weekly-planner',
    'content-calendar',
    'hiring-pipeline',
    'okrs',
    'product-launch',
    'feedback-board',
    'budget-planner',
    'timesheet',
    'contact-list',
    'task-tracker',
    'invoice',
    'expense-report',
    'loan-calculator',
    'sales-pipeline',
    'inventory',
    'guest-list',
    'grade-book',
    'habit-tracker',
    // Form templates (docs/specs/030-forms/forms.md "Starting a form").
    'blank-form',
    'bug-report-form',
    'feedback-form',
    'feature-request-form',
    'rsvp-form',
    'job-application-form',
    'contact-form',
  ];

  // Hidden templates are buildable but never listed, so every user-facing count (the picker grids, the MCP
  // catalogue) is over the listed subset. The mechanism is generic; nothing ships hidden today.
  const listed = TEMPLATES.filter((t) => !t.hidden);

  it('lists exactly 32 templates', () => {
    expect(listed).toHaveLength(32);
  });

  it('ships no hidden templates', () => {
    expect(TEMPLATES.filter((t) => t.hidden)).toEqual([]);
  });

  it('has no duplicate kinds (guards against accidental copy-paste in the catalogue)', () => {
    const kinds = TEMPLATES.map((t) => t.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('assigns every template but the blanks to a known category (the picker groups templates by category)', () => {
    const known = new Set(TEMPLATE_CATEGORIES.map((c) => c.id));
    for (const t of TEMPLATES) {
      const category = templateCategory(t.kind);
      if (isBlankTemplate(t.kind)) expect(category, t.kind).toBeNull();
      else expect(category !== null && known.has(category), t.kind).toBe(true);
    }
  });

  it('lists every TemplateKind member exactly once', () => {
    const kinds = new Set(TEMPLATES.map((t) => t.kind));
    for (const kind of ALL_KINDS) {
      expect(kinds.has(kind)).toBe(true);
    }
    expect(kinds.size).toBe(ALL_KINDS.length);
  });

  it('every kind builds without throwing (the buildTemplate switch handles every union member)', () => {
    for (const kind of ALL_KINDS) {
      const tab = buildTemplatedTab(kind, 'brand', `tab-${kind}`, 'name');
      // Blank, Blank Plan (which opens on Start Planning) and a form template's tab (which the editor starts the
      // form on) are intentionally empty; every other kind seeds content.
      const empty = kind === 'blank' || kind === 'blank-plan' || kind.endsWith('-form');
      expect(tab.elements.length, kind).toBeGreaterThan(empty ? -1 : 0);
    }
  });
});

describe('templateCanvasOverrides', () => {
  it('opens every Plan template on the quiet dot grid (docs/specs/026-plan/plan-mode.md)', () => {
    for (const t of TEMPLATES) {
      if (t.kind === 'blank') continue;
      expect(templateCanvasOverrides(t.kind), t.kind).toEqual({ backgroundPattern: 'grid' });
    }
  });

  it('leaves the blank template to inherit the theme backdrop', () => {
    expect(templateCanvasOverrides('blank')).toEqual({});
  });
});

describe('buildTemplatedTab', () => {
  it('returns a Tab carrying the supplied id, name, and theme metadata', () => {
    const tab = buildTemplatedTab('blank', 'slate', 'tab-1', 'My tab');
    const slate = getTheme('slate');
    expect(tab.id).toBe('tab-1');
    expect(tab.name).toBe('My tab');
    expect(tab.theme).toBe('slate');
    expect(tab.backgroundColor).toBe(slate.backgroundColor);
    expect(tab.backgroundPattern).toBe(slate.backgroundPattern);
    expect(tab.patternColor).toBe(slate.patternColor);
    expect(tab.templateChosen).toBe(true);
  });

  it('lays a Plan template on the dot grid over the theme', () => {
    expect(buildTemplatedTab('kanban', 'slate', 'tab-1', 'Board').backgroundPattern).toBe('grid');
  });
});

describe('untitledNameForTemplate', () => {
  it('names a templated project in title case after its template title', () => {
    expect(untitledNameForTemplate('kanban')).toBe('Untitled Kanban Board');
    expect(untitledNameForTemplate('bug-triage')).toBe('Untitled Bug Tracker');
  });
  it('keeps "Untitled project" for blank or no template', () => {
    expect(untitledNameForTemplate('blank')).toBe('Untitled project');
    expect(untitledNameForTemplate(null)).toBe('Untitled project');
  });
});

// No template writes an opening mode: Plan is the only one.
describe('template opening mode', () => {
  it('is set by no template', () => {
    for (const t of TEMPLATES)
      expect(templateCanvasOverrides(t.kind), t.kind).not.toHaveProperty('opensIn');
  });
});
