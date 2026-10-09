// @vitest-environment jsdom
// The Sheet's header (docs/specs/029-sheets/sheet.md "Header"): the title renamed in place, unique on the tab; the
// Sheet Settings cog (Sheet Setup, Sheet Options, Cells, Freeze, Calculations, Named Ranges); Maximise Sheet.
import { fireEvent, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeSheet,
  renderSheet,
  stubResizeObserver,
  SHEET_ID,
  type SheetHarness,
} from './sheet-ui-test-utils';
import { SheetHeader } from './SheetHeader';
import { downloadSheetCsv } from './sheet-csv';
import { statusPick } from './sheet-status-pick';
import { ROW_HEIGHT_MIN } from '@livediagram/sheets';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('./sheet-csv', () => ({ downloadSheetCsv: vi.fn() }));

beforeAll(stubResizeObserver);

const importCsv = vi.fn();
function show(
  h: SheetHarness,
  opts: { canEdit?: boolean; interactive?: boolean; maximised?: boolean } = {},
) {
  return renderSheet(
    h,
    ({ actions }) => <SheetHeader elementId="el1" actions={actions} onImportCsv={importCsv} />,
    opts,
  );
}
const title = (h: SheetHarness) => h.store.sheet(SHEET_ID)!.title;
const field = () => screen.getByLabelText('Sheet title') as HTMLInputElement;
const cog = () => screen.getByRole('button', { name: 'Sheet Settings' });
const openSettings = () => fireEvent.click(cog());
const section = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const layout = (h: SheetHarness) => h.store.sheet(SHEET_ID)!.layout;

