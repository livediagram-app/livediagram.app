// @vitest-environment jsdom
// Cell comments on the grid (docs/specs/029-sheets/sheet.md "Cell comments"): a marker on each cell with an open
// thread, its preview on hover, the anchor the thread popover sits beside, the cell menu's Comment row (by role),
// Ctrl + Alt + M, and the Comments panel naming and selecting a cell.
import { act, cleanup, fireEvent, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CellCommentThreads, Comment } from '@liveplanner/document';
import { cellKey } from '@liveplanner/sheets';
import {
  SheetCellThreadsProvider,
  SheetCommentsProvider,
  SheetsProviders,
  cellCommentAnchorSelector,
  useSheetComments,
} from '@/hooks/sheets/sheet-comments-context';
import { cellRefOf, focusSheetCell, useCellRef } from '@/hooks/sheets/sheet-cell-refs';
import {
  makeSheet,
  renderSheet,
  stubResizeObserver,
  SHEET_ID,
  type SheetHarness,
} from './sheet-ui-test-utils';
import { SheetCellComments } from './SheetCellComments';
import { SheetCellCommentRow } from './SheetCellCommentRow';
import { installGridDom, mountGrid } from './sheet-grid-test-utils';

beforeAll(stubResizeObserver);
afterEach(cleanup);

const comment = (id: string, text: string): Comment => ({
  id,
  text,
  createdAt: 0,
  authorName: 'Priya',
  authorColor: '#000',
});

function keyOf(h: SheetHarness, r: number, c: number) {
  const layout = h.store.sheet(SHEET_ID)!.layout;
  return cellKey(layout.rows[r]!, layout.cols[c]!);
}

type Open = (elementId: string, cell?: string) => void;
type Wiring = {
  open: ReturnType<typeof vi.fn<Open>>;
  canComment: boolean;
  openCell: string | null;
};

function withComments(
  h: SheetHarness,
  threads: CellCommentThreads | undefined,
  wiring: Wiring,
  ui: React.ReactNode,
  hover: { r: number; c: number } | null = null,
) {
  return renderSheet(h, () => (
    <SheetCommentsProvider
      open={wiring.open}
      openId={wiring.openCell ? 'el1' : null}
      openCell={wiring.openCell}
      canComment={wiring.canComment}
    >
      <SheetCellThreadsProvider value={{ elementId: 'el1', threads }}>
        <SheetCellComments hover={hover} />
        {ui}
      </SheetCellThreadsProvider>
    </SheetCommentsProvider>
  ));
}

describe('cell comment markers', () => {
  let h: SheetHarness;
  let wiring: Wiring;
  beforeEach(async () => {
    h = await makeSheet();
    wiring = { open: vi.fn<Open>(), canComment: true, openCell: null };
  });

  it('marks each cell with an open thread, and opens it on a press', () => {
    const b2 = keyOf(h, 1, 1);
    const threads: CellCommentThreads = {
      [b2]: { comments: [comment('a', 'Check')], resolved: false },
      [keyOf(h, 2, 2)]: { comments: [comment('b', 'Done')], resolved: true },
      'gone01:gone02': { comments: [comment('c', 'Lost')], resolved: false },
    };
    withComments(h, threads, wiring, null);
    const markers = screen.getAllByRole('button', { name: /Show Comments on/ });
    expect(markers.map((m) => m.getAttribute('aria-label'))).toEqual(['Show Comments on B2']);
    fireEvent.click(markers[0]!);
    expect(wiring.open).toHaveBeenCalledWith('el1', b2);
  });

  it('draws nothing outside the editor', () => {
    renderSheet(h, () => <SheetCellComments hover={null} />);
    expect(screen.queryByRole('button', { name: /Show Comments/ })).toBeNull();
  });

  it('previews the first comment after a rest on the cell', () => {
    vi.useFakeTimers();
    try {
      const threads = {
        [keyOf(h, 1, 1)]: {
          comments: [comment('a', 'Check this'), comment('b', 'Ok')],
          resolved: false,
        },
      };
      withComments(h, threads, wiring, null, { r: 1, c: 1 });
      expect(screen.queryByRole('tooltip')).toBeNull();
      act(() => {
        vi.advanceTimersByTime(500);
      });
      const card = screen.getByRole('tooltip');
      expect(card.textContent).toContain('Priya');
      expect(card.textContent).toContain('Check this');
      expect(card.textContent).toContain('1 more');
    } finally {
      vi.useRealTimers();
    }
  });

  it('draws the anchor the open thread popover finds', () => {
    const b2 = keyOf(h, 1, 1);
    wiring.openCell = b2;
    const view = withComments(h, undefined, wiring, null);
    expect(view.container.querySelector(cellCommentAnchorSelector('el1', b2))).not.toBeNull();
  });

  it('names its cells for the Comments panel, and selects one on request', () => {
    const b2 = keyOf(h, 1, 1);
    withComments(h, undefined, wiring, null);
    expect(cellRefOf('el1', b2)).toBe('B2');
    expect(cellRefOf('el1', 'gone01:gone02')).toBeNull();
    act(() => focusSheetCell('el1', b2));
    expect(h.ctl().selection.active).toEqual({ r: 1, c: 1 });
    cleanup();
    expect(cellRefOf('el1', b2)).toBeUndefined();
  });
});

