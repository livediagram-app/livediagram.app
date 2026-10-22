// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ITEMS_MAX, type Item, type ItemTypeDef, type PlanBoardSetup } from '@liveplanner/items';
import { PlanProvider, type PlanContextValue } from '@/components/plan/PlanContext';
import { boardCsvEntryOf } from '@/components/plan/board-csv-registry';

vi.mock('@/lib/download-blob', () => ({ downloadBlob: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const picked = { current: null as { text: string; tooBig?: true } | null };
vi.mock('@/lib/import-tab', () => ({ pickTabFile: vi.fn(async () => picked.current) }));

const {
  BOARD_CSV_ACCEPT,
  BOARD_CSV_FAILED,
  BOARD_CSV_MAX_BYTES,
  BOARD_CSV_TOO_BIG,
  boardCsvText,
  importBoardCsv,
  useBoardCsv,
} = await import('./useBoardCsv');
const { track } = await import('@/lib/telemetry');
const { pickTabFile } = await import('@/lib/import-tab');

// A board's CSV in the editor (docs/specs/026-plan/plan-board.md "CSV").

const task: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#71717a',
  fields: ['title', 'status', 'assignee', 'description'],
};
const setup: PlanBoardSetup = {
  title: 'Road/map',
  columns: [
    { id: 'c1', status: 'todo', name: 'To Do' },
    { id: 'c2', status: 'done', name: 'Done' },
  ],
  swimlaneBy: 'none',
  cardFields: [],
  hideWriting: false,
};
const sam = { id: 'p', name: 'Sam', color: '#2563eb' };
const card: Item = {
  id: 'item0001',
  type: 'task',
  key: 4,
  rank: 'i',
  fields: { title: 'Say "hi", world', status: 'todo', description: 'two\nlines' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: sam,
  updatedBy: sam,
};

function planOf(over: Partial<PlanContextValue> = {}): PlanContextValue {
  return {
    items: new Map([[card.id, card]]),
    types: [task],
    statusNames: new Map(),
    people: [sam],
    canEditCards: true,
    addItems: vi.fn(async () => true),
    announce: vi.fn(),
    notify: vi.fn(),
    ...over,
  } as unknown as PlanContextValue;
}

beforeEach(() => vi.clearAllMocks());

describe('Download CSV', () => {
  it('writes the board’s cards as quoted CSV', () => {
    expect(boardCsvText(planOf(), setup)).toBe(
      'Key,Title,Type,Status,Assignee,Description\r\n4,"Say ""hi"", world",Task,To Do,,"two\nlines"\r\n',
    );
  });

  // docs/specs/029-sheets/sheet.md "CSV": a card titled like a formula never runs in the spreadsheet that opens it.
  it('makes a title a spreadsheet would run as a formula inert', () => {
    const evil = { ...card, fields: { ...card.fields, title: '=HYPERLINK("http://x")' } };
    expect(boardCsvText(planOf({ items: new Map([[evil.id, evil]]) }), setup)).toContain(
      `"'=HYPERLINK(""http://x"")"`,
    );
  });
});

describe('Import CSV…', () => {
  it('adds every row as one write and says how many', async () => {
    const plan = planOf();
    const text = 'Title,Status,Assignee\nOne,Done,sam\n,To Do,\r\n"Two, quoted",,\n';
    expect(await importBoardCsv(plan, setup, text)).toBe('Added 2 cards; skipped 1 row');
    expect(plan.addItems).toHaveBeenCalledOnce();
    expect(plan.addItems).toHaveBeenCalledWith([
      { type: 'task', place: { status: 'done' }, fields: { title: 'One', assignee: sam } },
      { type: 'task', place: { status: 'todo' }, fields: { title: 'Two, quoted' } },
    ]);
    expect(track).toHaveBeenCalledWith('Plan', 'Imported', 'Csv');
  });

  it('reads a tab-separated file', async () => {
    const plan = planOf();
    expect(await importBoardCsv(plan, setup, 'Title\tStatus\nOne\tDone\n')).toBe('Added 1 card');
  });

  it('adds only what the project has room for', async () => {
    const items = new Map(
      Array.from({ length: ITEMS_MAX - 1 }, (_, i) => [`x${i}`, { ...card, id: `x${i}` }] as const),
    );
    const plan = planOf({ items });
    expect(await importBoardCsv(plan, setup, 'Title\nA\nB\n')).toBe('Added 1 card; skipped 1 row');
  });

  it('says so when the cards could not be written', async () => {
    expect(
      await importBoardCsv(planOf({ addItems: vi.fn(async () => false) }), setup, 'Title\nA'),
    ).toBe(BOARD_CSV_FAILED);
    expect(await importBoardCsv(planOf({ addItems: undefined }), setup, 'Title\nA')).toBe(
      BOARD_CSV_FAILED,
    );
  });

  it('explains a file it cannot read', async () => {
    expect(await importBoardCsv(planOf(), setup, 'Name\nA')).toBe('No Title column in the file');
  });
});

describe('useBoardCsv', () => {
  const wrap =
    (plan: PlanContextValue | undefined) =>
    ({ children }: { children: ReactNode }) => <PlanProvider value={plan}>{children}</PlanProvider>;

  it('publishes the board’s actions while it is drawn, and takes them back', () => {
    const { unmount } = renderHook(() => useBoardCsv('b1', setup), { wrapper: wrap(planOf()) });
    expect(boardCsvEntryOf('b1')?.canImport).toBe(true);
    // Its cards' CSV, for the Export dialog's CSV (lib/export-plan/tab-csv.ts).
    expect(boardCsvEntryOf('b1')!.csvText()).toContain('Title');
    unmount();
    expect(boardCsvEntryOf('b1')).toBeUndefined();
  });

  it('lets only someone who may add cards import, never onto an Archive board', () => {
    const viewer = renderHook(() => useBoardCsv('b2', setup), {
      wrapper: wrap(planOf({ canEditCards: false })),
    });
    expect(boardCsvEntryOf('b2')?.canImport).toBe(false);
    viewer.unmount();
    const archive = renderHook(() => useBoardCsv('b3', { ...setup, archive: true }), {
      wrapper: wrap(planOf()),
    });
    expect(boardCsvEntryOf('b3')?.canImport).toBe(false);
    archive.unmount();
  });

  it('publishes nothing outside the editor or before the board is set up', () => {
    renderHook(() => useBoardCsv('b4', setup), { wrapper: wrap(undefined) });
    expect(boardCsvEntryOf('b4')).toBeUndefined();
    renderHook(() => useBoardCsv('b5', null), { wrapper: wrap(planOf()) });
    expect(boardCsvEntryOf('b5')).toBeUndefined();
  });

  it('picks a file, imports it and tells the person', async () => {
    const plan = planOf();
    renderHook(() => useBoardCsv('b6', setup), { wrapper: wrap(plan) });
    picked.current = { text: 'Title\nA\n' };
    boardCsvEntryOf('b6')!.onImportCsv();
    await vi.waitFor(() => expect(plan.notify).toHaveBeenCalledWith('Added 1 card'));
    expect(pickTabFile).toHaveBeenCalledWith(BOARD_CSV_ACCEPT, { maxBytes: BOARD_CSV_MAX_BYTES });
    expect(plan.announce).toHaveBeenCalledWith('Added 1 card');
  });

  it('refuses a file past the limit without reading it, and says why', async () => {
    const plan = planOf();
    renderHook(() => useBoardCsv('b8', setup), { wrapper: wrap(plan) });
    picked.current = { text: '', tooBig: true };
    boardCsvEntryOf('b8')!.onImportCsv();
    await vi.waitFor(() => expect(plan.notify).toHaveBeenCalledWith(BOARD_CSV_TOO_BIG));
    expect(plan.addItems).not.toHaveBeenCalled();
  });

  it('does nothing when the picker is cancelled', async () => {
    const plan = planOf();
    renderHook(() => useBoardCsv('b7', setup), { wrapper: wrap(plan) });
    picked.current = null;
    boardCsvEntryOf('b7')!.onImportCsv();
    await vi.waitFor(() => expect(pickTabFile).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(plan.addItems).not.toHaveBeenCalled();
  });
});
