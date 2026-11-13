import { describe, expect, it } from 'vitest';
import { createShape, type Element, type Tab } from '@liveplanner/project';
import { destinationProblem, formStarter } from '@liveplanner/forms';
import { boardAddTypes, ITEM_TYPES, presetSetup, type ItemTypeDef } from '@liveplanner/items';
import {
  boardsOf,
  planFormStart,
  responsesBoardSetup,
  responsesBoardTab,
  typeResponsesBoardSetup,
  sheetsOf,
  uniqueTypeLabel,
  withAutoBoardName,
  withBoardTaking,
} from './form-start';

// docs/specs/030-forms/forms.md "Starting a form": where a starter's responses go, and what it adds.

let n = 0;
const random = () => ((n += 7) % 100) / 100;

const boardTab = (id: string, setup = presetSetup('kanban'), kind: Tab['kind'] = 'board'): Tab => ({
  id,
  name: id,
  kind,
  elements: [{ ...createShape('plan-board', 0, 0), planBoard: setup }],
});
const formTab: Tab = { id: 'form', name: 'Tab 2', elements: [], theme: 'ocean' };

describe('boardsOf', () => {
  it('reads a Board tab’s live boards only', () => {
    expect(boardsOf(boardTab('b'))).toHaveLength(1);
    expect(boardsOf(boardTab('b', presetSetup('archive')))).toEqual([]);
    expect(boardsOf(boardTab('b', { ...presetSetup('kanban'), columns: [] }))).toEqual([]);
    expect(boardsOf(boardTab('b', presetSetup('kanban'), 'diagram'))).toEqual([]);
    expect(
      boardsOf({ ...boardTab('b'), elements: [createShape('plan-sheet', 0, 0) as Element] }),
    ).toEqual([]);
  });
});

describe('planFormStart', () => {
  it('sends a Bug Report to the first board that takes Bugs, adding its fields to Bug', () => {
    const triage = boardTab('triage', presetSetup('bug-triage'));
    const plan = planFormStart({
      starter: formStarter('bug-report'),
      formTab,
      tabs: [formTab, boardTab('ideas', { ...presetSetup('kanban'), addTypes: ['idea'] }), triage],
      types: [...ITEM_TYPES],
      statusNames: [],
      random,
    });
    expect(plan.newBoardTab).toBeNull();
    expect(plan.form.destination).toEqual({ tabId: 'triage', typeId: 'bug', status: 'new' });
    expect(plan.type.id).toBe('bug');
    expect(plan.type.custom?.map((f) => f.label)).toEqual(
      expect.arrayContaining(['Severity', 'Email']),
    );
    expect(plan.saveType).toBe(true);
  });

  it('makes a Responses board after the form when no board fits, in the form’s theme', () => {
    const plan = planFormStart({
      starter: formStarter('contact'),
      formTab,
      tabs: [formTab],
      types: [],
      statusNames: [['todo~1', 'To Do']],
      random,
    });
    expect(plan.newBoardTab).toMatchObject({
      name: 'Contact Responses',
      kind: 'board',
      theme: 'ocean',
    });
    const setup = boardsOf(plan.newBoardTab!)[0]!.setup;
    expect(setup.columns.map((c) => c.name)).toEqual(['New', 'In Progress', 'Done']);
    expect(plan.form.destination).toMatchObject({
      tabId: plan.newBoardTab!.id,
      typeId: plan.type.id,
      status: setup.columns[0]!.status,
    });
    expect(plan.newSheet).toBeNull();
  });

  // The bug: the board took Kanban's Task and Action, so once the project had either, the form's type (and its cards)
  // left the board and the form paused ("Its board no longer takes that card type").
  it('makes a Responses board that takes the form’s type alone, and keeps taking it once Task arrives', () => {
    const plan = planFormStart({
      starter: formStarter('contact'),
      formTab,
      tabs: [formTab],
      types: [],
      statusNames: [],
      random,
    });
    const setup = boardsOf(plan.newBoardTab!)[0]!.setup;
    expect(setup.addTypes).toEqual([plan.type.id]);
    const destination = plan.form.destination;
    const withTask = [plan.type, ...ITEM_TYPES];
    expect(destinationProblem(destination, [setup], withTask)).toBeNull();
    expect(boardAddTypes(setup, withTask).map((t) => t.id)).toEqual([plan.type.id]);
  });

  // The user's call (2026-10-15): a Blank form makes nothing that might not be wanted, as a sheet may be.
  it('sends a blank form nowhere, making no board, even with a board to hand', () => {
    const plan = planFormStart({
      starter: formStarter('blank'),
      formTab,
      tabs: [formTab, boardTab('b')],
      types: [...ITEM_TYPES],
      statusNames: [],
      random,
    });
    expect(plan.form.destination).toBeUndefined();
    expect(plan.form.sheet).toBeUndefined();
    expect(plan.newBoardTab).toBeNull();
    expect(plan.newSheet).toBeNull();
    expect(plan.saveType).toBe(false);
  });

  it('gives a blank form from a board’s cog that board and its first type, written as it is', () => {
    const board = boardTab('b');
    const plan = planFormStart({
      starter: formStarter('blank'),
      formTab,
      tabs: [formTab, board],
      types: [...ITEM_TYPES],
      statusNames: [],
      random,
      board: { tabId: 'b', elementId: boardsOf(board)[0]!.element.id },
    });
    expect(plan.form.destination?.tabId).toBe('b');
    // Kanban takes Tasks: the form's cards are Tasks, the catalogue's own.
    expect(plan.type).toBe(ITEM_TYPES.find((t) => t.id === 'task'));
    expect(plan.saveType).toBe(false);
  });

  it('names the form and its Responses tab after a name the tab gave it', () => {
    const plan = planFormStart({
      starter: formStarter('rsvp'),
      formTab,
      tabs: [formTab],
      types: [],
      statusNames: [],
      random,
      newSheetId: () => 'AAAAAAAAAAA1',
      heading: 'Summer Party',
    });
    expect(plan.form.heading).toBe('Summer Party');
    expect(plan.newSheet!.tab.name).toBe('Summer Party Responses');
  });

  it('sends a sheet starter’s responses to a new Sheet tab after the form, in its theme', () => {
    const plan = planFormStart({
      starter: formStarter('rsvp'),
      formTab,
      tabs: [formTab, boardTab('b')],
      types: [...ITEM_TYPES],
      statusNames: [],
      random,
      newSheetId: () => 'AAAAAAAAAAA1',
    });
    expect(plan.newSheet).toMatchObject({ sheetId: 'AAAAAAAAAAA1', title: 'Event RSVP Responses' });
    expect(plan.newSheet!.tab).toMatchObject({
      kind: 'sheet',
      name: 'Event RSVP Responses',
      theme: 'ocean',
    });
    expect(plan.form.sheet).toEqual({ tabId: plan.newSheet!.tab.id, sheetId: 'AAAAAAAAAAA1' });
    expect(plan.form.destination).toBeUndefined();
    expect(plan.newBoardTab).toBeNull();
    expect(plan.saveType).toBe(false);
  });
});

