import { describe, expect, it } from 'vitest';
import { createShape, type Tab } from '@liveplanner/project';
import { ITEM_TYPES, presetSetup } from '@liveplanner/items';
import type { FormDefinition } from '@liveplanner/forms';
import { formDestinationOf } from './form-destination';

const board: Tab = {
  id: 'board',
  name: 'Applicants',
  kind: 'board',
  elements: [{ ...createShape('plan-board', 0, 0), planBoard: presetSetup('kanban') }],
};
// What a tab-scoped session receives for a tab it can't reach (apps/api/src/redact-project.ts).
const stub = { id: 'board', name: '', elements: [], outOfScope: true } as unknown as Tab;
const formTab: Tab = { id: 'form', name: 'Job Application', kind: 'form', elements: [] };
const form: FormDefinition = {
  v: 1,
  heading: 'Job Application',
  sections: [{ id: 's-1', title: '', questions: [] }],
  destination: { tabId: 'board', typeId: 'task', status: 'todo' },
};

describe('formDestinationOf', () => {
  it('finds a board destination, and says when its board is gone', () => {
    expect(formDestinationOf(form, [formTab, board], ITEM_TYPES, null)).toEqual({
      destTab: board,
      problem: null,
      warning: null,
      showsOn: ['Applicants'],
    });
    expect(formDestinationOf(form, [formTab], ITEM_TYPES, null).problem).toBe('board_missing');
    // A column its card type leaves out: a warning in words, the destination still holding.
    const picky = ITEM_TYPES.map((t) => (t.id === 'task' ? { ...t, statuses: ['elsewhere'] } : t));
    expect(formDestinationOf(form, [formTab, board], picky, null)).toMatchObject({
      problem: null,
      warning: expect.stringContaining('None of Applicants’s columns'),
    });
  });

  it('never reads a destination on a tab out of a tab-scoped link’s reach as removed', () => {
    // A link to the Form tab alone: the board is a nameless stub, not a removed board.
    expect(formDestinationOf(form, [formTab, stub], ITEM_TYPES, 'form')).toEqual({
      destTab: undefined,
      problem: null,
      warning: null,
      showsOn: [],
    });
    const toSheet: FormDefinition = {
      ...form,
      destination: undefined,
      sheet: { tabId: 'board', sheetId: 'sh' },
    };
    expect(formDestinationOf(toSheet, [formTab, stub], ITEM_TYPES, 'form')).toEqual({
      destTab: undefined,
      problem: null,
      warning: null,
      showsOn: [],
    });
    // A form with nowhere to send responses is still told so.
    const nowhere: FormDefinition = { ...form, destination: undefined };
    expect(formDestinationOf(nowhere, [formTab, stub], ITEM_TYPES, 'form').problem).toBe(
      'no_destination',
    );
  });

  // A response makes a card of a type in a column, never a board: every board that takes it shows it.
  it('holds while any board shows its cards, and names them all, the one last seen first', () => {
    const second: Tab = { ...board, id: 'second', name: 'Hiring' };
    const both = formDestinationOf(form, [formTab, second, board], ITEM_TYPES, null);
    expect(both).toMatchObject({
      destTab: board,
      problem: null,
      showsOn: ['Applicants', 'Hiring'],
    });
    // The board it was last seen on deleted: the other still shows the cards, so nothing is wrong.
    expect(formDestinationOf(form, [formTab, second], ITEM_TYPES, null)).toMatchObject({
      destTab: second,
      problem: null,
      showsOn: ['Hiring'],
    });
    // Never last seen anywhere (a form made by an agent): the first board that shows them.
    const bare: FormDefinition = { ...form, destination: { typeId: 'task', status: 'todo' } };
    expect(formDestinationOf(bare, [formTab, second, board], ITEM_TYPES, null).destTab).toBe(
      second,
    );
    // A board that takes other types only shows none of them.
    const others: Tab = {
      ...board,
      elements: [
        { ...board.elements[0]!, planBoard: { ...presetSetup('kanban'), addTypes: ['note'] } },
      ],
    } as Tab;
    expect(formDestinationOf(form, [formTab, others], ITEM_TYPES, null)).toMatchObject({
      destTab: undefined,
      problem: 'type_not_on_board',
      showsOn: [],
    });
  });
});
