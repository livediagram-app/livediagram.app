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
    });
    expect(formDestinationOf(form, [formTab], ITEM_TYPES, null).problem).toBe('board_missing');
  });

  it('never reads a destination on a tab out of a tab-scoped link’s reach as removed', () => {
    // A link to the Form tab alone: the board is a nameless stub, not a removed board.
    expect(formDestinationOf(form, [formTab, stub], ITEM_TYPES, 'form')).toEqual({
      destTab: undefined,
      problem: null,
    });
    const toSheet: FormDefinition = {
      ...form,
      destination: undefined,
      sheet: { tabId: 'board', sheetId: 'sh' },
    };
    expect(formDestinationOf(toSheet, [formTab, stub], ITEM_TYPES, 'form')).toEqual({
      destTab: undefined,
      problem: null,
    });
  });

  it('still judges a destination on the scoped tab itself', () => {
    const own: FormDefinition = {
      ...form,
      destination: { tabId: 'form', typeId: 'task', status: 'todo' },
    };
    expect(formDestinationOf(own, [formTab, stub], ITEM_TYPES, 'form').problem).toBe(
      'board_missing',
    );
  });
});