describe('the pieces', () => {
  it('reuses a project’s own New status by name', () => {
    const setup = responsesBoardSetup(
      formStarter('contact'),
      'Contact Responses',
      [['new~ab12', 'new']],
      random,
    );
    expect(setup.columns[0]!.status).toBe('new~ab12');
    // Never Kanban's Task and Action: responsesBoardTab names the form's type.
    expect(setup).not.toHaveProperty('addTypes');
    expect(setup.doneColumnId).toBe(setup.columns[2]!.id);
    expect(responsesBoardSetup(formStarter('bug-report'), 'X', [], random).columns[0]!.name).toBe(
      'New',
    );
  });

  it('names a Responses tab, without a theme when the form has none', () => {
    const tab = responsesBoardTab('Survey', { theme: undefined }, []);
    expect(tab.name).toBe('Survey Responses');
    expect(tab).not.toHaveProperty('theme');
  });

  it('keeps a new type’s name unique', () => {
    const types = [{ label: 'Feedback' }, { label: 'feedback 2' }] as ItemTypeDef[];
    expect(uniqueTypeLabel('Feedback', types)).toBe('Feedback 3');
    expect(uniqueTypeLabel('  ', [])).toBe('Response');
    expect(uniqueTypeLabel('Survey', types)).toBe('Survey');
  });

  it('lets a board that confines its types take one more', () => {
    const confined = boardTab('b', { ...presetSetup('kanban'), addTypes: ['task'] });
    const taking = withBoardTaking(confined, 'feedback');
    expect(boardsOf(taking)[0]!.setup.addTypes).toEqual(['task', 'feedback']);
    expect(withBoardTaking(taking, 'feedback')).toBe(taking);
    const open = boardTab('o', { ...presetSetup('kanban'), addTypes: undefined });
    expect(withBoardTaking(open, 'feedback')).toBe(open);
  });
});