describe('the sheet header', () => {
  let h: SheetHarness;
  beforeEach(async () => {
    h = await makeSheet({ cells: { A1: '1', B2: 'x' }, otherTitles: ['Budget'] });
  });

  it('renames in place on a double-click: Enter saves, Escape cancels, blur saves', () => {
    show(h);
    fireEvent.doubleClick(screen.getByText('Sheet 1'));
    // A press in the field stays there (the header otherwise moves the element).
    fireEvent.pointerDown(field());
    fireEvent.change(field(), { target: { value: '  Costs  ' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(title(h)).toBe('Costs');
    expect(screen.getByText('Costs')).toBeTruthy();
    fireEvent.doubleClick(screen.getByText('Costs'));
    fireEvent.change(field(), { target: { value: 'Ignored' } });
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(screen.queryByLabelText('Sheet title')).toBeNull();
    expect(title(h)).toBe('Costs');
    fireEvent.doubleClick(screen.getByText('Costs'));
    expect(field().value).toBe('Costs');
    fireEvent.change(field(), { target: { value: 'Totals' } });
    fireEvent.keyDown(field(), { key: 'a' });
    fireEvent.blur(field());
    expect(title(h)).toBe('Totals');
  });

  it("renames from a double-click on the header's empty space, not on its buttons, and selects the text", () => {
    show(h);
    fireEvent.doubleClick(cog());
    expect(screen.queryByLabelText('Sheet title')).toBeNull();
    fireEvent.click(screen.getByText('Sheet 1'));
    expect(screen.queryByLabelText('Sheet title')).toBeNull();
    fireEvent.doubleClick(screen.getByText('Sheet 1').parentElement!);
    expect(field().value).toBe('Sheet 1');
    fireEvent.focus(field());
    expect([field().selectionStart, field().selectionEnd]).toEqual([0, 7]);
  });

  it('keeps the title when it is blank or unchanged', async () => {
    show(h);
    fireEvent.doubleClick(screen.getByText('Sheet 1'));
    fireEvent.change(field(), { target: { value: '   ' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    fireEvent.doubleClick(screen.getByText('Sheet 1'));
    fireEvent.keyDown(field(), { key: 'Enter' });
    await h.store.settle();
    expect(h.writes).toEqual([]);
    expect(title(h)).toBe('Sheet 1');
  });

  it('refuses a title another sheet on the tab has, in any case', () => {
    show(h);
    fireEvent.doubleClick(screen.getByText('Sheet 1'));
    fireEvent.change(field(), { target: { value: 'budget' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(h.toast).toHaveBeenCalledWith('Another sheet on this tab is called that');
    expect(title(h)).toBe('Sheet 1');
    // Its own title in another case is a rename, not a clash.
    fireEvent.doubleClick(screen.getByText('Sheet 1'));
    fireEvent.change(field(), { target: { value: 'SHEET 1' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(title(h)).toBe('SHEET 1');
  });

  it('renames, imports and downloads from Sheet Settings', () => {
    show(h);
    openSettings();
    expect(cog().getAttribute('aria-expanded')).toBe('true');
    const name = screen.getByLabelText('Title') as HTMLInputElement;
    expect(name.value).toBe('Sheet 1');
    fireEvent.change(name, { target: { value: 'budget' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(h.toast).toHaveBeenCalledWith('Another sheet on this tab is called that');
    fireEvent.change(name, { target: { value: 'Costs' } });
    fireEvent.blur(name);
    expect(title(h)).toBe('Costs');
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(downloadSheetCsv).toHaveBeenCalledWith(h.store.workbook('t1'), h.store.sheet(SHEET_ID));
    fireEvent.click(screen.getByRole('button', { name: 'Import CSV…' }));
    expect(importCsv).toHaveBeenCalledOnce();
    // Importing closes the popover.
    expect(screen.queryByLabelText('Title')).toBeNull();
  });

  it('sets the view and the default cell sizes, and resets them', () => {
    show(h);
    openSettings();
    section('Sheet Options');
    fireEvent.click(screen.getByRole('switch', { name: /Gridlines/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Row and Column Headers/ }));
    expect(layout(h)).toMatchObject({ showGrid: false, showHeaders: false });
    fireEvent.click(screen.getByRole('switch', { name: /Gridlines/ }));
    expect(layout(h).showGrid).toBeUndefined();
    section('Cells');
    const width = screen.getByLabelText('Column Width') as HTMLInputElement;
    expect(width.value).toBe('120');
    fireEvent.change(width, { target: { value: '15a0' } });
    fireEvent.keyDown(width, { key: 'Enter' });
    expect(layout(h).colWidth).toBe(150);
    const height = screen.getByLabelText('Row Height') as HTMLInputElement;
    fireEvent.change(height, { target: { value: '1' } });
    fireEvent.blur(height);
    // Kept within the limits.
    expect(layout(h).rowHeight).toBe(ROW_HEIGHT_MIN);
    fireEvent.change(height, { target: { value: '' } });
    fireEvent.blur(height);
    fireEvent.change(height, { target: { value: '40' } });
    // Escape closes the popover without saving the draft.
    fireEvent.keyDown(height, { key: 'Escape' });
    expect(screen.queryByLabelText('Row Height')).toBeNull();
    expect(layout(h).rowHeight).toBe(ROW_HEIGHT_MIN);
    openSettings();
    section('Cells');
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Default' }));
    expect([layout(h).colWidth, layout(h).rowHeight]).toEqual([undefined, undefined]);
    expect(screen.queryByRole('button', { name: 'Reset to Default' })).toBeNull();
    // The default typed in clears the setting.
    const again = screen.getByLabelText('Column Width');
    fireEvent.change(again, { target: { value: '140' } });
    fireEvent.blur(again);
    fireEvent.change(again, { target: { value: '120' } });
    fireEvent.blur(again);
    expect(layout(h).colWidth).toBeUndefined();
  });

  it('freezes, and picks the totals under Calculations', () => {
    show(h);
    openSettings();
    section('Freeze');
    const rows = screen.getByLabelText('Frozen Rows') as HTMLInputElement;
    fireEvent.change(rows, { target: { value: '2' } });
    fireEvent.keyDown(rows, { key: 'Enter' });
    fireEvent.change(screen.getByLabelText('Frozen Columns'), { target: { value: '1' } });
    fireEvent.blur(screen.getByLabelText('Frozen Columns'));
    expect([layout(h).frozenRows, layout(h).frozenCols]).toEqual([2, 1]);
    section('Calculations');
    const min = screen.getByRole('checkbox', { name: 'Min' });
    expect(min.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(min);
    expect(statusPick()).toContain('Min');
    fireEvent.click(min);
    expect(statusPick()).not.toContain('Min');
  });

  it('clears the sheet after asking', () => {
    show(h);
    openSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Sheet' }));
    const ask = screen.getByRole('alertdialog', { name: 'Clear Sheet' });
    expect(ask.textContent).toContain('Start Sheet 1 over?');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(h.value('A1')).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Sheet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(h.value('A1')).toBeNull();
    expect(h.value('B2')).toBeNull();
    expect(h.store.sheet(SHEET_ID)!.cells.size).toBe(0);
  });

  it('offers someone who may not edit only Download CSV and the totals, and no rename', () => {
    show(h, { canEdit: false });
    fireEvent.doubleClick(screen.getByText('Sheet 1'));
    expect(screen.queryByLabelText('Sheet title')).toBeNull();
    openSettings();
    expect((screen.getByLabelText('Title') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Import CSV…' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear Sheet' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Sheet Options/ })).toBeNull();
    // Freeze changes the sheet: not offered. The totals are the viewer's own.
    expect(screen.queryByRole('button', { name: /^Freeze/ })).toBeNull();
    section('Calculations');
    expect(screen.getByRole('checkbox', { name: 'Sum' }).getAttribute('aria-checked')).toBe('true');
  });

  it('maximises and restores', () => {
    const view = show(h);
    expect(
      screen.getByRole('button', { name: 'Maximise Sheet' }).getAttribute('aria-pressed'),
    ).toBe('false');
    view.unmount();
    show(h, { maximised: true });
    expect(screen.getByRole('button', { name: 'Restore Sheet' })).toBeTruthy();
  });

  it('shows only the title outside Plan mode', () => {
    show(h, { interactive: false, canEdit: false });
    expect(screen.getByText('Sheet 1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sheet Settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Maximise Sheet' })).toBeNull();
  });
});
