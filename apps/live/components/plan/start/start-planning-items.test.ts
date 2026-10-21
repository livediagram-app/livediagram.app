import { describe, expect, it } from 'vitest';
import {
  TEMPLATES,
  isSpreadsheetPlanTemplate,
  planTemplateTabCount,
  templateEditorMode,
  type PlanTemplateKind,
  isFormTemplateKind,
  formTemplateStarter,
} from '@liveplanner/templates';
import { SHEET_TEMPLATES, TEMPLATE_START_SHEETS } from '@liveplanner/sheets';
import {
  INSPIRATION_TEMPLATES,
  itemsIn,
  searchStartItems,
  startItems,
} from './start-planning-items';

// docs/specs/026-plan/plan-mode.md "Starting a board".
describe('Start Planning’s choices', () => {
  const items = startItems({ hasCards: true });

  it('offers every board but the Archive, Blank first and All Cards last', () => {
    const boards = itemsIn(items, 'boards');
    expect(boards[0]!.name).toBe('Blank');
    expect(boards.at(-1)!.name).toBe('All Cards');
    expect(boards.some((b) => b.id === 'board:archive')).toBe(false);
  });

  it('gives a board its card types as chips, or says what it takes instead', () => {
    const kanban = items.find((i) => i.id === 'board:kanban')!;
    expect(kanban.types!.map((t) => t.label)).toEqual(['Task', 'Action']);
    expect(items.find((i) => i.id === 'board:blank')!.typesNote).toBe('You Choose');
    expect(items.find((i) => i.id === 'board:all-cards')?.typesNote).toBe('Every Card');
  });

  it('offers the Card Table only with cards to put in it', () => {
    expect(itemsIn(startItems({ hasCards: false }), 'sheets').map((s) => s.name)).toEqual([
      'Empty Sheet',
      ...SHEET_TEMPLATES.map((t) => t.name),
    ]);
    expect(itemsIn(items, 'sheets')).toHaveLength(SHEET_TEMPLATES.length + 2);
  });

  it('gives every sheet template its own search words', () => {
    for (const t of SHEET_TEMPLATES) {
      expect(t.keywords.length, t.id).toBeGreaterThan(0);
      expect(items.find((i) => i.id === `sheet:${t.id}`)!.keywords, t.id).toEqual(t.keywords);
    }
    const found = searchStartItems(startItems({ hasCards: false }), 'mortgage');
    expect(found.flatMap((g) => g.items.map((i) => i.id))).toContain('sheet:loan');
  });

  it('recommends a mix of boards, a dashboard, a sheet and a form, in order', () => {
    expect(itemsIn(items, 'recommended').map((i) => i.id)).toEqual([
      'board:roadmap',
      'board:kanban',
      'board:todo',
      'dashboard:overview',
      'sheet:blank',
      'form:feedback',
    ]);
  });

  it('offers every Dashboard layout', () => {
    expect(itemsIn(items, 'dashboards').map((d) => d.name)).toContain('Two by Two');
  });

  it('searches names, lines, kinds and card types, grouped by kind', () => {
    expect(searchStartItems(items, 'bug').flatMap((g) => g.items.map((i) => i.id))).toContain(
      'board:bug-triage',
    );
    const sheets = searchStartItems(items, 'SHEET');
    expect(sheets.map((g) => g.category)).toContain('sheets');
    expect(searchStartItems(items, 'zzz')).toEqual([]);
    expect(searchStartItems(items, '  ')).toEqual([]);
  });
});

describe('Inspiration', () => {
  const items = startItems({ hasCards: false });

  it('offers the Plan templates, Hiring Pipeline first, never Blank Plan', () => {
    const ins = itemsIn(items, 'inspiration');
    expect(ins[0]!.id).toBe('template:hiring-pipeline');
    expect(ins.some((i) => i.id === 'template:blank-plan')).toBe(false);
    expect(ins.every((i) => i.kind === 'template' && i.name && i.line)).toBe(true);
  });

  it('leaves out the one-tab spreadsheet templates, which Spreadsheets already offers', () => {
    const ins = itemsIn(items, 'inspiration').map((i) => i.id);
    for (const kind of ['budget-planner', 'timesheet', 'contact-list', 'invoice'])
      expect(ins, kind).not.toContain(`template:${kind}`);
    expect(ins).toContain('template:kanban');
    // Task Tracker sets up its Sheet and an Overview: more than Spreadsheets offers.
    expect(ins).toContain('template:task-tracker');
  });

  it('finds a template by the Quick Start’s own search words', () => {
    const found = searchStartItems(items, 'recruiting').flatMap((g) => g.items.map((i) => i.id));
    expect(found).toContain('template:hiring-pipeline');
  });

  it('is found by search, as Templates', () => {
    const groups = searchStartItems(items, 'hiring');
    expect(groups.map((g) => g.category)).toContain('inspiration');
  });
});

