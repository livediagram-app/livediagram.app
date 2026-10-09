// @vitest-environment jsdom
// The Sheet element (docs/specs/029-sheets/sheet.md; blueprint sheet-element.md "Editor components"): its faces
// while it cannot show the grid (loading, an error with Try Again, gone with Remove for an editor), the grid in
// Plan mode, drawn only elsewhere with a Switch to Plan hint on double-click, Import CSV (an empty sheet replaced at
// once, a filled one asking first), and maximising without losing anything.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLayout, type SheetJson } from '@livediagram/sheets';
import type { Element, ShapeElement } from '@livediagram/document';
import * as api from '@/lib/api/sheets';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { PlanProvider, type PlanContextValue } from '@/components/plan/PlanContext';
import {
  finishRestore,
  getMaximisedPlanId,
  maximisePlanElement,
  releasePlanElement,
} from '@/hooks/plan/maximised-plan';
import { SheetsBridgeContext, type SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import { forgetSheetStores } from './sheet-store-client';
import { pointingTargetFor } from './sheet-pointing';
import { PlanSheetView } from './PlanSheetView';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/api/sheets', () => ({
  fetchSheets: vi.fn(),
  createSheet: vi.fn(),
  writeSheet: vi.fn(),
  deleteSheet: vi.fn(),
}));

const by = { id: 'me', name: 'Me', color: '#000000' };
let seq = 19;
const rand = () => ((seq = (seq * 16807) % 2147483647) - 1) / 2147483646;
let docSeq = 0;
const fetchSheets = vi.mocked(api.fetchSheets);
const writeSheet = vi.mocked(api.writeSheet);

const sheetJson = (id: string, over: Partial<SheetJson> = {}): SheetJson => ({
  id,
  tabId: 't1',
  title: 'Budget',
  layout: emptyLayout(rand, 5, 3),
  cells: [],
  rev: 0,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: by,
  ...over,
});

const element = (planSheet: { sheetId: string; copyOf?: string }): ShapeElement =>
  ({
    id: 'el1',
    type: 'shape',
    shape: 'plan-sheet',
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    planSheet,
  }) as ShapeElement;

function bridge(over: Partial<SheetsBridge> = {}) {
  const b = {
    scope: { documentId: `docV${docSeq++}`, ownerId: 'o', shareCode: null, tabId: null },
    activeTabId: 't1',
    self: by,
    canEdit: true,
    locale: 'en-GB',
    peers: [],
    pushUndo: vi.fn(),
    toast: vi.fn(),
    notify: vi.fn(),
    sendPresence: vi.fn(),
    commitElements: vi.fn(),
    placeElement: vi.fn(),
    tickElements: vi.fn(),
    switchToPlan: vi.fn(),
    selectElement: vi.fn(),
    attach: vi.fn(() => () => {}),
    ...over,
  } satisfies SheetsBridge;
  return b;
}

const announce = vi.fn();
const plan = (planInput = true) =>
  ({
    planInput,
    announce,
    items: new Map(),
    types: [],
    statusNames: new Map(),
  }) as unknown as PlanContextValue;

function draw(el: ShapeElement, b: SheetsBridge | null, p: PlanContextValue | undefined = plan()) {
  const tree = (
    <CanvasSurfaceProvider surface="light">
      <PlanProvider value={p}>
        <SheetsBridgeContext.Provider value={b}>
          <div data-element-id={el.id}>
            <PlanSheetView element={el} fontFamily="Inter" />
          </div>
        </SheetsBridgeContext.Provider>
      </PlanProvider>
    </CanvasSurfaceProvider>
  );
  return render(tree);
}

