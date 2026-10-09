// @vitest-environment jsdom
// Card tables kept in step while the Sheet is drawn (docs/specs/029-sheets/sheet.md "Card tables"): cards rewrite
// their rows quietly; this person's edits write the cards, make new ones and trash deleted rows' cards.
import { act, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import type { CardTable } from '@livediagram/sheets';
import {
  makeSheet,
  renderSheet,
  stubResizeObserver,
  SHEET_ID,
  type SheetHarness,
} from './sheet-ui-test-utils';
import { cancelCardRow, saveCardRow, useCardTableSync } from './useCardTableSync';
import { useSheetController } from './sheet-controller';

let plan: Record<string, unknown> | undefined;
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));

beforeAll(stubResizeObserver);

const person = { id: 'p', name: 'P', color: '#000000' };
const card = (key: number, fields: Item['fields']): Item => ({
  id: `i${key}`,
  type: 'task',
  key,
  rank: 'a',
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: person,
  updatedBy: person,
});

function Sync({ h }: { h: SheetHarness }) {
  useCardTableSync(useSheetController(), h.setPush);
  return null;
}

describe('card table sync', () => {
  let h: SheetHarness;
  const patchItem = vi.fn(async () => true);
  const addItem = vi.fn(async (_input: { id?: string }) => true);
  const trashItems = vi.fn(() => 1);
  beforeEach(async () => {
    vi.clearAllMocks();
    h = await makeSheet({ cells: { A1: 'Title', A2: 'Old' } });
    const { rows, cols } = h.store.sheet(SHEET_ID)!.layout;
    const table: CardTable = {
      id: 'tbl1',
      head: rows[0]!,
      cols: [{ c: cols[0]!, field: 'Title' }],
      rows: { [rows[1]!]: 'i1' },
      type: 'task',
    };
    act(() => {
      h.store.write(
        SHEET_ID,
        { kind: 'layout', changes: [{ k: 'cardTable', id: 'tbl1', table }] },
        { undoable: false },
      );
    });
    plan = {
      items: new Map([['i1', card(1, { title: 'Fresh', status: 'todo' })]]),
      types: ITEM_TYPES,
      statusNames: new Map([['todo', 'To Do']]),
      canEdit: true,
      status: 'ready',
      patchItem,
      addItem,
      trashItems,
    };
  });

  const ids = () => h.store.sheet(SHEET_ID)!.layout;
  const table = () => ids().cardTables![0]!;
  const type = (r: number, text: string) =>
    act(() => {
      h.ctl().write(
        { kind: 'cells', cells: [{ r: ids().rows[r]!, c: ids().cols[0]!, i: { s: text } }] },
        'Cell',
      );
    });

  it('rewrites a row from its card, and makes an edited row a draft that Save writes to the card', async () => {
    renderSheet(h, () => <Sync h={h} />);
    await waitFor(() => expect(h.cell('A2')?.input).toEqual({ s: 'Fresh' }));
    type(1, 'Renamed');
    expect(patchItem).not.toHaveBeenCalled();
    expect(table().drafts).toEqual([ids().rows[1]]);
    await act(async () => {
      expect(await saveCardRow(h.ctl(), plan as never, 'tbl1', ids().rows[1]!)).toBe(true);
    });
    expect(patchItem).toHaveBeenCalledWith('i1', { set: { title: 'Renamed' } });
    expect(table().drafts).toBeUndefined();
  });

  it('keeps the row a draft when its card write is refused, and saves it once', async () => {
    renderSheet(h, () => <Sync h={h} />);
    await waitFor(() => expect(h.cell('A2')?.input).toEqual({ s: 'Fresh' }));
    type(1, 'Renamed');
    patchItem.mockResolvedValueOnce(false);
    await act(async () => {
      const first = saveCardRow(h.ctl(), plan as never, 'tbl1', ids().rows[1]!);
      // A second press while the first is on its way does nothing.
      expect(await saveCardRow(h.ctl(), plan as never, 'tbl1', ids().rows[1]!)).toBe(false);
      expect(await first).toBe(false);
    });
    expect(patchItem).toHaveBeenCalledTimes(1);
    expect(table().drafts).toEqual([ids().rows[1]]);
    expect(h.toast).toHaveBeenCalledWith(expect.stringMatching(/could not be saved/));
  });

  it('makes a card of a saved new row and links it, cancels a new row by emptying it, and trashes a deleted row\u2019s card', async () => {
    renderSheet(h, () => <Sync h={h} />);
    type(2, 'New');
    await act(async () => {
      await saveCardRow(h.ctl(), plan as never, 'tbl1', ids().rows[2]!);
    });
    expect(addItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'task', status: 'todo', fields: { title: 'New' } }),
    );
    const id = addItem.mock.calls[0]![0].id!;
    // The item store's own id shape: a UUID (36 characters) is refused there.
    expect(id).toMatch(/^[A-Za-z0-9_-]{6,32}$/);
    expect(table().rows[ids().rows[2]!]).toBe(id);
    type(3, 'Scrap');
    act(() => cancelCardRow(h.ctl(), plan as never, 'tbl1', ids().rows[3]!));
    expect(h.cell('A4')?.input).toBeUndefined();
    act(() => {
      h.ctl().write(
        { kind: 'layout', changes: [{ k: 'deleteRows', ids: [ids().rows[1]!] }] },
        'Rows',
      );
    });
    expect(trashItems).toHaveBeenCalledWith(['i1']);
  });

  it('puts a cancelled card row back from its card, and says why a value is refused', async () => {
    renderSheet(h, () => <Sync h={h} />);
    await waitFor(() => expect(h.cell('A2')?.input).toEqual({ s: 'Fresh' }));
    act(() => {
      h.store.write(
        SHEET_ID,
        {
          kind: 'layout',
          changes: [
            {
              k: 'cardTable',
              id: 'tbl1',
              table: { ...table(), cols: [...table().cols, { c: ids().cols[1]!, field: 'State' }] },
            },
          ],
        },
        { undoable: false },
      );
    });
    act(() => {
      h.ctl().write(
        { kind: 'cells', cells: [{ r: ids().rows[1]!, c: ids().cols[1]!, i: { s: 'Doing' } }] },
        'Cell',
      );
    });
    await act(async () => {
      expect(await saveCardRow(h.ctl(), plan as never, 'tbl1', ids().rows[1]!)).toBe(false);
    });
    expect(h.toast).toHaveBeenCalledWith(expect.stringMatching(/Doing/));
    act(() => cancelCardRow(h.ctl(), plan as never, 'tbl1', ids().rows[1]!));
    await waitFor(() => expect(h.cell('B2')?.input).toEqual({ s: 'To Do' }));
  });

  it('takes its own Save for its own, not a change made elsewhere', async () => {
    renderSheet(h, () => <Sync h={h} />);
    await waitFor(() => expect(h.cell('A2')?.input).toEqual({ s: 'Fresh' }));
    type(1, 'Mine');
    // The store shows the patch at once (a newer revision) before the write comes back.
    let land: (ok: boolean) => void = () => {};
    patchItem.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          plan = {
            ...plan!,
            items: new Map([['i1', { ...card(1, { title: 'Mine', status: 'todo' }), rev: 2 }]]),
          };
          act(() => {
            h.store.write(
              SHEET_ID,
              {
                kind: 'cells',
                cells: [{ r: ids().rows[5]!, c: ids().cols[3]!, i: { s: 'nudge' } }],
              },
              { undoable: false },
            );
          });
          land = resolve;
        }),
    );
    let saved: Promise<boolean> = Promise.resolve(false);
    act(() => {
      saved = saveCardRow(h.ctl(), plan as never, 'tbl1', ids().rows[1]!);
    });
    await act(async () => {
      land(true);
      expect(await saved).toBe(true);
    });
    expect(h.notify).not.toHaveBeenCalled();
    expect(h.cell('A2')?.input).toEqual({ s: 'Mine' });
    expect(table().drafts).toBeUndefined();
  });

  it('puts a draft row back when its card changes elsewhere, saying so', async () => {
    renderSheet(h, () => <Sync h={h} />);
    await waitFor(() => expect(h.cell('A2')?.input).toEqual({ s: 'Fresh' }));
    type(1, 'Mine');
    expect(table().drafts).toEqual([ids().rows[1]]);
    // Someone renames the card on a board: a newer revision.
    plan = {
      ...plan!,
      items: new Map([['i1', { ...card(1, { title: 'Theirs', status: 'todo' }), rev: 2 }]]),
    };
    act(() => {
      h.store.write(
        SHEET_ID,
        { kind: 'cells', cells: [{ r: ids().rows[5]!, c: ids().cols[3]!, i: { s: 'nudge' } }] },
        { undoable: false },
      );
    });
    await waitFor(() => expect(h.cell('A2')?.input).toEqual({ s: 'Theirs' }));
    expect(table().drafts).toBeUndefined();
    expect(h.notify).toHaveBeenCalledWith(
      "Card #1 changed elsewhere, so its row's edits were put back",
    );
  });

  it('does nothing for someone who may only view', async () => {
    plan = { ...plan!, canEdit: false };
    renderSheet(h, () => <Sync h={h} />);
    await h.store.settle();
    expect(h.cell('A2')?.input).toEqual({ s: 'Old' });
    expect(h.push.current).toBeNull();
  });
});
