// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createShape, type Tab } from '@liveplanner/project';
import { questionsOf, readForm, type FormDefinition } from '@liveplanner/forms';
import type { ItemTypeDef, PlanBoardSetup } from '@liveplanner/items';
import { boardsOf } from '@liveplanner/templates';
import { useFormActions } from './useFormActions';

// Card types and a form (docs/specs/030-forms/forms.md "Columns follow the card type", "Questions from the card
// type's fields", "Filled in automatically"): picking a type moves the column and fills an empty form, + New Board
// follows the type's statuses.

const type = (id: string, extra: Partial<ItemTypeDef> = {}): ItemTypeDef => ({
  id,
  label: id === 'work' ? 'Work Item' : 'Bug',
  newTitle: 'New',
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', 'status', 'description', 'f-sev'],
  custom: [{ id: 'f-sev', label: 'Severity', kind: 'choice', options: ['Low', 'High'] }],
  ...extra,
});
const BUG = type('bug');
const WORK = type('work', { statuses: ['review', 'ready'] });

const setup: PlanBoardSetup = {
  title: 'Intake',
  columns: [
    { id: 'new', status: 'new', name: 'New' },
    { id: 'review', status: 'review', name: 'Under Review', color: '#ff0000' },
    { id: 'ready', status: 'ready', name: 'Ready' },
  ],
  swimlaneBy: 'none',
  cardFields: [],
  hideWriting: false,
};
const board: Tab = {
  id: 'b',
  name: 'Intake',
  kind: 'board',
  elements: [{ ...createShape('plan-board', 0, 0), planBoard: setup }],
};
const formTab = (form: Partial<FormDefinition>): Tab => ({
  id: 'f',
  name: 'Intake',
  kind: 'form',
  elements: [],
  form: {
    v: 1,
    heading: 'Intake',
    sections: [{ id: 's-1', title: '', questions: [] }],
    destination: {
      tabId: 'b',
      typeId: 'bug',
      status: 'new',
      fixed: { 'f-sev': { value: 'High' }, due: { submitted: { days: 1 } } },
    },
    ...form,
  },
});

function actionsOn(tabs: Tab[]) {
  let now = tabs;
  const commits: Tab[][] = [];
  const saveType = vi.fn();
  const { result } = renderHook(() =>
    useFormActions({
      activeId: 'f',
      tabs,
      commitTabs: (map) => {
        now = map(now);
        commits.push(now);
      },
      tickTabs: (map) => (now = map(now)),
      itemTypes: { types: [BUG, WORK], saveType },
      statusNames: new Map([
        ['new', 'New'],
        ['review', 'Under Review'],
        ['ready', 'Ready'],
      ]),
    }),
  );
  const form = () => readForm(now.find((t) => t.id === 'f')!.form)!;
  return { actions: result.current, form, commits, tabs: () => now, saveType };
}

describe('setDestinationType', () => {
  it('moves the column to one the type uses and fills an empty form in a step of its own', () => {
    const { actions, form, commits } = actionsOn([formTab({}), board]);
    actions.setDestinationType('work');
    expect(commits).toHaveLength(2);
    // The first step changes the type alone, so Undo takes the questions back and leaves it chosen.
    expect(questionsOf(readForm(commits[0]!.find((t) => t.id === 'f')!.form)!)).toEqual([]);
    expect(form().destination).toMatchObject({ typeId: 'work', status: 'review' });
    // The set values whose field the new type has stay.
    expect(form().destination?.fixed).toEqual({ 'f-sev': { value: 'High' } });
    // Severity is set automatically, so no question asks it.
    expect(questionsOf(form()).map((q) => q.prompt)).toEqual(['Title', 'Description']);
  });

  it('never adds to a form that has questions, nor rewrites them', () => {
    const q = { id: 'q-1', type: 'short' as const, prompt: 'Name' };
    const { actions, form, commits } = actionsOn([
      formTab({ sections: [{ id: 's-1', title: '', questions: [q] }] }),
      board,
    ]);
    actions.setDestinationType('work');
    expect(commits).toHaveLength(1);
    expect(questionsOf(form())).toEqual([q]);
  });

  it('keeps a column the new type uses, and drops set values none of whose fields it has', () => {
    const { actions, form } = actionsOn([
      formTab({
        destination: {
          tabId: 'b',
          typeId: 'work',
          status: 'ready',
          fixed: { due: { submitted: { days: 1 } } },
        },
      }),
      board,
    ]);
    actions.setDestinationType('bug');
    expect(form().destination).toEqual({ tabId: 'b', typeId: 'bug', status: 'ready' });
  });
});