// jsdom has no ResizeObserver; the toolbar and grid only measure with one.
class NoResize {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', NoResize);
  // jsdom lays nothing out: scrolling the active cell into view is a no-op.
  Element.prototype.scrollTo = () => {};
  vi.clearAllMocks();
  forgetSheetStores();
  fetchSheets.mockResolvedValue([]);
  // The server takes each write as sent (they go one at a time, each after the last is answered).
  let rev = 0;
  writeSheet.mockImplementation(async (_s, _id, req) => ({
    applied: req.write,
    rev: ++rev,
    cells: [],
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  finishRestore();
  releasePlanElement(getMaximisedPlanId() ?? '');
  cleanup();
});

describe('the faces', () => {
  it('draws only the frame and its title outside the editor', () => {
    draw(element({ sheetId: 'sheetAAAA' }), null, undefined);
    expect(screen.getByText('Sheet')).toBeTruthy();
    expect(fetchSheets).not.toHaveBeenCalled();
  });

  it('says Loading while the tab loads', () => {
    fetchSheets.mockReturnValue(new Promise(() => {}));
    draw(element({ sheetId: 'sheetAAAA' }), bridge());
    expect(screen.getByText('Opening Sheet')).toBeTruthy();
  });

  it('offers Try Again when the tab could not load, and loads again', async () => {
    fetchSheets.mockRejectedValueOnce(new Error('offline'));
    draw(element({ sheetId: 'sheetAAAA' }), bridge());
    await screen.findByText("Couldn't load this sheet");
    fetchSheets.mockResolvedValueOnce([sheetJson('sheetAAAA')]);
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await screen.findByText('Budget');
    expect(fetchSheets).toHaveBeenCalledTimes(2);
  });

  it('offers an editor Remove for a sheet no longer in the document', async () => {
    const b = bridge();
    draw(element({ sheetId: 'goneAAAA1' }), b);
    await screen.findByText('This sheet is no longer in this document');
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    const map = vi.mocked(b.commitElements).mock.calls[0]![0] as (els: Element[]) => Element[];
    const els = [{ id: 'el1' }, { id: 'el2' }] as Element[];
    expect(map(els).map((e) => e.id)).toEqual(['el2']);
  });

  it('offers no Remove to someone who cannot edit', async () => {
    draw(element({ sheetId: 'goneAAAA1' }), bridge({ canEdit: false }));
    await screen.findByText('This sheet is no longer in this document');
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('says Loading for a copy still being made', async () => {
    draw(element({ sheetId: 'copyAAAA1', copyOf: 'srcAAAAA1' }), bridge({ canEdit: false }));
    await waitFor(() => expect(fetchSheets).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.getByText('Opening Sheet')).toBeTruthy();
  });
});

describe('the grid', () => {
  it('draws the sheet with its toolbar and formula bar in Plan mode', async () => {
    fetchSheets.mockResolvedValue([sheetJson('sheetAAAA')]);
    const b = bridge();
    draw(element({ sheetId: 'sheetAAAA' }), b);
    await screen.findByText('Budget');
    expect(document.querySelector('[data-plan-slot="el1"]')).toBeTruthy();
    // Moving announces the cell through the board's live region.
    fireEvent.keyDown(screen.getByLabelText('Budget grid'), { key: 'ArrowDown' });
    expect(announce).toHaveBeenCalledWith('A2');
    expect(document.body.textContent).toContain('A');
    // Double-clicking a Sheet in Plan mode offers nothing.
    fireEvent.doubleClick(screen.getByText('Budget'));
    expect(screen.queryByRole('dialog', { name: 'Switch to Plan' })).toBeNull();
  });

  it('offers Plan on a double-click outside Plan mode', async () => {
    fetchSheets.mockResolvedValue([sheetJson('sheetAAAA')]);
    const b = bridge();
    draw(element({ sheetId: 'sheetAAAA' }), b, plan(false));
    await screen.findByText('Budget');
    fireEvent.doubleClick(screen.getByText('Budget'));
    const hint = screen.getByRole('dialog', { name: 'Switch to Plan' });
    expect(hint.textContent).toContain('Switch to Plan to edit this sheet');
    fireEvent.click(screen.getByRole('button', { name: 'Not Now' }));
    expect(screen.queryByRole('dialog', { name: 'Switch to Plan' })).toBeNull();
    expect(b.switchToPlan).not.toHaveBeenCalled();
    fireEvent.doubleClick(screen.getByText('Budget'));
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Plan' }));
    expect(b.switchToPlan).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Switch to Plan' })).toBeNull();
  });

  it('draws a read-only Sheet without the toolbar', async () => {
    fetchSheets.mockResolvedValue([sheetJson('sheetAAAA')]);
    draw(element({ sheetId: 'sheetAAAA' }), bridge({ canEdit: false }));
    await screen.findByText('Budget');
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
  });

  it('tracks focus within the Sheet', async () => {
    fetchSheets.mockResolvedValue([sheetJson('sheetAAAA')]);
    draw(element({ sheetId: 'sheetAAAA' }), bridge());
    const title = await screen.findByText('Budget');
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    fireEvent.focus(title);
    fireEvent.blur(title, { relatedTarget: outside });
    const menu = document.createElement('div');
    menu.setAttribute('data-menu-surface', '');
    const item = document.createElement('button');
    menu.appendChild(item);
    document.body.appendChild(menu);
    fireEvent.focus(title);
    fireEvent.blur(title, { relatedTarget: item });
    outside.remove();
    menu.remove();
  });
});

describe('pointing into a formula', () => {
  it("lets another sheet of the tab put its cells in this sheet's formula while it is written", async () => {
    fetchSheets.mockResolvedValue([sheetJson('sheetAAAA')]);
    draw(element({ sheetId: 'sheetAAAA' }), bridge());
    await screen.findByText('Budget');
    expect(pointingTargetFor('sheetBBBB', 't1')).toBeNull();
    const grid = screen.getByLabelText('Budget grid');
    fireEvent.keyDown(grid, { key: '=' });
    const editor = await waitFor(() => {
      const el = document.querySelector<HTMLTextAreaElement>('[data-sheet-editor="sheetAAAA"]');
      if (!el) throw new Error('no editor');
      return el;
    });
    const target = pointingTargetFor('sheetBBBB', 't1')!;
    expect(target).toBeTruthy();
    // The sheet itself is never its own target.
    expect(pointingTargetFor('sheetAAAA', 't1')).toBeNull();
    let ok = false;
    act(() => {
      ok = target.point({ r: 1, c: 1 }, { r: 1, c: 1 }, 'Other');
    });
    expect(ok).toBe(true);
    await waitFor(() => expect(editor.value).toBe('=Other!B2'));
    // A drag grows the pointed reference into a range.
    act(() => {
      target.point({ r: 1, c: 1 }, { r: 2, c: 2 }, 'Other');
    });
    await waitFor(() => expect(editor.value).toBe('=Other!B2:C3'));
    const focus = vi.spyOn(editor, 'focus');
    act(() => target.refocus());
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    // Typing on: a point where no reference fits is refused.
    fireEvent.change(editor, { target: { value: '=SUM' } });
    await waitFor(() => expect(editor.value).toBe('=SUM'));
    act(() => {
      ok = target.point({ r: 0, c: 0 }, { r: 0, c: 0 }, '');
    });
    expect(ok).toBe(false);
    // The edit ends: the target goes.
    fireEvent.keyDown(editor, { key: 'Escape' });
    await waitFor(() => expect(pointingTargetFor('sheetBBBB', 't1')).toBeNull());
    expect(target.point({ r: 0, c: 0 }, { r: 0, c: 0 }, '')).toBe(false);
  });

  it('refocuses nothing once the editor has gone', async () => {
    fetchSheets.mockResolvedValue([sheetJson('sheetAAAA')]);
    draw(element({ sheetId: 'sheetAAAA' }), bridge());
    await screen.findByText('Budget');
    fireEvent.keyDown(screen.getByLabelText('Budget grid'), { key: '=' });
    await waitFor(() => expect(pointingTargetFor('sheetBBBB', 't1')).toBeTruthy());
    const target = pointingTargetFor('sheetBBBB', 't1')!;
    document.querySelector('[data-sheet-editor="sheetAAAA"]')!.remove();
    expect(() => target.refocus()).not.toThrow();
  });
});

describe('the Switch to Plan hint and the import prompt', () => {
  it('keep a press inside them from reaching the canvas', async () => {
    fetchSheets.mockResolvedValue([sheetJson('sheetAAAA')]);
    draw(element({ sheetId: 'sheetAAAA' }), bridge(), plan(false));
    await screen.findByText('Budget');
    fireEvent.doubleClick(screen.getByText('Budget'));
    const outer = vi.fn();
    document.body.addEventListener('pointerdown', outer);
    fireEvent.pointerDown(screen.getByRole('dialog', { name: 'Switch to Plan' }));
    document.body.removeEventListener('pointerdown', outer);
    expect(outer).not.toHaveBeenCalled();
  });
});

describe('Import CSV', () => {
  const pick = (container: HTMLElement, text: string) => {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File([text], 'data.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', { value: async () => text });
    fireEvent.change(input, { target: { files: [file] } });
    return input;
  };
  const sentCells = () =>
    writeSheet.mock.calls.flatMap(([, , req]) =>
      req.write.kind === 'cells' ? req.write.cells : [],
    );

  it('shows Setup Sheet for a placed sheet awaiting setup, and ends setup once cells arrive', async () => {
    const layout = { ...emptyLayout(rand, 5, 3), setupPending: true as const };
    fetchSheets.mockResolvedValue([sheetJson('sheetAAAA', { layout })]);
    draw(element({ sheetId: 'sheetAAAA' }), bridge());
    expect(await screen.findByRole('heading', { name: 'Setup Sheet' })).toBeTruthy();
    expect(screen.queryByRole('grid')).toBeNull();
    // A sheet with cells (an agent filled it) puts it away and is no longer pending.
    cleanup();
    forgetSheetStores();
    fetchSheets.mockResolvedValue([
      sheetJson('sheetAAAA', {
        layout,
        cells: [{ r: layout.rows[0]!, c: layout.cols[0]!, i: { n: 1 } }],
      }),
    ]);
    draw(element({ sheetId: 'sheetAAAA' }), bridge());
    await screen.findByText('Budget');
    expect(screen.queryByRole('heading', { name: 'Setup Sheet' })).toBeNull();
    await waitFor(() =>
      expect(
        writeSheet.mock.calls.some(
          ([, , req]) =>
            req.write.kind === 'layout' &&
            req.write.changes.some((ch) => ch.k === 'options' && ch.setupPending === false),
        ),
      ).toBe(true),
    );
  });

  it('opens the file picker from the header menu', async () => {
    fetchSheets.mockResolvedValue([sheetJson('sheetAAAA')]);
    const { container } = draw(element({ sheetId: 'sheetAAAA' }), bridge());
    await screen.findByText('Budget');
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Sheet Settings' }));
    fireEvent.click(await screen.findByText('Import CSV…'));
    expect(click).toHaveBeenCalled();
  });

  it('replaces an empty sheet at once', async () => {
    fetchSheets.mockResolvedValue([sheetJson('sheetAAAA')]);
    const { container } = draw(element({ sheetId: 'sheetAAAA' }), bridge());
    await screen.findByText('Budget');
    const input = pick(container, 'x,1');
    expect(input.value).toBe('');
    await waitFor(() =>
      expect(sentCells().some((c) => c.i && 's' in c.i && c.i.s === 'x')).toBe(true),
    );
    expect(screen.queryByRole('dialog', { name: 'Import CSV' })).toBeNull();
  });

  it('ignores a change with no file', async () => {
    fetchSheets.mockResolvedValue([sheetJson('sheetAAAA')]);
    const { container } = draw(element({ sheetId: 'sheetAAAA' }), bridge());
    await screen.findByText('Budget');
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [] } });
    await act(async () => {});
    expect(writeSheet).not.toHaveBeenCalled();
  });

  async function filled() {
    const s = sheetJson('sheetAAAA');
    s.cells = [{ r: s.layout.rows[0]!, c: s.layout.cols[0]!, i: { s: 'old' } }];
    fetchSheets.mockResolvedValue([s]);
    const view = draw(element({ sheetId: 'sheetAAAA' }), bridge());
    await screen.findByText('Budget');
    pick(view.container, 'new');
    const prompt = await screen.findByRole('dialog', { name: 'Import CSV' });
    expect(screen.getByText('This sheet already has cells.')).toBeTruthy();
    const outer = vi.fn();
    document.body.addEventListener('pointerdown', outer);
    fireEvent.pointerDown(prompt);
    document.body.removeEventListener('pointerdown', outer);
    expect(outer).not.toHaveBeenCalled();
    return s;
  }

  it('asks first for a filled sheet: Cancel changes nothing', async () => {
    await filled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Import CSV' })).toBeNull();
    expect(writeSheet).not.toHaveBeenCalled();
  });

  it('asks first for a filled sheet: Replace Sheet clears it and reads the file from A1', async () => {
    const s = await filled();
    fireEvent.click(screen.getByRole('button', { name: 'Replace Sheet' }));
    expect(screen.queryByRole('dialog', { name: 'Import CSV' })).toBeNull();
    await waitFor(() => expect(writeSheet).toHaveBeenCalled());
    const cells = sentCells();
    // A1 cleared, then the file written to A1.
    expect(
      cells.filter((c) => c.r === s.layout.rows[0] && c.c === s.layout.cols[0]).map((c) => c.i),
    ).toEqual([null, { s: 'new' }]);
  });

  it('asks first for a filled sheet: Insert at Selection keeps the other cells', async () => {
    await filled();
    fireEvent.click(screen.getByRole('button', { name: 'Insert at Selection' }));
    expect(screen.queryByRole('dialog', { name: 'Import CSV' })).toBeNull();
    await waitFor(() => expect(writeSheet).toHaveBeenCalled());
    expect(sentCells().some((c) => c.i === null)).toBe(false);
  });
});

describe('maximising', () => {
  it('moves the same Sheet into the overlay and lets go of it outside Plan mode', async () => {
    fetchSheets.mockResolvedValue([sheetJson('sheetAAAA')]);
    const b = bridge();
    const el = element({ sheetId: 'sheetAAAA' });
    const view = draw(el, b);
    const title = await screen.findByText('Budget');
    act(() => maximisePlanElement('el1', 'Sheet'));
    expect(document.querySelector('[data-maximised-board]')).toBeTruthy();
    expect(screen.getByText('Budget')).toBe(title);
    const slot = document.querySelector<HTMLElement>('[data-plan-slot="el1"]')!;
    expect(slot.style.borderStyle).toBe('solid');
    // Leaving Plan mode lets the maximised Sheet go.
    view.rerender(
      <CanvasSurfaceProvider surface="light">
        <PlanProvider value={plan(false)}>
          <SheetsBridgeContext.Provider value={b}>
            <div data-element-id="el1">
              <PlanSheetView element={el} />
            </div>
          </SheetsBridgeContext.Provider>
        </PlanProvider>
      </CanvasSurfaceProvider>,
    );
    expect(getMaximisedPlanId()).toBeNull();
  });
});