describe('finding a start by what it is for', () => {
  const items = startItems({ hasCards: false });
  const ids = (q: string) => searchStartItems(items, q).flatMap((g) => g.items.map((i) => i.id));

  it('finds by other names and uses, not only by title', () => {
    expect(ids('recruiting')).toContain('template:hiring-pipeline');
    expect(ids('scrum')).toContain('board:sprint');
    expect(ids('expenses')).toContain('sheet:budget');
    expect(ids('kpi')).toContain('dashboard:overview');
  });

  it('names every choice’s keywords, and counts a template’s tabs', () => {
    expect(items.every((i) => (i.keywords?.length ?? 0) > 0)).toBe(true);
    expect(items.find((i) => i.id === 'template:hiring-pipeline')!.tabs).toBeGreaterThan(1);
  });
});

describe('Inspiration and the template pickers show the same Plan templates', () => {
  it('lists every Plan template the Quick Start and /new offer, Blank Plan and the one-tab spreadsheets aside', () => {
    const planTemplates = TEMPLATES.filter(
      (t) =>
        templateEditorMode(t.kind) === 'plan' &&
        t.kind !== 'blank-plan' &&
        // Forms are Start Planning's own Forms category, as their starters.
        !isFormTemplateKind(t.kind) &&
        !(
          isSpreadsheetPlanTemplate(t.kind as PlanTemplateKind) &&
          planTemplateTabCount(t.kind as PlanTemplateKind) === 1
        ),
    ).map((t) => t.kind);
    expect([...INSPIRATION_TEMPLATES].sort()).toEqual([...planTemplates].sort());
    expect(new Set(INSPIRATION_TEMPLATES).size).toBe(INSPIRATION_TEMPLATES.length);
  });

  it('keeps a spreadsheet template that sets up more than one tab (Task Tracker and its Overview)', () => {
    expect(isSpreadsheetPlanTemplate('task-tracker')).toBe(true);
    expect(planTemplateTabCount('task-tracker')).toBeGreaterThan(1);
    expect(INSPIRATION_TEMPLATES).toContain('task-tracker');
    expect(INSPIRATION_TEMPLATES).not.toContain('invoice');
  });

  it('names and describes each as the pickers do', () => {
    const cards = startItems({ hasCards: false }).filter((i) => i.kind === 'template');
    for (const card of cards) {
      const t = TEMPLATES.find((d) => `template:${d.kind}` === card.id)!;
      expect([card.name, card.line]).toEqual([t.title, t.description]);
    }
  });
});

// docs/specs/007-editor/start-diagramming.md "There is no way out to a bigger picker": every Plan template is on Start
// Planning, as itself (Inspiration), as the sheet it makes (Spreadsheets) or as the form it starts (Forms), but its blank,
// which is the empty Plan tab itself, and Blank Spreadsheet, which Start Planning's Empty Sheet stands for
// (templates-by-mode.md).
describe('every Plan template on Start Planning', () => {
  it('reaches every listed Plan template', () => {
    const items = startItems({ hasCards: false, suggestions: [] });
    const has = (pick: (i: (typeof items)[number]) => unknown) =>
      new Set(items.map(pick).filter(Boolean));
    const templates = has((i) => i.kind === 'template' && i.template);
    const sheets = has((i) => i.kind === 'sheet' && i.start);
    const forms = has((i) => i.kind === 'form' && i.starter);
    const reached = (kind: PlanTemplateKind) =>
      templates.has(kind) ||
      (isFormTemplateKind(kind) && forms.has(formTemplateStarter(kind))) ||
      // A sheet template is offered as the sheet it makes (Budget Planner's Budget sheet).
      (isSpreadsheetPlanTemplate(kind) &&
        sheets.has(TEMPLATE_START_SHEETS[kind as keyof typeof TEMPLATE_START_SHEETS]));
    const missing = TEMPLATES.filter(
      (t) =>
        !t.hidden &&
        templateEditorMode(t.kind) === 'plan' &&
        !['blank-plan', 'blank-spreadsheet'].includes(t.kind) &&
        !reached(t.kind as PlanTemplateKind),
    ).map((t) => t.kind);
    expect(missing).toEqual([]);
  });
});
