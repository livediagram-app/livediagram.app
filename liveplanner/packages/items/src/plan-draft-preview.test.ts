import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  PLAN_DRAFT_COLOURS,
  checkPlanDraft,
  type PlanDraft,
  type PlanDraftPlan,
} from './plan-draft';
import { planDraftProblems, planFromDraft } from './plan-draft-preview';
import { ITEM_TYPES } from './item-types';
import {
  ITEM_TYPE_CATALOGUE_VERSION,
  ITEM_TYPES_MAX,
  type ItemTypeCatalogue,
} from './type-catalogue';

const draft = (): PlanDraft => ({
  title: 'Hiring Pipeline',
  columns: ['Applied', 'Screen', 'Interview', 'Offer'],
  cardTypes: [
    {
      name: 'Candidate',
      color: PLAN_DRAFT_COLOURS[0]!,
      glyph: 'person',
      builtInFields: ['description', 'assignee', 'due'],
      fields: [
        { name: 'Role', kind: 'text' },
        { name: 'Salary Band', kind: 'choice', options: ['A', 'B', 'C'] },
        { name: 'Interview Date', kind: 'date' },
      ],
    },
  ],
});

const EMPTY: PlanDraftPlan = { catalogue: null, statuses: [] };
const DEFAULTS: ItemTypeCatalogue = { version: ITEM_TYPE_CATALOGUE_VERSION, types: ITEM_TYPES };
const steady = () => 0.5;

describe('planDraftProblems', () => {
  it('finds none in a draft that reads', () => {
    expect(planDraftProblems(draft(), EMPTY)).toEqual([]);
    expect(planDraftProblems(draft())).toEqual([]);
  });

  it('says each name left empty, and both of a name given twice, at their places', () => {
    const d = draft();
    d.title = ' ';
    d.columns = ['Applied', '', 'applied '];
    d.cardTypes[0]!.name = '';
    d.cardTypes[0]!.fields[1]!.name = 'role';
    d.cardTypes[0]!.fields[1]!.options = ['A', ' ', 'a'];
    expect(planDraftProblems(d, EMPTY)).toEqual([
      { path: 'title', message: 'Give the board a name.' },
      { path: 'columns.0', message: 'Two columns are called “Applied”.' },
      { path: 'columns.1', message: 'Give this column a name.' },
      { path: 'columns.2', message: 'Two columns are called “Applied”.' },
      { path: 'cardTypes.0.name', message: 'Give this card type a name.' },
      { path: 'cardTypes.0.fields.0.name', message: 'Two fields are called “Role”.' },
      { path: 'cardTypes.0.fields.1.name', message: 'Two fields are called “Role”.' },
      { path: 'cardTypes.0.fields.1.options.0', message: 'Two options are called “A”.' },
      { path: 'cardTypes.0.fields.1.options.1', message: 'Give this option a name.' },
      { path: 'cardTypes.0.fields.1.options.2', message: 'Two options are called “A”.' },
    ]);
  });

  it('asks for a column and a card type when every one is removed', () => {
    expect(planDraftProblems({ ...draft(), columns: [], cardTypes: [] })).toEqual([
      { path: 'columns', message: 'A board needs at least one column.' },
      { path: 'cardTypes', message: 'Keep at least one card type.' },
    ]);
  });

  it('says two card types of one name', () => {
    const d = draft();
    d.cardTypes.push({ ...d.cardTypes[0]!, name: 'candidate' });
    expect(planDraftProblems(d)).toEqual([
      { path: 'cardTypes.0.name', message: 'Two card types are called “Candidate”.' },
      { path: 'cardTypes.1.name', message: 'Two card types are called “Candidate”.' },
    ]);
  });

  it('falls back on the whole check once the names read', () => {
    const d = draft();
    d.columns = Array.from({ length: 13 }, (_, i) => `C${i}`);
    expect(planDraftProblems(d)).toEqual([
      { path: 'columns', message: 'A board has 1 to 12 columns.' },
    ]);
  });

  it('never asks to fix a type the plan already has', () => {
    const d = draft();
    d.cardTypes.push({
      name: 'task',
      color: PLAN_DRAFT_COLOURS[0]!,
      glyph: 'star',
      builtInFields: [],
      fields: [
        { name: '', kind: 'text' },
        { name: 'X', kind: 'text', options: [''] },
      ],
    });
    expect(planDraftProblems(d, { catalogue: DEFAULTS, statuses: [] })).toEqual([]);
  });
});

