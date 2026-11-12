import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { Element } from './index';
import { INDEX_ID_MAX } from '@liveworkspace/index-client/constants';
import { collabIndexRowsFromElements } from './collab-index-rows';
import { CELL_INBOX_ROWS_MAX, cellThreadKey, splitCellThreadKey } from './cell-comments';

// A Sheet's cell threads in the Inbox (docs/specs/029-sheets/sheet.md "Cell comments" "Inbox"): one row a cell,
// keyed `<sheetElementId>:<cell>`, labelled by the Sheet and the cell's A1, capped a Sheet.

const B4 = 'rowb4b4:colb4b4';
const C9 = 'rowc9c9:colc9c9';

const comment = (
  id: string,
  at: number,
  authorId?: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  text: `c-${id}`,
  createdAt: at,
  authorName: `Author ${id}`,
  authorColor: '#123456',
  ...(authorId ? { authorId } : {}),
  ...extra,
});

const sheet = (id: string, extra: Record<string, unknown> = {}): Element =>
  ({
    id,
    type: 'shape',
    shape: 'plan-sheet',
    x: 0,
    y: 0,
    width: 960,
    height: 560,
    label: 'Budget',
    planSheet: { sheetId: 'store-1' },
    ...extra,
  }) as never;

describe('cell thread keys', () => {
  it('round-trips a Sheet id and a cell, an id holding a colon among them', () => {
    expect(cellThreadKey('sheet-1', B4)).toBe(`sheet-1:${B4}`);
    expect(splitCellThreadKey(`sheet-1:${B4}`)).toEqual({ elementId: 'sheet-1', cell: B4 });
    expect(splitCellThreadKey(`a:b:${B4}`)).toEqual({ elementId: 'a:b', cell: B4 });
  });

  it('names no cell for a plain id or a key whose tail is not a cell', () => {
    expect(splitCellThreadKey('sheet-1')).toBeNull();
    expect(splitCellThreadKey('a:b')).toBeNull();
    expect(splitCellThreadKey(`:${B4}`)).toBeNull();
    expect(splitCellThreadKey('sheet-1:ROW!:col1')).toBeNull();
  });
});

