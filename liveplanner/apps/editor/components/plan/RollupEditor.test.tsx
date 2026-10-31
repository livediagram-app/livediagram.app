// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  currencyText,
  dayLabel,
  type CustomFieldDef,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import type { FormulaDraft } from './FormulaEditor';
import { RollupEditor, rollupPatch, type RollupDraftField } from './RollupEditor';
import { CustomFieldForm, calculationPatch } from './ItemTypeFieldForms';
import { addedField } from './AddFieldShape';
import { READINESS_HINT, kindReadiness } from './add-field-kinds';

// docs/specs/026-plan/item-types.md "Rollup and Lookup fields", In the type editor: Through, Calculate and Field
// menus listing only what fits, the result taken from what it reads, a line saying what it works out, and the
// Preview on a real card.

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const plan = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('./PlanContext', () => ({ usePlan: () => plan.value }));

afterEach(() => {
  cleanup();
  plan.value = null;
});

const by = { id: 'p', name: 'Priya', color: '#7c3aed' };
const card = (id: string, key: number, type: string, fields: Item['fields']): Item => ({
  id,
  type,
  key,
  rank: 'i',
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});
const project: ItemTypeDef = {
  id: 'project',
  label: 'Project',
  newTitle: 'New project',
  glyph: 'project',
  color: '#18181b',
  fields: ['title', 'status', 'due'],
  custom: [],
};
const task: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#71717a',
  fields: ['title', 'status', 'due', 'parent', 'f-cost', 'f-prog'],
  custom: [
    { id: 'parent', label: 'Parent', kind: 'card', linkType: 'project' },
    { id: 'f-cost', label: 'Cost', kind: 'currency', currency: 'USD' },
    { id: 'f-prog', label: 'Progress', kind: 'percent' },
  ],
};
const projectDraft: FormulaDraft = { typeId: 'project', fields: project.fields, custom: [] };
const taskDraft: FormulaDraft = { typeId: 'task', fields: task.fields, custom: task.custom! };
const withPlan = (items: Item[] = []) => {
  plan.value = {
    items: new Map(items.map((i) => [i.id, i])),
    types: [project, task],
    statusPhases: new Map([['done', 'done']]),
  };
};
const cards = () => [
  card('p1', 1, 'project', { title: 'Empty' }),
  card('p2', 2, 'project', { title: 'Website', due: '2026-12-01' }),
  card('t1', 3, 'task', { title: 'A', parent: 'p2', 'f-cost': 12.5, status: 'done' }),
  card('t2', 4, 'task', { title: 'B', parent: 'p2', 'f-cost': 7.5 }),
];

function Harness({ start, draft }: { start: RollupDraftField; draft: FormulaDraft }) {
  const [field, setField] = useState<RollupDraftField>(start);
  return (
    <>
      <RollupEditor
        field={field}
        draft={draft}
        onChange={(patch) => setField((f) => ({ ...f, ...patch }))}
      />
      <pre data-testid="field">{JSON.stringify(field)}</pre>
    </>
  );
}
const stored = () => JSON.parse(screen.getByTestId('field').textContent ?? '{}') as CustomFieldDef;
const pick = (label: string, value: string) =>
  fireEvent.change(screen.getByRole('combobox', { name: label }), { target: { value } });
const rollup: RollupDraftField = { label: 'Total', kind: 'calculated', calculation: 'rollup' };
const lookup: RollupDraftField = { label: 'Due', kind: 'calculated', calculation: 'lookup' };