describe('setDestinationBoard', () => {
  const other: Tab = { ...board, id: 'b2', name: 'Other' };
  const sheetTab: Tab = { id: 's', name: 'Sheet', kind: 'sheet', elements: [] };

  it('takes the board’s first type, its first column that type uses, then the questions as a step of its own', () => {
    const { actions, form, commits } = actionsOn([
      formTab({ destination: undefined }),
      {
        ...board,
        elements: [
          { ...createShape('plan-board', 0, 0), planBoard: { ...setup, addTypes: ['work'] } },
        ],
      },
    ]);
    actions.setDestinationBoard('b');
    expect(commits).toHaveLength(2);
    // The first step chooses the board alone, so Undo takes the questions back and leaves it chosen.
    const first = readForm(commits[0]!.find((t) => t.id === 'f')!.form)!;
    expect(first.destination).toEqual({ tabId: 'b', typeId: 'work', status: 'review' });
    expect(questionsOf(first)).toEqual([]);
    expect(questionsOf(form()).map((q) => q.prompt)).toEqual(['Title', 'Description', 'Severity']);
  });

  it('keeps the type and its set values while the board takes it', () => {
    const { actions, form } = actionsOn([formTab({}), board, other]);
    actions.setDestinationBoard('b2');
    expect(form().destination).toMatchObject({
      tabId: 'b2',
      typeId: 'bug',
      status: 'new',
      fixed: { 'f-sev': { value: 'High' } },
    });
    // Severity is set automatically, so no question asks it.
    expect(questionsOf(form()).map((q) => q.prompt)).toEqual(['Title', 'Description']);
  });

  it('drops set values when the type changes with the board', () => {
    const onlyWork: Tab = {
      ...other,
      elements: [
        { ...createShape('plan-board', 0, 0), planBoard: { ...setup, addTypes: ['work'] } },
      ],
    };
    const { actions, form } = actionsOn([formTab({}), board, onlyWork]);
    actions.setDestinationBoard('b2');
    expect(form().destination).toEqual(
      expect.objectContaining({ tabId: 'b2', typeId: 'work', status: 'review' }),
    );
    expect(form().destination).not.toHaveProperty('fixed');
  });

  it('never adds to a form that has questions', () => {
    const q = { id: 'q-1', type: 'short' as const, prompt: 'Name' };
    const { actions, form, commits } = actionsOn([
      formTab({ sections: [{ id: 's-1', title: '', questions: [q] }] }),
      board,
      other,
    ]);
    actions.setDestinationBoard('b2');
    expect(commits).toHaveLength(1);
    expect(questionsOf(form())).toEqual([q]);
  });

  it('adds no questions when the board takes no type', () => {
    const { actions, form, commits } = actionsOn([
      formTab({ destination: undefined }),
      {
        ...board,
        elements: [{ ...createShape('plan-board', 0, 0), planBoard: { ...setup, addTypes: [] } }],
      },
    ]);
    actions.setDestinationBoard('b');
    // One step (the board), and no questions: there is no type to ask about.
    expect(commits).toHaveLength(1);
    expect(questionsOf(form())).toEqual([]);
  });

  it('ignores a tab that is no board, or holds none', () => {
    const { actions, commits } = actionsOn([
      formTab({}),
      sheetTab,
      { ...other, id: 'empty', elements: [] },
    ]);
    actions.setDestinationBoard('s');
    actions.setDestinationBoard('empty');
    actions.setDestinationBoard('missing');
    expect(commits).toHaveLength(0);
  });
});

describe('addTypeQuestions', () => {
  it('adds the unasked fields in one step', () => {
    const { actions, form, commits } = actionsOn([formTab({}), board]);
    actions.addTypeQuestions();
    expect(commits).toHaveLength(1);
    expect(questionsOf(form())).toHaveLength(2);
    actions.addTypeQuestions();
    expect(questionsOf(form())).toHaveLength(2);
  });
});

// Fields from the form's questions (forms.md): + New Card Type and Add Fields for Questions.
const asked = (extra: Partial<FormDefinition> = {}) =>
  formTab({
    sections: [
      {
        id: 's-1',
        title: '',
        questions: [
          { id: 'q-name', type: 'short', prompt: 'Name', goesTo: { to: 'title' } },
          { id: 'q-body', type: 'paragraph', prompt: 'Details' },
          { id: 'q-team', type: 'single', prompt: 'Team', options: ['Web', 'Apps'] },
          // Fits Bug's Severity, which a new type lacks.
          {
            id: 'q-sev',
            type: 'single',
            prompt: 'Severity',
            options: ['Low'],
            goesTo: { to: 'field', fieldId: 'f-sev' },
          },
        ],
      },
    ],
    ...extra,
  });

