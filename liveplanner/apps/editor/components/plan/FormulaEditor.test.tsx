// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { CustomFieldDef, Item, ItemTypeDef } from '@liveplanner/items';
import { FormulaEditor, type FormulaDraft } from './FormulaEditor';
import { CustomFieldForm, calculationPatch } from './ItemTypeFieldForms';
import { addedField } from './AddFieldShape';
import { READINESS_HINT, kindReadiness } from './add-field-kinds';

// docs/specs/026-plan/item-types.md "Formula fields", In the type editor: the formula is checked as it is typed,
// kept with ids, names and functions write themselves at the caret, and the preview works it out on a real card.

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const plan = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('./PlanContext', () => ({ usePlan: () => plan.value }));

afterEach(() => {
  cleanup();
  plan.value = null;
});

const by = { id: 'p', name: 'Priya', color: '#7c3aed' };
const card = (
  id: string,
  key: number,
  fields: Item['fields'],
  extra: Partial<Item> = {},
): Item => ({
  id,
  type: 'deal',
  key,
  rank: 'i',
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
  ...extra,
});
const custom: CustomFieldDef[] = [
  { id: 'f-budget', label: 'Budget', kind: 'currency' },
  { id: 'f-spent', label: 'Spent', kind: 'currency' },
  { id: 'f-done', label: 'Done (%)', kind: 'number' },
];
const deal: ItemTypeDef = {
  id: 'deal',
  label: 'Deal',
  newTitle: 'New deal',
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', 'status', 'f-budget', 'f-spent', 'f-done'],
  custom,
};
const draft: FormulaDraft = { typeId: 'deal', fields: deal.fields, custom };
const withPlan = (items: Item[]) => {
  plan.value = {
    items: new Map(items.map((i) => [i.id, i])),
    types: [deal],
    statusPhases: new Map(),
  };
};

// The editor holding its field as a form would, its patches applied.
function Harness({ start, keep }: { start: Partial<CustomFieldDef>; keep: boolean }) {
  const [field, setField] = useState<Partial<CustomFieldDef>>(start);
  return (
    <>
      <FormulaEditor
        field={field}
        draft={draft}
        keepLastWorking={keep}
        onChange={(patch) => setField((f) => ({ ...f, ...patch }))}
        currencySelect={<span>Currency menu</span>}
      />
      <pre data-testid="field">{JSON.stringify(field)}</pre>
    </>
  );
}
const stored = (): Partial<CustomFieldDef> => {
  const json: unknown = JSON.parse(screen.getByTestId('field').textContent);
  return json as Partial<CustomFieldDef>;
};
const box = () => screen.getByLabelText<HTMLTextAreaElement>('Formula');
const type = (text: string) => fireEvent.change(box(), { target: { value: text } });