describe('collabIndexRowsFromElements: cell threads', () => {
  it('lists each cell thread after the Sheet own, keyed by cell so two cells never collide', () => {
    const { threads } = collabIndexRowsFromElements([
      sheet('s1', {
        commentThread: { comments: [comment('own', 50, 'user_a')], resolved: false },
        cellComments: {
          [C9]: { comments: [comment('c9', 300, 'user_c')], resolved: true },
          [B4]: {
            comments: [
              comment('b1', 100, 'user_a', { mentions: [{ userId: 'user_m', name: 'M' }] }),
              comment('b2', 200, 'user_b'),
            ],
            resolved: false,
          },
        },
      }),
    ]);
    expect(threads.map((t) => [t.elementId, t.elementLabel, t.resolved, t.commentCount])).toEqual([
      ['s1', 'Budget', false, 1],
      [`s1:${B4}`, 'Budget', false, 2],
      [`s1:${C9}`, 'Budget', true, 1],
    ]);
    const b4 = threads[1]!;
    expect(b4.participantIds).toEqual(['user_a', 'user_b']);
    expect(b4.mentionedIds).toEqual(['user_m']);
    expect(b4.latestText).toBe('c-b2');
    expect([b4.firstAt, b4.latestAt]).toEqual([100, 200]);
  });

  it('names a row by the stored sheet title and the A1, or the deleted cell, when the sheet is at hand', () => {
    const refs: Record<string, string | null> = { [B4]: 'B4', [C9]: null };
    const sheets = {
      title: (id: string) => (id === 'store-1' ? 'Budget 2026' : undefined),
      cellRef: (id: string, cell: string) => (id === 'store-1' ? refs[cell] : undefined),
    };
    const { threads } = collabIndexRowsFromElements(
      [
        // The element's own label is empty, as a template's Sheet leaves it: the store's title names it.
        sheet('s1', {
          label: '',
          commentThread: { comments: [comment('own', 0)], resolved: false },
          cellComments: {
            [B4]: { comments: [comment('b', 1)], resolved: false },
            [C9]: { comments: [comment('c', 2)], resolved: false },
          },
        }),
        // A Sheet whose store is not at hand keeps its own label and no A1.
        sheet('s2', {
          planSheet: { sheetId: 'store-2' },
          cellComments: { [B4]: { comments: [comment('x', 3)], resolved: false } },
        }),
        // A Sheet with no store reference at all.
        sheet('s3', {
          planSheet: undefined,
          cellComments: { [B4]: { comments: [comment('y', 4)], resolved: false } },
        }),
        // Not a Sheet: its own label, whatever the store holds.
        {
          id: 'n1',
          type: 'sticky',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          label: 'Note',
          commentThread: { comments: [comment('n', 5)], resolved: false },
        } as never,
      ],
      sheets,
    );
    expect(threads.map((t) => t.elementLabel)).toEqual([
      'Budget 2026',
      'Budget 2026!B4',
      'Budget 2026 (Deleted Cell)',
      'Budget',
      'Budget',
      'Note',
    ]);
  });

  it('drops a cell whose last comment was deleted, and a cell thread on an element that takes none', () => {
    const { threads } = collabIndexRowsFromElements([
      sheet('s1', { cellComments: { [B4]: { comments: [], resolved: false } } }),
      sheet('s2', {
        shape: 'square',
        cellComments: { [B4]: { comments: [comment('x', 1)], resolved: false } },
      }),
    ]);
    expect(threads).toEqual([]);
  });

  it('sends no row for a cell whose key would pass the index id limit', () => {
    const long = 'x'.repeat(INDEX_ID_MAX - B4.length);
    const fits = 'y'.repeat(INDEX_ID_MAX - B4.length - 1);
    const cells = { [B4]: { comments: [comment('b', 1)], resolved: false } };
    const { threads } = collabIndexRowsFromElements([
      sheet(long, { cellComments: cells }),
      sheet(fits, { cellComments: cells }),
    ]);
    expect(threads.map((t) => t.elementId)).toEqual([`${fits}:${B4}`]);
    expect(threads[0]!.elementId.length).toBe(INDEX_ID_MAX);
  });

  it('keeps element and card-free rows as they were beside a Sheet', () => {
    const plain = {
      id: 'p1',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      label: 'Plain',
      commentThread: { comments: [comment('p', 5, 'user_a')], resolved: false },
    } as never as Element;
    const alone = collabIndexRowsFromElements([plain]).threads;
    const beside = collabIndexRowsFromElements([
      plain,
      sheet('s1', { cellComments: { [B4]: { comments: [comment('b', 1)], resolved: false } } }),
    ]).threads;
    expect(beside[0]).toEqual(alone[0]);
    expect(beside).toHaveLength(2);
  });

  it(`caps a Sheet at ${CELL_INBOX_ROWS_MAX} cell rows, those with the newest comments`, () => {
    const cells: Record<string, unknown> = {};
    for (let i = 0; i < CELL_INBOX_ROWS_MAX + 20; i++) {
      cells[`row${String(i).padStart(4, '0')}:cola1`] = {
        // The newest comment first, so the pick reads every comment rather than the last.
        comments: [comment(`c${i}`, i), comment(`old${i}`, -1)],
        resolved: false,
      };
    }
    const { threads } = collabIndexRowsFromElements([sheet('s1', { cellComments: cells })]);
    expect(threads).toHaveLength(CELL_INBOX_ROWS_MAX);
    // The 20 oldest (latestAt 0 to 19) are the ones left out.
    expect(Math.min(...threads.map((t) => t.latestAt))).toBe(20);
  });

  it('builds a tab of Sheets with thousands of commented cells within its budget', () => {
    const sheets: Element[] = [];
    for (let s = 0; s < 5; s++) {
      const cells: Record<string, unknown> = {};
      for (let i = 0; i < 2000; i++) {
        cells[`row${String(i).padStart(5, '0')}:col${s}abc`] = {
          comments: Array.from({ length: 5 }, (_, k) =>
            comment(`c${s}-${i}-${k}`, i * 10 + k, `user_${k}`),
          ),
          resolved: i % 3 === 0,
        };
      }
      sheets.push(sheet(`sheet-${s}`, { cellComments: cells }));
    }
    let rows = 0;
    const ms = cpuMsOf(() => {
      rows = collabIndexRowsFromElements(sheets, { title: () => 'Budget', cellRef: () => 'B4' })
        .threads.length;
    });
    expect(rows).toBe(5 * CELL_INBOX_ROWS_MAX);
    expect(ms).toBeLessThan(cpuBudgetMs(150));
  });
});