describe('newCardType', () => {
  it('makes the type with a field per question wanting one, and maps them in the same step', () => {
    const { actions, form, commits, saveType } = actionsOn([asked(), board]);
    actions.newCardType();
    expect(saveType).toHaveBeenCalledTimes(1);
    const made = saveType.mock.calls[0]![0] as ItemTypeDef;
    expect(made.label).toBe('Intake');
    expect(made.custom).toEqual([
      { id: 'f-team', label: 'Team', kind: 'choice', options: ['Web', 'Apps'] },
      { id: 'f-severity', label: 'Severity', kind: 'choice', options: ['Low'] },
    ]);
    expect(commits).toHaveLength(1);
    expect(form().destination?.typeId).toBe(made.id);
    // Title stays on Title and the first Paragraph on Description.
    expect(questionsOf(form()).map((q) => q.goesTo)).toEqual([
      { to: 'title' },
      undefined,
      { to: 'field', fieldId: 'f-team' },
      { to: 'field', fieldId: 'f-severity' },
    ]);
  });

  it('does nothing on a locked form', () => {
    const { actions, commits, saveType } = actionsOn([{ ...asked(), locked: true }, board]);
    actions.newCardType();
    expect(saveType).not.toHaveBeenCalled();
    expect(commits).toHaveLength(0);
  });
});

describe('addQuestionFields', () => {
  it('adds a field to the chosen type for each question wanting one, mapped in one step', () => {
    const { actions, form, commits, saveType } = actionsOn([asked(), board]);
    actions.addQuestionFields();
    expect(saveType).toHaveBeenCalledTimes(1);
    const made = saveType.mock.calls[0]![0] as ItemTypeDef;
    expect(made.id).toBe('bug');
    // Severity already fits Bug's field, so only Team gets one.
    expect(made.custom!.map((f) => f.label)).toEqual(['Severity', 'Team']);
    expect(commits).toHaveLength(1);
    expect(form().destination?.typeId).toBe('bug');
    expect(questionsOf(form())[2]!.goesTo).toEqual({ to: 'field', fieldId: 'f-team' });
  });

  it('does nothing when every answer has a place, or the form is locked', () => {
    const plain = actionsOn([formTab({}), board]);
    plain.actions.addQuestionFields();
    expect(plain.saveType).not.toHaveBeenCalled();
    expect(plain.commits).toHaveLength(0);
    const locked = actionsOn([{ ...asked(), locked: true }, board]);
    locked.actions.addQuestionFields();
    expect(locked.saveType).not.toHaveBeenCalled();
    expect(locked.commits).toHaveLength(0);
  });
});

describe('newResponsesBoard', () => {
  it('makes the board from a type’s own statuses, taking that type alone', () => {
    const { actions, form, tabs } = actionsOn([
      formTab({
        destination: {
          tabId: 'gone',
          typeId: 'work',
          status: 'x',
          fixed: { 'f-sev': { value: 'Low' } },
        },
      }),
      board,
    ]);
    actions.newResponsesBoard();
    const made = tabs().find((t) => t.id === form().destination!.tabId)!;
    const s = boardsOf(made)[0]!.setup;
    expect(s.columns.map((c) => [c.status, c.name, c.color])).toEqual([
      ['review', 'Under Review', '#ff0000'],
      ['ready', 'Ready', undefined],
    ]);
    expect(s.addTypes).toEqual(['work']);
    expect(form().destination).toMatchObject({
      status: 'review',
      fixed: { 'f-sev': { value: 'Low' } },
    });
  });

  it('gives a type without its own statuses New, In Progress and Done', () => {
    const { actions, form, tabs } = actionsOn([
      formTab({ destination: { tabId: 'gone', typeId: 'bug', status: 'x' } }),
      board,
    ]);
    actions.newResponsesBoard();
    const made = tabs().find((t) => t.id === form().destination!.tabId)!;
    expect(boardsOf(made)[0]!.setup.columns.map((c) => c.name)).toEqual([
      'New',
      'In Progress',
      'Done',
    ]);
    expect(form().destination).not.toHaveProperty('fixed');
  });
});
