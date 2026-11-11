// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { createShape, type Tab } from '@liveplanner/project';
import type { FormDefinition } from '@liveplanner/forms';
import type { ItemTypeDef, PlanBoardSetup } from '@liveplanner/items';
import type { FormActions } from '@/hooks/forms/useFormActions';
import { FormBuilderContext, type FormBuilderValue } from './form-builder-context';
import { DestinationPicker } from './DestinationPicker';
import { readDays, readLabels, readNumber } from './fixed-value-parts';

// Responses Go To (docs/specs/030-forms/forms.md "Responses Go To and Settings"): columns follow the card type,
// questions from its fields, and fields set automatically; Extra Columns for a sheet.

afterEach(cleanup);

const WORK: ItemTypeDef = {
  id: 'work-item',
  label: 'Work Item',
  newTitle: 'New work item',
  glyph: 'task',
  color: '#2563eb',
  fields: [
    'title',
    'status',
    'description',
    'priority',
    'due',
    'f-kind',
    'f-areas',
    'f-note',
    'f-n',
  ],
  statuses: ['review', 'selected'],
  custom: [
    { id: 'f-kind', label: 'Kind', kind: 'choice', options: ['Bug', 'Idea'] },
    { id: 'f-areas', label: 'Areas', kind: 'multichoice', options: ['Web', 'Api'] },
    { id: 'f-note', label: 'Note', kind: 'text' },
    { id: 'f-n', label: 'Count', kind: 'number' },
  ],
};

const setup = (columns: [string, string][]): PlanBoardSetup => ({
  title: 'Intake',
  columns: columns.map(([status, name]) => ({ id: status, status, name })),
  swimlaneBy: 'none',
  cardFields: [],
  hideWriting: false,
});

const board = (columns: [string, string][]): Tab => ({
  id: 'b',
  name: 'Intake',
  kind: 'board',
  elements: [{ ...createShape('plan-board', 0, 0), planBoard: setup(columns) }],
});

const MIXED: [string, string][] = [
  ['new', 'New'],
  ['review', 'Under Review'],
  ['selected', 'Selected'],
];

const formWith = (extra: Partial<FormDefinition> = {}): FormDefinition => ({
  v: 1,
  heading: 'Intake',
  sections: [
    {
      id: 's-1',
      title: '',
      questions: [{ id: 'q-1', type: 'short', prompt: 'Name', goesTo: { to: 'title' } }],
    },
  ],
  destination: { tabId: 'b', typeId: 'work-item', status: 'review' },
  ...extra,
});

let latest: FormDefinition;
const addTypeQuestions = vi.fn();

function Harness({ start, tabs }: { start: FormDefinition; tabs: Tab[] }) {
  const [form, setForm] = useState(start);
  useEffect(() => {
    latest = form;
  });
  const actions = {
    changeForm: (fn: (f: FormDefinition) => FormDefinition) => setForm((f) => fn(f)),
    addTypeQuestions,
    setResponsesTo: vi.fn(),
    newResponsesSheet: vi.fn(),
    newResponsesBoard: vi.fn(),
    newCardType: vi.fn(),
    setDestinationType: vi.fn(),
  } as unknown as FormActions;
  const value: FormBuilderValue = {
    form,
    canEdit: true,
    actions,
    selectedId: null,
    select: vi.fn(),
    focusId: null,
    clearFocus: vi.fn(),
    type: form.destination?.typeId === WORK.id ? WORK : undefined,
    types: [WORK],
    openSettings: vi.fn(),
  };
  return (
    <FormBuilderContext.Provider value={value}>
      <DestinationPicker tabs={tabs} />
    </FormBuilderContext.Provider>
  );
}

const chips = () =>
  within(screen.getByRole('radiogroup', { name: 'Column' }))
    .queryAllByRole('radio')
    .map((r) => r.textContent);