describe('FormulaEditor', () => {
  it('shows a stored formula with names, checks it as typed, and keeps it with ids', () => {
    withPlan([card('a', 3, { title: 'Acme', 'f-budget': 5000, 'f-spent': 2000 })]);
    render(<Harness start={{ id: 'f-left', formula: '{f-budget} - {f-spent}' }} keep={false} />);
    expect(box().value).toBe('Budget - Spent');
    expect(screen.getByRole('status').textContent).toBe('Works');
    expect(screen.getByLabelText('Preview').textContent).toContain('On #3 Acme3,000');
    type('Budget - Spnt');
    expect(screen.getByRole('status').textContent).toBe('Unknown field "Spnt" at 10');
    expect(box().getAttribute('aria-invalid')).toBe('true');
    expect(stored().formula).toBe(undefined);
    expect(screen.getByLabelText('Preview').textContent).toContain(
      'Waiting for a formula that works',
    );
    type('Budget * 2');
    expect(stored().formula).toBe('{f-budget} * 2');
  });

  it('keeps an existing field’s last working formula, saying so', () => {
    render(<Harness start={{ id: 'f-left', formula: '{f-budget}' }} keep />);
    type('Budget +');
    expect(screen.getByRole('status').textContent).toBe('Not saved: Expected a value at 9');
    expect(stored().formula).toBe('{f-budget}');
    type('');
    expect(screen.getByRole('status').textContent).toBe('Write a formula, such as Budget - Spent.');
  });

  it('writes a field or a function at the caret, a name in braces when it needs them', () => {
    render(<Harness start={{}} keep={false} />);
    type('1 + ');
    box().setSelectionRange(4, 4);
    fireEvent.click(screen.getByRole('button', { name: 'Done (%)' }));
    expect(box().value).toBe('1 + {Done (%)}');
    expect(box().selectionStart).toBe(14);
    box().setSelectionRange(0, 0);
    fireEvent.click(screen.getByRole('button', { name: 'round' }));
    expect(box().value).toBe('round(1 + {Done (%)}');
    // The field itself is never offered.
    render(<Harness start={{ id: 'f-budget' }} keep={false} />);
    expect(screen.getAllByRole('button', { name: 'Budget' })).toHaveLength(1);
  });

  it('picks a result, with the currency menu for a Currency result', () => {
    withPlan([card('a', 1, { title: 'Acme', 'f-budget': 10, 'f-spent': 3 })]);
    render(<Harness start={{ formula: '{f-spent} / {f-budget} * 100' }} keep={false} />);
    expect(screen.queryByText('Currency menu')).toBeNull();
    fireEvent.change(screen.getByLabelText('Result'), { target: { value: 'percent' } });
    expect(stored().result).toBe('percent');
    expect(screen.getByLabelText('Preview').textContent).toContain('30%');
    fireEvent.change(screen.getByLabelText('Result'), { target: { value: 'currency' } });
    expect(screen.getByText('Currency menu')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Result'), { target: { value: 'number' } });
    expect(stored().result).toBe(undefined);
  });

  it('previews on the type’s first live card: its problem, no value, or why there is none', () => {
    withPlan([
      card('gone', 1, { title: 'Old', status: 'trash' }),
      card('b', 4, { title: '' }),
      card('c', 2, { title: 'Zed', 'f-budget': 1 }),
    ]);
    const { unmount } = render(<Harness start={{ formula: '{f-budget} / 0' }} keep={false} />);
    expect(screen.getByLabelText('Preview').textContent).toContain('On #2 Zed');
    expect(screen.getByLabelText('Preview').textContent).toContain('Divides by 0');
    type('Spent');
    expect(screen.getByLabelText('Preview').textContent).toContain('No value');
    unmount();
    withPlan([]);
    render(<Harness start={{}} keep={false} />);
    expect(screen.getByLabelText('Preview').textContent).toContain('No Deal card to try it on yet');
  });

  it('says a new type has no card yet, without a plan', () => {
    render(
      <FormulaEditor
        field={{}}
        draft={{ fields: ['title', 'status'], custom: [] }}
        keepLastWorking={false}
        onChange={() => {}}
        currencySelect={null}
      />,
    );
    expect(screen.getByLabelText('Preview').textContent).toContain(
      'No card of this type to try it on yet',
    );
  });
});

describe('the field form and Add Field', () => {
  it('opens the formula editor on picking Formula, and drops it on picking another', () => {
    const onChange = vi.fn();
    const field: CustomFieldDef = {
      id: 'f-x',
      label: 'X',
      kind: 'calculated',
      calculation: 'childCount',
    };
    const { rerender } = render(
      <CustomFieldForm field={field} onChange={onChange} formulaDraft={draft} />,
    );
    expect(screen.queryByLabelText('Formula')).toBeNull();
    fireEvent.change(screen.getByLabelText('Calculation'), { target: { value: 'formula' } });
    expect(onChange).toHaveBeenLastCalledWith({ calculation: 'formula' });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'FieldFormula');
    rerender(
      <CustomFieldForm
        field={{ ...field, calculation: 'formula' }}
        onChange={onChange}
        formulaDraft={draft}
      />,
    );
    expect(screen.getByLabelText('Formula')).toBeTruthy();
    expect(screen.getByText(/own fields by a formula/)).toBeTruthy();
    act(() => {
      fireEvent.change(screen.getByLabelText('Calculation'), { target: { value: 'childCount' } });
    });
    expect(onChange).toHaveBeenLastCalledWith(calculationPatch('childCount'));
    expect(calculationPatch('childCount')).toEqual({
      calculation: 'childCount',
      formula: undefined,
      result: undefined,
      currency: undefined,
    });
  });

  it('waits for a working formula before adding, and keeps only a Formula’s settings', () => {
    const base = { label: 'Left', kind: 'calculated' as const, calculation: 'formula' as const };
    expect(kindReadiness(base)).toBe('formula');
    expect(READINESS_HINT.formula).toBe('Write a formula that works.');
    expect(kindReadiness({ ...base, formula: '1' })).toBe(null);
    expect(
      addedField({ ...base, formula: '1', result: 'currency', currency: 'EUR' }),
    ).toMatchObject({
      formula: '1',
      result: 'currency',
      currency: 'EUR',
    });
    expect(
      addedField({
        ...base,
        calculation: 'childCount',
        formula: '1',
        result: 'text',
        currency: 'EUR',
      }),
    ).toMatchObject({ formula: undefined, result: undefined, currency: undefined });
  });
});
