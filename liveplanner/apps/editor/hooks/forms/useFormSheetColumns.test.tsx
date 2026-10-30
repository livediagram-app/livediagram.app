// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormDefinition } from '@liveplanner/forms';
import type { Tab } from '@liveplanner/project';
import { applySheetWrite, type Cell, type Sheet, type SheetWrite } from '@liveplanner/sheets';
import type { SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import { FORM_COLUMNS_SYNC_MS } from './form-sheet-columns';
import {
  FORM_COLUMNS_RETRIES,
  FORM_COLUMNS_RETRY_MS,
  useFormSheetColumns,
} from './useFormSheetColumns';

// The builder keeping a sheet form's columns (docs/specs/030-forms/forms.md "Columns before any response").

const fake = vi.hoisted(() => ({
  sheets: new Map<string, unknown>(),
  writes: [] as { sheetId: string; write: unknown; opts: unknown }[],
  loads: [] as [string, boolean][],
  refuse: false,
  // A sheet that turns up after this many loads.
  appearAfter: 0,
  pending: null as unknown,
}));
vi.mock('@/components/sheets/sheet-store-client', () => ({
  sheetStoreOf: () => ({
    loadTab: async (tabId: string, force = false) => {
      fake.loads.push([tabId, force]);
      if (fake.pending && fake.loads.length > fake.appearAfter) {
        fake.sheets.set('shtAAAAAA001', fake.pending);
        fake.pending = null;
      }
    },
    sheet: (id: string) => fake.sheets.get(id),
    write: (sheetId: string, write: SheetWrite, opts: unknown) => {
      fake.writes.push({ sheetId, write, opts });
      if (fake.refuse) return { error: 'sheet_full' };
      const before = fake.sheets.get(sheetId) as Sheet;
      fake.sheets.set(
        sheetId,
        applySheetWrite(before, write, { now: 1, by: { id: 'a', name: 'A', color: '#000' } }).sheet,
      );
      return null;
    },
  }),
}));

const SHEET: Sheet = {
  id: 'shtAAAAAA001',
  tabId: 'stab',
  title: 'Responses',
  layout: { rows: ['r1', 'r2'], cols: ['caaa', 'cbbb', 'cccc', 'cddd'] },
  cells: new Map<string, Cell>(),
  rev: 0,
  createdAt: 1,
  updatedAt: 1,
  updatedBy: { id: 'a', name: 'A', color: '#000' },
};
const form = (prompt = 'Name', columns?: Record<string, string>): FormDefinition => ({
  v: 1,
  heading: 'Sign Up',
  sections: [{ id: 's-1', title: '', questions: [{ id: 'q-name', type: 'short', prompt }] }],
  sheet: { tabId: 'stab', sheetId: 'shtAAAAAA001', ...(columns ? { columns } : {}) },
});
const tabOf = (f: FormDefinition, over: Partial<Tab> = {}) =>
  ({ id: 'ftab', name: 'Sign Up', kind: 'form', elements: [], form: f, ...over }) as unknown as Tab;
const bridge = {} as SheetsBridge;

// Renders the hook over a form the quiet saves change, as the editor's tabs do.
function mount(start: FormDefinition, over: Partial<Tab> = {}, canEdit = true) {
  let current = start;
  const save = vi.fn((change: (f: FormDefinition) => FormDefinition) => {
    current = change(current);
    view.rerender({ tab: tabOf(current, over) });
  });
  const view = renderHook(
    ({ tab }: { tab: Tab }) =>
      useFormSheetColumns({ tab, canEdit, bridge, changeFormQuietly: save }),
    { initialProps: { tab: tabOf(start, over) } },
  );
  return {
    save,
    form: () => current,
    edit: (f: FormDefinition) => {
      current = f;
      view.rerender({ tab: tabOf(f, over) });
    },
  };
}
const flush = async (ms = FORM_COLUMNS_SYNC_MS) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const headers = () => {
  const s = fake.sheets.get('shtAAAAAA001') as Sheet;
  return s.layout.cols.map((c) => {
    const i = s.cells.get(`r1:${c}`)?.input;
    return i && 's' in i ? i.s : null;
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  fake.sheets = new Map([['shtAAAAAA001', SHEET]]);
  fake.writes = [];
  fake.loads = [];
  fake.refuse = false;
  fake.appearAfter = 0;
  fake.pending = null;
});
afterEach(() => vi.useRealTimers());

describe('useFormSheetColumns', () => {
  it('gives the sheet its headers a moment after the form changes, and remembers each column', async () => {
    const m = mount(form());
    expect(fake.writes).toEqual([]);
    await flush();
    expect(headers()).toEqual(['#', 'Submitted', 'Name', null]);
    expect(fake.writes[0]!.opts).toEqual({ undoable: false, unchecked: true });
    expect(m.form().sheet!.columns).toEqual({ '#': 'caaa', at: 'cbbb', 'q-name': 'cccc' });
    // The saved columns run it once more: nothing left to write.
    await flush();
    expect(fake.writes).toHaveLength(1);
  });

  it('carries a new wording to its column, and keeps a heading renamed in the sheet', async () => {
    const m = mount(form());
    await flush();
    await flush();
    m.edit(form('Full name', m.form().sheet!.columns));
    await flush();
    expect(headers()[2]).toBe('Full name');
    // Renamed in the sheet: the next wording leaves it.
    const s = fake.sheets.get('shtAAAAAA001') as Sheet;
    const cells = new Map(s.cells);
    cells.set('r1:cccc', { input: { s: 'Who' } });
    fake.sheets.set('shtAAAAAA001', { ...s, cells });
    m.edit(form('Your name', m.form().sheet!.columns));
    await flush();
    expect(headers()[2]).toBe('Who');
    expect(m.form().sheet!.columns!['q-name']).toBe('cccc');
  });

  it('waits for a sheet still being made, and gives up after its retries', async () => {
    fake.sheets.clear();
    fake.pending = SHEET;
    fake.appearAfter = 2;
    mount(form());
    await flush();
    await flush(FORM_COLUMNS_RETRY_MS);
    await flush(FORM_COLUMNS_RETRY_MS);
    expect(headers()).toEqual(['#', 'Submitted', 'Name', null]);

    fake.sheets.clear();
    fake.loads = [];
    fake.writes = [];
    mount(form('Other'));
    await flush();
    for (let i = 0; i <= FORM_COLUMNS_RETRIES; i += 1) await flush(FORM_COLUMNS_RETRY_MS);
    // The first look, then a fresh read and a look for each retry.
    expect(fake.loads).toHaveLength(1 + 2 * FORM_COLUMNS_RETRIES);
    expect(fake.writes).toEqual([]);
  });

  it('saves no columns when the store refuses the headers', async () => {
    fake.refuse = true;
    const m = mount(form());
    await flush();
    expect(fake.writes).toHaveLength(1);
    expect(m.save).not.toHaveBeenCalled();
  });

  it('does nothing for a locked tab, a reader, a board form, or a tab left before the moment', async () => {
    mount(form(), { locked: true });
    mount(form(), {}, false);
    const { sheet: _none, ...board } = form();
    mount(board);
    await flush();
    expect(fake.loads).toEqual([]);

    const view = renderHook(() =>
      useFormSheetColumns({
        tab: tabOf(form()),
        canEdit: true,
        bridge,
        changeFormQuietly: vi.fn(),
      }),
    );
    view.unmount();
    await flush();
    expect(fake.loads).toEqual([]);
  });

  it('remembers columns only on the sheet it planned for', async () => {
    const m = mount(form());
    // The form points elsewhere by the time the save lands.
    m.save.mockImplementationOnce((change) => {
      const moved = { ...form(), sheet: { tabId: 'other', sheetId: 'shtBBBBBB002' } };
      expect(change(moved)).toBe(moved);
    });
    await flush();
    expect(m.save).toHaveBeenCalledTimes(1);
  });
});
