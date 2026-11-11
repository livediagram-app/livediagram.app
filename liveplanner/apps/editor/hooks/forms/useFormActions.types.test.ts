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
  return { actions: result.current, form, commits, tabs: () => now };
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
