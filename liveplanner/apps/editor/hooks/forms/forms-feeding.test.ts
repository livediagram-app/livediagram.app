import { describe, expect, it } from 'vitest';
import { createShape, type Tab } from '@liveplanner/project';
import { presetSetup } from '@liveplanner/items';
import { FORM_TAB_DELETE_WARNING, deleteTabWarning, formsFeeding } from './forms-feeding';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';

// Deleting a board or sheet a form sends to says first that it pauses the form
// (docs/specs/030-forms/forms.md "Publishing and the form link").

const tab = (id: string, extra: Partial<Tab> = {}): Tab => ({
  id,
  name: id,
  elements: [],
  ...extra,
});
const formTab = (id: string, name: string, to: { board?: string; sheet?: string }) =>
  tab(id, {
    name,
    kind: 'form',
    form: {
      v: 1,
      heading: name,
      sections: [],
      ...(to.board ? { destination: { tabId: to.board, typeId: 'bug', status: 's' } } : {}),
      ...(to.sheet ? { sheet: { tabId: to.sheet, sheetId: 'AAAAAAAAAAA1' } } : {}),
    },
  });

describe('formsFeeding', () => {
  const tabs = [
    tab('board', { kind: 'board' }),
    tab('sheet', { kind: 'sheet' }),
    formTab('f1', 'Bugs', { board: 'board' }),
    formTab('f2', 'RSVP', { sheet: 'sheet', board: 'board' }),
  ];

  it('names the forms whose responses go to a tab, a sheet before a kept board', () => {
    expect(formsFeeding(tabs, 'board')).toEqual([{ tabId: 'f1', heading: 'Bugs' }]);
    expect(formsFeeding(tabs, 'sheet')).toEqual([{ tabId: 'f2', heading: 'RSVP' }]);
    expect(formsFeeding(tabs, 'f1')).toEqual([]);
  });

  it('warns in Delete’s confirmation, one form or several, and not for a tab nothing sends to', () => {
    expect(deleteTabWarning(tabs, 'board')).toBe(
      '“Bugs” sends its responses here: it stops taking them, keeping its link, until it has somewhere to send them.',
    );
    const two = [...tabs, formTab('f3', 'More', { board: 'board' })];
    expect(deleteTabWarning(two, 'board')).toBe(
      '2 forms send their responses here: they stop taking them, keeping their links, until they have somewhere to send them.',
    );
    expect(deleteTabWarning(tabs, 'nope')).toBeUndefined();
  });

  // Deleting a Form tab deletes its link, which an undo does not bring back.
  it('warns that a Form tab’s link goes with it', () => {
    expect(deleteTabWarning(tabs, 'f1')).toBe(FORM_TAB_DELETE_WARNING);
  });

  // The tab bar asks for every tab on every render: 200 tabs, 50 of them forms, stay well inside a frame.
  it('stays cheap for a large project', () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      i % 4 === 0 ? formTab(`f${i}`, `F${i}`, { board: 'b0' }) : tab(`b${i}`, { kind: 'board' }),
    );
    const start = cpuNowMs();
    for (const t of many) deleteTabWarning(many, t.id);
    expect(cpuNowMs() - start).toBeLessThan(cpuBudgetMs(50));
  });
});

// A response makes a card of a type in a column, never a board (docs/specs/030-forms/forms.md "Responses Go To"): a
// tab feeds a form when one of its boards shows the form's cards, whichever tab the form was last seen on.
describe('forms by the boards that show their cards', () => {
  // The preset names the types it takes: left out here, so a board takes every type unless a test names some.
  const { addTypes: _preset, ...setup } = presetSetup('kanban');
  const status = setup.columns[0]!.status;
  const boardTab = (id: string, addTypes?: string[]): Tab => ({
    id,
    name: id,
    kind: 'board',
    elements: [
      {
        ...createShape('plan-board', 0, 0),
        planBoard: { ...setup, ...(addTypes ? { addTypes } : {}) },
      },
    ],
  });
  const feeds = (id: string, typeId: string, lastSeen?: string): Tab =>
    tab(id, {
      name: id,
      kind: 'form',
      form: {
        v: 1,
        heading: id,
        sections: [],
        destination: { ...(lastSeen ? { tabId: lastSeen } : {}), typeId, status },
      },
    });

  it('feeds every board that takes the type and has the column', () => {
    const tabs = [
      boardTab('bugs', ['bug']),
      boardTab('all'),
      boardTab('notes', ['note']),
      feeds('f', 'bug', 'bugs'),
    ];
    expect(formsFeeding(tabs, 'bugs')).toEqual([{ tabId: 'f', heading: 'f' }]);
    expect(formsFeeding(tabs, 'all')).toEqual([{ tabId: 'f', heading: 'f' }]);
    expect(formsFeeding(tabs, 'notes')).toEqual([]);
    // Last seen on a board that no longer takes its type: that board shows none of its cards.
    expect(formsFeeding([boardTab('bugs', ['note']), feeds('f', 'bug', 'bugs')], 'bugs')).toEqual(
      [],
    );
  });

  it('warns on Delete only when no other board shows the form’s cards', () => {
    const two = [boardTab('bugs', ['bug']), boardTab('all'), feeds('f', 'bug', 'bugs')];
    expect(deleteTabWarning(two, 'bugs')).toBeUndefined();
    expect(deleteTabWarning(two, 'all')).toBeUndefined();
    const one = [boardTab('bugs', ['bug']), boardTab('notes', ['note']), feeds('f', 'bug')];
    expect(deleteTabWarning(one, 'bugs')).toContain('“f” sends its responses here');
    // Another board whose content is not here yet proves nothing, so the warning stands.
    const unloaded = [
      boardTab('bugs', ['bug']),
      tab('later', { kind: 'board' }),
      feeds('f', 'bug'),
    ];
    expect(deleteTabWarning(unloaded, 'bugs')).toContain('“f” sends its responses here');
  });

  // The tab bar asks for every tab on every render: 150 loaded boards and 50 forms, every form shown on every board.
  it('stays cheap when every form shows on every board', () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      i % 4 === 0 ? feeds(`f${i}`, 'bug') : boardTab(`b${i}`),
    );
    for (const t of many) deleteTabWarning(many, t.id);
    const start = cpuNowMs();
    for (const t of many) deleteTabWarning(many, t.id);
    const ms = cpuNowMs() - start;
    console.info(`[perf] deleteTabWarning over 200 tabs: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });
});
