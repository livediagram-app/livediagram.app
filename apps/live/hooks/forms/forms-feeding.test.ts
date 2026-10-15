import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { deleteTabWarning, formsFeeding } from './forms-feeding';

// Deleting a board or sheet a form sends to says first that it unpublishes the form
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

  it('warns in Delete’s confirmation, one form or several, and not for any other tab', () => {
    expect(deleteTabWarning(tabs, 'board')).toBe(
      '“Bugs” sends its responses here: it stops taking them, and is unpublished if it was published.',
    );
    const two = [...tabs, formTab('f3', 'More', { board: 'board' })];
    expect(deleteTabWarning(two, 'board')).toBe(
      '2 forms send their responses here: they stop taking them, and any published are unpublished.',
    );
    expect(deleteTabWarning(tabs, 'f1')).toBeUndefined();
  });

  // The tab bar asks for every tab on every render: 200 tabs, 50 of them forms, stay well inside a frame.
  it('stays cheap for a large document', () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      i % 4 === 0 ? formTab(`f${i}`, `F${i}`, { board: 'b0' }) : tab(`b${i}`, { kind: 'board' }),
    );
    const start = performance.now();
    for (const t of many) deleteTabWarning(many, t.id);
    expect(performance.now() - start).toBeLessThan(50);
  });
});