describe('checkPlanDraft against a plan', () => {
  it('keeps the types the plan has and adds the rest to its catalogue', () => {
    const d = draft();
    d.cardTypes.push({ ...d.cardTypes[0]!, name: 'Note', fields: [] });
    const checked = checkPlanDraft(d, { catalogue: DEFAULTS, statuses: [] });
    expect(checked).toMatchObject({ ok: true, kept: [1] });
    if (!checked.ok) throw new Error('refused');
    expect(checked.changes.map((c) => (c.op === 'add' ? c.name : ''))).toEqual(['Candidate']);
    expect(checked.catalogue!.types.map((t) => t.label)).toEqual([
      ...ITEM_TYPES.map((t) => t.label),
      'Candidate',
    ]);
  });

  it('gives a column named as a status the plan has that status', () => {
    const checked = checkPlanDraft(draft(), {
      catalogue: null,
      statuses: [{ status: 'review-1', name: 'Screen' }],
    });
    if (!checked.ok) throw new Error('refused');
    expect(checked.setup.columns.map((c) => c.status)).toContain('review-1');
  });

  it('skips the caps of a kept type', () => {
    const d = draft();
    d.cardTypes = [
      {
        ...d.cardTypes[0]!,
        name: 'Task',
        fields: Array.from({ length: 9 }, (_, i) => ({ name: `F${i}`, kind: 'text' as const })),
      },
    ];
    expect(checkPlanDraft(d, { catalogue: DEFAULTS, statuses: [] })).toMatchObject({ ok: true });
  });

  it('refuses where the catalogue would break its rules', () => {
    // A plan at the card types' cap has no room for one more.
    const full: ItemTypeCatalogue = {
      version: ITEM_TYPE_CATALOGUE_VERSION,
      types: Array.from({ length: ITEM_TYPES_MAX }, (_, i) => ({
        ...ITEM_TYPES[1],
        id: `t${i}`,
        label: `Type ${i}`,
      })),
    };
    expect(checkPlanDraft(draft(), { catalogue: full, statuses: [] })).toMatchObject({
      ok: false,
      path: 'cardTypes',
    });
  });
});

describe('the preview’s cost', () => {
  it('checks a draft at every cap, on a plan near the types’ cap, well inside a keystroke', () => {
    const big: PlanDraft = {
      title: 'Everything',
      columns: Array.from({ length: 12 }, (_, i) => `Stage ${i}`),
      cardTypes: Array.from({ length: 4 }, (_, i) => ({
        name: `Kind ${i}`,
        color: PLAN_DRAFT_COLOURS[i]!,
        glyph: 'star' as const,
        builtInFields: ['description' as const, 'assignee' as const, 'due' as const],
        fields: Array.from({ length: 8 }, (_, j) => ({
          name: `Field ${j}`,
          kind: 'choice' as const,
          options: Array.from({ length: 8 }, (_, k) => `Option ${k}`),
        })),
      })),
      // Two starter rules of three steps, each read against the draft on every check.
      rules: Array.from({ length: 2 }, (_, i) => ({
        name: `Rule ${i}`,
        on: true,
        trigger: { kind: 'card_moved', from: ['Stage 0'], to: ['Stage 1'] },
        conditions: [{ kind: 'type', types: ['Kind 0'] }],
        steps: [
          { kind: 'set_field', field: 'Field 0', value: { text: 'Option 1' } },
          { kind: 'move', status: 'Stage 2' },
          { kind: 'flag' },
        ],
      })),
    };
    const roomForFour: ItemTypeCatalogue = {
      version: ITEM_TYPE_CATALOGUE_VERSION,
      types: Array.from({ length: ITEM_TYPES_MAX - 4 }, (_, i) => ({
        ...ITEM_TYPES[1],
        id: `t${i}`,
        label: `Type ${i}`,
      })),
    };
    const plan = { catalogue: roomForFour, statuses: [] };
    let problems: ReturnType<typeof planDraftProblems> = [{ path: '', message: '' }];
    // Ten checks, as ten keystrokes would run.
    const ms = cpuMsOf(() => {
      for (let n = 0; n < 10; n++) problems = planDraftProblems(big, plan);
    });
    expect(problems).toEqual([]);
    expect(ms).toBeLessThan(cpuBudgetMs(100));
  });
});

describe('planFromDraft', () => {
  it('makes the board taking every drafted type, and only the new ones to add', () => {
    const d = draft();
    d.cardTypes.push({ ...d.cardTypes[0]!, name: 'note', fields: [] });
    const made = planFromDraft(d, { catalogue: DEFAULTS, statuses: [] }, steady);
    if (!made.ok) throw new Error('refused');
    expect(made.newTypes.map((t) => t.label)).toEqual(['Candidate']);
    const note = ITEM_TYPES.find((t) => t.label === 'Note')!;
    expect(made.setup.addTypes).toEqual([made.newTypes[0]!.id, note.id]);
    expect(made.setup.title).toBe('Hiring Pipeline');
    expect(made.setup.columns.map((c) => c.name)).toEqual([
      'Applied',
      'Screen',
      'Interview',
      'Offer',
    ]);
    // The new type uses the new board's statuses, which carry the fresh suffix.
    expect(made.newTypes[0]!.statuses).toEqual(made.setup.columns.map((c) => c.status));
    expect(made.setup.columns[0]!.status).not.toMatch(/~0000$/);
  });

  it('makes every type on a plan with none chosen', () => {
    const made = planFromDraft(draft(), EMPTY);
    if (!made.ok) throw new Error('refused');
    expect(made.newTypes.map((t) => t.label)).toEqual(['Candidate']);
    expect(made.newTypes[0]!.custom?.map((f) => f.label)).toEqual([
      'Role',
      'Salary Band',
      'Interview Date',
    ]);
  });

  it('refuses a draft that does not read', () => {
    expect(planFromDraft({ ...draft(), columns: [] }, EMPTY)).toMatchObject({
      ok: false,
      path: 'columns',
    });
  });
});