describe('the cell menu Comment row', () => {
  let h: SheetHarness;
  beforeEach(async () => {
    h = await makeSheet();
  });

  it('inserts a comment on a cell without one, for an Editor or a Participant', () => {
    const wiring = { open: vi.fn<Open>(), canComment: true, openCell: null };
    const done = vi.fn();
    withComments(h, undefined, wiring, <SheetCellCommentRow onDone={done} />);
    fireEvent.click(screen.getByRole('button', { name: 'Insert Comment' }));
    expect(wiring.open).toHaveBeenCalledWith('el1', keyOf(h, 0, 0));
    expect(done).toHaveBeenCalled();
  });

  it('shows a thread that is there, to a Viewer too, and offers a Viewer nothing else', () => {
    const viewer: Wiring = { open: vi.fn<Open>(), canComment: false, openCell: null };
    const threads = { [keyOf(h, 0, 0)]: { comments: [comment('a', 'x')], resolved: false } };
    withComments(h, threads, viewer, <SheetCellCommentRow onDone={() => {}} />);
    expect(screen.getByRole('button', { name: 'Show Comments' })).toBeTruthy();
    cleanup();
    withComments(h, undefined, viewer, <SheetCellCommentRow onDone={() => {}} />);
    expect(screen.queryByRole('button', { name: /Comment/ })).toBeNull();
  });

  it('opens a merged cell’s thread on its top-left cell', () => {
    const layout = h.store.sheet(SHEET_ID)!.layout;
    act(() => {
      h.store.write(SHEET_ID, {
        kind: 'layout',
        changes: [
          {
            k: 'merge',
            range: {
              r1: layout.rows[0]!,
              c1: layout.cols[0]!,
              r2: layout.rows[1]!,
              c2: layout.cols[1]!,
            },
          },
        ],
      });
    });
    const wiring = { open: vi.fn<Open>(), canComment: true, openCell: null };
    withComments(h, undefined, wiring, <SheetCellCommentRow onDone={() => {}} />);
    act(() => h.select('B2'));
    fireEvent.click(screen.getByRole('button', { name: 'Insert Comment' }));
    expect(wiring.open).toHaveBeenCalledWith('el1', keyOf(h, 0, 0));
  });
});

describe('Ctrl + Alt + M on the grid', () => {
  let restore: () => void;
  beforeEach(() => {
    restore = installGridDom();
  });
  afterEach(() => restore());

  it("opens the active cell's thread", async () => {
    const open = vi.fn();
    const g = await mountGrid({
      wrap: (grid) => (
        <SheetCommentsProvider open={open} openId={null} openCell={null} canComment>
          <SheetCellThreadsProvider value={{ elementId: 'el1', threads: undefined }}>
            {grid}
          </SheetCellThreadsProvider>
        </SheetCommentsProvider>
      ),
    });
    fireEvent.keyDown(g.grid, { code: 'KeyM', key: 'µ', altKey: true, metaKey: true });
    const layout = g.store.sheet(g.sheetId)!.layout;
    const { r, c } = g.c().selection.active;
    expect(open).toHaveBeenCalledWith('el1', cellKey(layout.rows[r]!, layout.cols[c]!));
    fireEvent.keyDown(g.grid, { code: 'KeyM', key: 'm', altKey: false, metaKey: true });
    expect(open).toHaveBeenCalledTimes(1);
  });
});

describe('the editor-level providers', () => {
  it('hands the open cell and actions through, and the bridge beside them', () => {
    const open = vi.fn();
    const on = renderHook(() => useSheetComments(), {
      wrapper: ({ children }) => (
        <SheetsProviders
          bridge={null}
          openComments={open}
          openId="el1"
          openCell="row1:col1"
          canComment={false}
        >
          {children}
        </SheetsProviders>
      ),
    });
    expect(on.result.current?.openCell).toEqual({ elementId: 'el1', cell: 'row1:col1' });
    expect(on.result.current?.canComment).toBe(false);
    on.result.current?.open('el1', 'row1:col1');
    expect(open).toHaveBeenCalledWith('el1', 'row1:col1');
    cleanup();
    const off = renderHook(() => useSheetComments(), {
      wrapper: ({ children }) => (
        <SheetCommentsProvider open={open} openId={null} openCell={null} canComment off>
          {children}
        </SheetCommentsProvider>
      ),
    });
    expect(off.result.current).toBeNull();
  });

  it('names a cell only once its Sheet is drawn', () => {
    const { result } = renderHook(() => useCellRef('nowhere', 'row1:col1'));
    expect(result.current).toBeUndefined();
  });
});