describe('columns follow the card type', () => {
  it('offers only the columns the type uses', () => {
    render(<Harness start={formWith()} tabs={[board(MIXED)]} />);
    expect(chips()).toEqual(['Under Review', 'Selected']);
    expect(screen.getByText(/Each response becomes a/).textContent).toContain('Under Review');
  });

  it('warns of a saved column outside the type’s statuses', () => {
    const start = formWith({ destination: { tabId: 'b', typeId: 'work-item', status: 'new' } });
    render(<Harness start={start} tabs={[board(MIXED)]} />);
    expect(screen.getByRole('status').textContent).toBe(
      'Its column isn’t one of Work Item’s states, so its cards miss Work Item’s boards. Choose another column.',
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Selected' }));
    expect(latest.destination?.status).toBe('selected');
  });

  it('says so when the board has no column the type uses', () => {
    const start = formWith({ destination: { tabId: 'b', typeId: 'work-item', status: 'new' } });
    render(<Harness start={start} tabs={[board([['new', 'New']])]} />);
    expect(chips()).toEqual([]);
    expect(screen.getByText('None of these columns is a Work Item state.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('None of Intake’s columns');
  });

  it('takes the first column the type uses on choosing a board', () => {
    const other: Tab = { ...board(MIXED), id: 'b2', name: 'Other' };
    render(<Harness start={formWith()} tabs={[board(MIXED), other]} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Board' }), { target: { value: 'b2' } });
    expect(latest.destination).toEqual({ tabId: 'b2', typeId: 'work-item', status: 'review' });
  });
});

describe('questions from the card type’s fields', () => {
  it('offers the fields no question asks, with their count and names', () => {
    render(<Harness start={formWith()} tabs={[board(MIXED)]} />);
    const add = screen.getByRole('button', { name: /Add Questions for Work Item’s Fields/ });
    expect(add.textContent).toContain('5');
    fireEvent.click(add);
    expect(addTypeQuestions).toHaveBeenCalledTimes(1);
  });
});

describe('Set Automatically', () => {
  const open = () => fireEvent.click(screen.getByRole('button', { name: /Set Automatically/ }));

  it('sets a choice, a priority and a due date, and offers no field twice', () => {
    render(<Harness start={formWith()} tabs={[board(MIXED)]} />);
    open();
    const pick = () => screen.getByRole('combobox', { name: 'Set a Field' });
    fireEvent.change(pick(), { target: { value: 'f-kind' } });
    expect(latest.destination?.fixed).toEqual({ 'f-kind': { value: 'Bug' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Kind' }), { target: { value: 'Idea' } });
    expect(latest.destination?.fixed?.['f-kind']).toEqual({ value: 'Idea' });
    fireEvent.change(pick(), { target: { value: 'priority' } });
    expect(latest.destination?.fixed?.['priority']).toEqual({ value: 'medium' });
    fireEvent.change(pick(), { target: { value: 'due' } });
    expect(latest.destination?.fixed?.['due']).toMatchObject({ submitted: { days: 0 } });
    const days = screen.getByRole('textbox', { name: /days after submitting/ });
    fireEvent.change(days, { target: { value: '7' } });
    fireEvent.blur(days);
    expect(latest.destination?.fixed?.['due']).toMatchObject({ submitted: { days: 7 } });
    const options = within(pick())
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).not.toContain('Kind');
    expect(options.some((o) => o?.startsWith('Due'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Stop Setting Kind' }));
    expect(latest.destination?.fixed).not.toHaveProperty('f-kind');
  });

  it('waits for a typed value, and toggles picks keeping one', () => {
    render(<Harness start={formWith()} tabs={[board(MIXED)]} />);
    open();
    const pick = () => screen.getByRole('combobox', { name: 'Set a Field' });
    fireEvent.change(pick(), { target: { value: 'f-note' } });
    expect(latest.destination?.fixed).toBeUndefined();
    expect(screen.getByText('Type a value to set it.')).toBeTruthy();
    const note = screen.getByRole('textbox', { name: 'Note' });
    fireEvent.change(note, { target: { value: 'From the intake form' } });
    fireEvent.blur(note);
    expect(latest.destination?.fixed?.['f-note']).toEqual({ value: 'From the intake form' });
    fireEvent.change(pick(), { target: { value: 'f-areas' } });
    const web = screen.getByRole('checkbox', { name: 'Web' });
    expect(web.hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Api' }));
    expect(latest.destination?.fixed?.['f-areas']).toEqual({ value: ['Web', 'Api'] });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Web' }));
    expect(latest.destination?.fixed?.['f-areas']).toEqual({ value: ['Api'] });
  });

  it('opens on a value its field no longer has, saying so', () => {
    const start = formWith({
      destination: {
        tabId: 'b',
        typeId: 'work-item',
        status: 'review',
        fixed: { 'f-kind': { value: 'Gone' }, 'f-old': { value: 'x' } },
      },
    });
    render(<Harness start={start} tabs={[board(MIXED)]} />);
    expect(
      screen.getByText('Its value is no longer one this field has: choose again.'),
    ).toBeTruthy();
    expect(screen.getByText('Its field is no longer on Work Item cards.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stop Setting It' }));
    expect(latest.destination?.fixed).toEqual({ 'f-kind': { value: 'Gone' } });
  });
});

describe('Extra Columns', () => {
  const sheetTab: Tab = {
    id: 'st',
    name: 'Responses',
    kind: 'sheet',
    elements: [{ ...createShape('plan-sheet', 0, 0), planSheet: { sheetId: 'AAAAAAAAAAA1' } }],
  };
  it('adds a submitted date column, and changes it to text', () => {
    const start = formWith({ sheet: { tabId: 'st', sheetId: 'AAAAAAAAAAA1' } });
    render(<Harness start={start} tabs={[sheetTab]} />);
    fireEvent.click(screen.getByRole('button', { name: /Extra Columns/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Column' }));
    expect(latest.sheet?.fixed).toEqual([
      expect.objectContaining({
        header: 'Extra Column',
        submitted: expect.objectContaining({ days: 0 }),
      }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Add Column' }));
    expect(latest.sheet?.fixed?.[1]?.header).toBe('Extra Column 2');
    const [kind] = screen.getAllByRole('combobox', { name: /what it holds/ });
    fireEvent.change(kind!, { target: { value: 'text' } });
    expect(screen.getByText('Type a value to use it.')).toBeTruthy();
    const value = screen.getByRole('textbox', { name: 'Extra Column: its value' });
    fireEvent.change(value, { target: { value: 'Web' } });
    fireEvent.blur(value);
    expect(latest.sheet?.fixed?.[0]).toMatchObject({ header: 'Extra Column', value: 'Web' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Extra Column 2' }));
    expect(latest.sheet?.fixed).toHaveLength(1);
  });
});

describe('what is typed', () => {
  it('reads days, labels and numbers', () => {
    expect(readDays('')).toBe(0);
    expect(readDays(' 7 ')).toBe(7);
    expect(readDays('1.5')).toBeNull();
    expect(readDays('400')).toBeNull();
    expect(readLabels(' a, ,b ')).toEqual(['a', 'b']);
    expect(readNumber('3.5')).toBe(3.5);
    expect(readNumber(' ')).toBeNull();
    expect(readNumber('x')).toBeNull();
  });
});
