// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Tab } from '@livediagram/document';
import { useFormActions } from './useFormActions';

// Renaming a form (docs/specs/030-forms/forms.md "Responses Go To and Settings"): the board or sheet its responses go
// to follows while it is still on its automatic name.

const formTab = (to: { sheet?: string; board?: string }): Tab => ({
  id: 'f',
  name: 'Untitled Form',
  kind: 'form',
  elements: [],
  form: {
    v: 1,
    heading: 'Untitled Form',
    sections: [],
    ...(to.sheet ? { sheet: { tabId: to.sheet, sheetId: 'AAAAAAAAAAA1' } } : {}),
    ...(to.board ? { destination: { tabId: to.board, typeId: 'bug', status: 's' } } : {}),
  },
});

function rename(tabs: Tab[], name: string) {
  let now = tabs;
  const retitleSheets = vi.fn();
  const { result } = renderHook(() =>
    useFormActions({
      activeId: 'f',
      tabs,
      commitTabs: (map) => (now = map(now)),
      itemTypes: { types: [], saveType: vi.fn() },
      statusNames: new Map(),
      retitleSheets,
    }),
  );
  result.current.renameForm(name);
  return { tabs: now, retitleSheets };
}

describe('renameForm', () => {
  it('renames a sheet still on its automatic name, and its sheet', () => {
    const sheet: Tab = { id: 's', name: 'Untitled Form Responses', kind: 'sheet', elements: [] };
    const { tabs, retitleSheets } = rename([formTab({ sheet: 's' }), sheet], 'Event Feedback');
    expect(tabs.find((t) => t.id === 'f')).toMatchObject({ name: 'Event Feedback' });
    expect(tabs.find((t) => t.id === 's')?.name).toBe('Event Feedback Responses');
    expect(retitleSheets).toHaveBeenCalledWith(
      ['AAAAAAAAAAA1'],
      'Untitled Form Responses',
      'Event Feedback Responses',
    );
  });

  it('renames a board on its automatic name', () => {
    const board: Tab = { id: 'b', name: 'Untitled Form Responses', kind: 'board', elements: [] };
    const { tabs } = rename([formTab({ board: 'b' }), board], 'Bugs');
    expect(tabs.find((t) => t.id === 'b')?.name).toBe('Bugs Responses');
  });

  it('keeps a name someone gave the board or sheet', () => {
    const sheet: Tab = { id: 's', name: 'Guest List', kind: 'sheet', elements: [] };
    const { tabs, retitleSheets } = rename([formTab({ sheet: 's' }), sheet], 'Party');
    expect(tabs.find((t) => t.id === 's')?.name).toBe('Guest List');
    expect(retitleSheets).not.toHaveBeenCalled();
  });
});

// The connect box's Cards on a Board, for a form whose sheet was removed (docs/specs/030-forms/forms.md "Responses Go
// To and Settings"): the new board is where responses go, so the sheet it named goes.
describe('newResponsesBoard', () => {
  it('drops a removed sheet so the new board takes the responses', () => {
    let now: Tab[] = [formTab({ sheet: 'gone' })];
    const { result } = renderHook(() =>
      useFormActions({
        activeId: 'f',
        tabs: now,
        commitTabs: (map) => (now = map(now)),
        itemTypes: {
          types: [{ id: 'bug', label: 'Bug', fields: ['title'], custom: [] } as never],
          saveType: vi.fn(),
        },
        statusNames: new Map(),
      }),
    );
    result.current.newResponsesBoard();
    const form = now.find((t) => t.id === 'f')!.form!;
    const board = now.find((t) => t.kind === 'board')!;
    expect(form.sheet).toBeUndefined();
    expect(form.destination).toMatchObject({ tabId: board.id, typeId: 'bug' });
  });
});
