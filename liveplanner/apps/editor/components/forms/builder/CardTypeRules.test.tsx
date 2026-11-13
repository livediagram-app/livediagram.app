// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { createShape, type Tab } from '@liveplanner/project';
import type { CardTypeRule, FormDefinition } from '@liveplanner/forms';
import type { ItemTypeDef, PlanBoardSetup } from '@liveplanner/items';
import type { FormActions } from '@/hooks/forms/useFormActions';
import { FormBuilderContext, type FormBuilderValue } from './form-builder-context';
import { DestinationPicker } from './DestinationPicker';

// Card Type by Answer (docs/specs/030-forms/forms.md "Choosing the card type by an answer"): offered only with more
// than one type on the board and a choice question, a rule added, its answers and type picked, its own fields mapped,
// and a broken rule said in amber.

afterEach(cleanup);

const type = (id: string, label: string, extra: Partial<ItemTypeDef> = {}): ItemTypeDef => ({
  id,
  label,
  newTitle: `New ${label}`,
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', 'status'],
  ...extra,
});
const TASK = type('task', 'Task');
const BUG = type('bug', 'Bug', {
  fields: ['title', 'status', 'f-steps'],
  statuses: ['triage'],
  custom: [{ id: 'f-steps', label: 'Steps', kind: 'longtext' }],
});
const FEATURE = type('feature', 'Feature');

const board = (addTypes?: string[]): Tab => ({
  id: 'b',
  name: 'Requests',
  kind: 'board',
  elements: [
    {
      ...createShape('plan-board', 0, 0),
      planBoard: {
        title: 'Requests',
        columns: [
          { id: 'new', status: 'new', name: 'New' },
          { id: 'triage', status: 'triage', name: 'Triage' },
        ],
        swimlaneBy: 'none',
        cardFields: [],
        hideWriting: false,
        ...(addTypes ? { addTypes } : {}),
      } satisfies PlanBoardSetup,
    },
  ],
});

const formWith = (rules?: CardTypeRule[], choice = true): FormDefinition => ({
  v: 1,
  heading: 'Requests',
  sections: [
    {
      id: 's-1',
      title: '',
      questions: [
        { id: 'q-1', type: 'short', prompt: 'Summary', goesTo: { to: 'title' } },
        ...(choice
          ? [
              {
                id: 'q-kind',
                type: 'single' as const,
                prompt: 'Request type',
                options: ['Bug', 'Feature'],
                dropdown: true as const,
              },
            ]
          : []),
        { id: 'q-what', type: 'paragraph', prompt: 'Details' },
      ],
    },
  ],
  destination: {
    tabId: 'b',
    typeId: 'task',
    status: 'new',
    ...(rules ? { typeRules: rules } : {}),
  },
});

let latest: FormDefinition;

function Harness({ start, tabs }: { start: FormDefinition; tabs: Tab[] }) {
  const [form, setForm] = useState(start);
  useEffect(() => {
    latest = form;
  });
  const actions = {
    changeForm: (fn: (f: FormDefinition) => FormDefinition) => setForm((f) => fn(f)),
  } as unknown as FormActions;
  const value: FormBuilderValue = {
    form,
    canEdit: true,
    actions,
    selectedId: null,
    select: vi.fn(),
    focusId: null,
    clearFocus: vi.fn(),
    type: TASK,
    types: [TASK, BUG, FEATURE],
    openSettings: vi.fn(),
  };
  return (
    <FormBuilderContext.Provider value={value}>
      <DestinationPicker tabs={tabs} />
    </FormBuilderContext.Provider>
  );
}

const open = () => fireEvent.click(screen.getByRole('button', { name: /Card Type by Answer/ }));

describe('Card Type by Answer', () => {
  it('is hidden while the board takes one type, or the form has no choice question', () => {
    render(<Harness start={formWith()} tabs={[board(['task'])]} />);
    expect(screen.queryByText('Card Type by Answer')).toBeNull();
    cleanup();
    render(<Harness start={formWith(undefined, false)} tabs={[board()]} />);
    expect(screen.queryByText('Card Type by Answer')).toBeNull();
    // The destination reads as it always did.
    expect(screen.getByText(/Each response becomes a/)).toBeTruthy();
  });

  it('adds a rule, picks its answers, type and column, and maps its type’s own fields', () => {
    render(<Harness start={formWith()} tabs={[board()]} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Add Rule' }));
    expect(latest.destination!.typeRules).toEqual([
      {
        id: expect.stringMatching(/^r-/),
        questionId: 'q-kind',
        anyOf: ['Bug'],
        typeId: 'bug',
        status: 'triage',
      },
    ]);
    // The default now covers every other answer.
    expect(screen.getByText(/Otherwise, each response becomes a/)).toBeTruthy();
    // A rule keeps one answer; a second is added.
    fireEvent.click(screen.getByRole('button', { name: 'Bug', pressed: true }));
    expect(latest.destination!.typeRules![0]!.anyOf).toEqual(['Bug']);
    fireEvent.click(screen.getByRole('button', { name: 'Feature', pressed: false }));
    expect(latest.destination!.typeRules![0]!.anyOf).toEqual(['Bug', 'Feature']);
    // Bug uses Triage alone, so the rule's column offers it alone.
    const cols = within(screen.getByRole('radiogroup', { name: 'Rule column' }));
    expect(cols.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Triage']);
    fireEvent.change(screen.getByRole('combobox', { name: 'Details goes to' }), {
      target: { value: 'f-steps' },
    });
    expect(latest.destination!.typeRules![0]!.fields).toEqual({ 'q-what': 'f-steps' });
    // Changing the rule's type clears its fields, and keeps the column while the new type uses it.
    fireEvent.change(screen.getByRole('combobox', { name: 'Card type' }), {
      target: { value: 'feature' },
    });
    expect(latest.destination!.typeRules![0]).toMatchObject({
      typeId: 'feature',
      status: 'triage',
    });
    expect(latest.destination!.typeRules![0]).not.toHaveProperty('fields');
    // The preview switches between the default and the rule's type.
    fireEvent.click(screen.getByRole('button', { name: /What a Response Makes/ }));
    expect(
      within(screen.getByRole('radiogroup', { name: 'Preview card type' }))
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['Task', 'Feature']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Rule' }));
    expect(latest.destination).not.toHaveProperty('typeRules');
  });

  it('says why a broken rule is skipped, open at first, and stays in view', () => {
    const rule: CardTypeRule = {
      id: 'r-1',
      questionId: 'q-gone',
      anyOf: ['Bug'],
      typeId: 'bug',
      status: 'triage',
    };
    render(<Harness start={formWith([rule], false)} tabs={[board()]} />);
    expect(
      screen.getByText(/question was removed or changed: responses use the default/),
    ).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Question' })).toHaveProperty('value', '');
  });
});