describe('Rollup', () => {
  it('picks Through, Calculate and Field, takes the result, and previews on a card with a value', () => {
    withPlan(cards());
    render(<Harness start={rollup} draft={projectDraft} />);
    expect(screen.getByRole('status').textContent).toContain(
      'Pick a Number, Currency, Rating, Estimate or Duration field to read.',
    );
    expect(screen.getByLabelText('Preview').textContent).toContain('Waiting for a field to read');
    pick('Through', 'parent');
    pick('Field', 'f-cost');
    expect(stored()).toMatchObject({
      through: 'parent',
      aggregate: 'sum',
      source: 'f-cost',
      result: 'currency',
      currency: 'USD',
    });
    expect(screen.getByRole('status').textContent).toContain(
      'Sums Cost over the Task cards linking here through Parent.',
    );
    // The first live Project with a value, not the first one.
    expect(screen.getByLabelText('Preview').textContent).toContain(
      `On #2 Website${currencyText(20, 'USD')}`,
    );
    pick('Calculate', 'countDone');
    expect(stored()).not.toHaveProperty('source');
    expect(stored()).toMatchObject({ aggregate: 'countDone' });
    expect(screen.queryByRole('combobox', { name: 'Field' })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain(
      'Counts the done ones of the Task cards linking here through Parent.',
    );
    expect(screen.getByLabelText('Preview').textContent).toContain('On #2 Website1');
    pick('Through', '');
    expect(stored().through).toBeUndefined();
  });

  it('drops a field that no longer fits, and a Percent bar without a share', () => {
    const avg = {
      ...rollup,
      aggregate: 'average' as const,
      source: 'f-prog',
      result: 'percent' as const,
    };
    expect(rollupPatch({ ...avg, showAs: 'percent' }, project, [project, task])).toMatchObject({
      result: 'percent',
    });
    expect(
      rollupPatch({ ...avg, aggregate: 'sum', showAs: 'percent' }, project, [project, task]),
    ).toMatchObject({ source: undefined, result: undefined, showAs: undefined });
  });

  it('says when nothing links here yet', () => {
    withPlan();
    render(<Harness start={rollup} draft={taskDraft} />);
    expect(screen.queryByRole('combobox', { name: 'Through' })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain(
      'No Link to Card field links here yet',
    );
  });

  it('says when no field fits, and reads without a plan', () => {
    render(<Harness start={{ ...rollup, aggregate: 'latest' }} draft={projectDraft} />);
    expect(screen.getByRole('status').textContent).toContain(
      'Pick a Date, Start Date or Due Date field to read.',
    );
    cleanup();
    withPlan();
    const bare: ItemTypeDef = { ...task, fields: ['title', 'parent'] };
    plan.value = { items: new Map(), types: [project, bare], statusPhases: new Map() };
    render(<Harness start={{ ...rollup, aggregate: 'latest' }} draft={projectDraft} />);
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Field' }).disabled).toBe(true);
    expect(screen.getByRole('combobox', { name: 'Field' }).textContent).toContain('No field fits');
    expect(screen.getByLabelText('Preview').textContent).toContain(
      'No Project card to try it on yet',
    );
  });
});

describe('Lookup', () => {
  it('reads through one of the type’s Card fields and shows a field of the linked card', () => {
    withPlan(cards());
    render(<Harness start={lookup} draft={taskDraft} />);
    expect(screen.getByRole('status').textContent).toContain(
      'Pick the Link to Card field to read through.',
    );
    expect(screen.queryByRole('combobox', { name: 'Field' })).toBeNull();
    pick('Through', 'parent');
    expect(screen.getByRole('status').textContent).toContain(
      'Pick a field of the card Parent links to.',
    );
    pick('Field', 'due');
    expect(stored()).toMatchObject({ through: 'parent', source: 'due', result: 'date' });
    expect(screen.getByRole('status').textContent).toContain(
      'Shows Due Date of the card Parent links to.',
    );
    expect(screen.getByLabelText('Preview').textContent).toContain(
      `On #3 A${dayLabel('2026-12-01', 'medium')}`,
    );
  });

  it('asks for a Link to Card field first when the type has none', () => {
    withPlan();
    render(<Harness start={lookup} draft={projectDraft} />);
    expect(screen.getByRole('status').textContent).toContain('Add a Link to Card field first');
    expect(screen.getByLabelText('Preview').textContent).toContain(
      'No Project card to try it on yet',
    );
  });
});

describe('in the forms', () => {
  it('picking Rollup or Lookup clears a Formula, and another calculation clears their settings', () => {
    expect(calculationPatch('rollup')).toMatchObject({ calculation: 'rollup', formula: undefined });
    expect(calculationPatch('childCount')).toMatchObject({
      through: undefined,
      aggregate: undefined,
      source: undefined,
      showAs: undefined,
    });
    expect(calculationPatch('formula')).toMatchObject({ through: undefined, result: undefined });
  });

  it('Add waits for what each needs, and keeps only their settings', () => {
    expect(kindReadiness(lookup)).toBe('through');
    expect(kindReadiness({ ...lookup, through: 'parent' })).toBe('source');
    expect(kindReadiness(rollup)).toBe('source');
    expect(kindReadiness({ ...rollup, aggregate: 'count' })).toBeNull();
    expect(READINESS_HINT.source).toBe('Pick a field to read.');
    expect(
      addedField({
        ...rollup,
        aggregate: 'sum',
        source: 'f-cost',
        result: 'currency',
        currency: 'USD',
      }),
    ).toMatchObject({ source: 'f-cost', result: 'currency', currency: 'USD' });
    expect(
      addedField({ label: 'N', kind: 'number', through: 'x', source: 'y', result: 'date' }),
    ).toEqual(
      expect.objectContaining({ through: undefined, source: undefined, result: undefined }),
    );
  });

  it('a field form shows the Rollup editor in place', () => {
    withPlan(cards());
    render(
      <CustomFieldForm
        field={{ ...rollup, id: 'f-total' }}
        onChange={() => {}}
        formulaDraft={projectDraft}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Calculate' })).toBeTruthy();
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Calculation' }).value).toBe(
      'rollup',
    );
  });
});