describe('withAutoBoardName', () => {
  const named = (name: string, title = name): Tab => {
    const t = boardTab('b', { ...presetSetup('kanban'), title });
    return { ...t, name, elements: [...t.elements, createShape('square', 0, 0)] };
  };
  const titleOf = (t: Tab) =>
    (t.elements[0] as Element & { planBoard: { title: string } }).planBoard.title;

  it('names a board still on an automatic name after the card type, its title too', () => {
    for (const was of ['Tab 3', 'Survey Responses', 'Bug Responses']) {
      const t = withAutoBoardName(named(was), { heading: 'Survey', from: 'Bug', to: 'Contact' });
      expect([t.name, titleOf(t)]).toEqual(['Contact Responses', 'Contact Responses']);
    }
  });

  it('keeps a name someone gave, a board title of its own, and an unchanged name', () => {
    const own = named('Leads');
    expect(withAutoBoardName(own, { heading: 'Survey', to: 'Contact' })).toBe(own);
    const titled = withAutoBoardName(named('Survey Responses', 'Pipeline'), {
      heading: 'Survey',
      to: 'Contact',
    });
    expect([titled.name, titleOf(titled)]).toEqual(['Contact Responses', 'Pipeline']);
    const same = named('Contact Responses');
    expect(withAutoBoardName(same, { heading: 'Survey', from: 'Contact', to: 'Contact' })).toBe(
      same,
    );
  });
});

describe('sheetsOf', () => {
  it('lists each Sheet tab’s sheets, a second one numbered', () => {
    const sheet = (sheetId: string) =>
      ({ ...createShape('plan-sheet', 0, 0), planSheet: { sheetId } }) as Element;
    const tabs: Tab[] = [
      {
        id: 's',
        name: 'Budget',
        kind: 'sheet',
        elements: [sheet('AAAAAAAAAAA1'), sheet('AAAAAAAAAAA2')],
      },
      { id: 'b', name: 'Board', kind: 'board', elements: [sheet('AAAAAAAAAAA3')] },
    ];
    expect(sheetsOf(tabs)).toEqual([
      { tabId: 's', sheetId: 'AAAAAAAAAAA1', name: 'Budget' },
      { tabId: 's', sheetId: 'AAAAAAAAAAA2', name: 'Budget 2' },
    ]);
  });
});

// Columns follow the card type (docs/specs/030-forms/forms.md "Columns follow the card type").
describe('a responses board for a type with its own statuses', () => {
  const statusNames: [string, string][] = [
    ['review~a', 'Under Review'],
    ['ready~b', 'Ready'],
    ['shipped~c', 'Shipped'],
  ];
  it('takes the type’s statuses in its order, named, coloured and done as the project has them', () => {
    const tab = responsesBoardTab('Intake', { theme: undefined }, statusNames, undefined, random, {
      typeId: 'work-item',
      statuses: ['ready~b', 'review~a', 'shipped~c', 'unnamed~d'],
      columns: [
        { status: 'review~a', color: '#ff0000' },
        { status: 'shipped~c', done: true },
      ],
    });
    const setup = boardsOf(tab)[0]!.setup;
    expect(setup.columns.map((c) => [c.status, c.name])).toEqual([
      ['ready~b', 'Ready'],
      ['review~a', 'Under Review'],
      ['shipped~c', 'Shipped'],
      ['unnamed~d', 'unnamed~d'],
    ]);
    expect(setup.columns[1]!.color).toBe('#ff0000');
    expect(setup.columns[2]!.done).toBe(true);
    expect(setup.doneColumnId).toBe('shipped~c');
    expect(setup.addTypes).toEqual(['work-item']);
  });

  it('gives a type without its own statuses New, In Progress and Done', () => {
    expect(typeResponsesBoardSetup({ typeId: 'x' }, 'T', [], random)).toBeNull();
    const tab = responsesBoardTab('Intake', { theme: undefined }, [], undefined, random, {
      typeId: 'x',
      statuses: [],
    });
    expect(boardsOf(tab)[0]!.setup.columns.map((c) => c.name)).toEqual([
      'New',
      'In Progress',
      'Done',
    ]);
  });

  it('starts a form on the board’s first column its type uses', () => {
    const triage = boardTab('b', presetSetup('kanban'));
    const status = boardsOf(triage)[0]!.setup.columns[1]!.status;
    const picky = { ...ITEM_TYPES[0], statuses: [status] };
    const formTab: Tab = { id: 'f', name: 'Form', kind: 'form', elements: [] };
    const plan = planFormStart({
      starter: formStarter('blank'),
      formTab,
      tabs: [formTab, triage],
      types: [picky],
      statusNames: [],
      board: { tabId: 'b', elementId: boardsOf(triage)[0]!.element.id },
    });
    expect(plan.form.destination?.status).toBe(status);
  });
});
