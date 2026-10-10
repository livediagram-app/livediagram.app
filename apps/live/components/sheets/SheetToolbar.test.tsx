// @vitest-environment jsdom
// The Sheet's toolbar (docs/specs/029-sheets/sheet.md "Toolbar", "Formatting", "Freeze"): every group acts on the
// selection and shows the active cell's state; groups that do not fit fold into More.
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { track } from '@/lib/telemetry';
import {
  makeSheet,
  renderSheet,
  stubResizeObserver,
  SHEET_ID,
  type SheetHarness,
} from './sheet-ui-test-utils';
import { SheetToolbar } from './SheetToolbar';
import { FUNCTION_FAMILY_LABELS } from './SheetFunctionMenu';
import { FUNCTION_FAMILIES } from '@livediagram/sheets';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
let phone = false;
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({ useIsMobileViewport: () => phone }));
vi.mock('@/hooks/ui/useColourPalette', () => ({
  useColourPalette: () => ({
    swatches: { presets: ['#ff0000', '#00ff00'] },
  }),
}));

let width = 1000;
beforeAll(() => {
  stubResizeObserver();
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return width;
    },
  });
});
afterEach(() => {
  width = 1000;
  phone = false;
  vi.mocked(track).mockClear();
});

function show(h: SheetHarness) {
  return renderSheet(h, ({ actions }) => <SheetToolbar actions={actions} />);
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Which category shows each button (sheet-toolbar-categories.tsx).
const CATEGORY_OF: Record<string, string> = {
  Bold: 'Text',
  Italic: 'Text',
  Underline: 'Text',
  Strikethrough: 'Text',
  Borders: 'Cells',
  'Align Left': 'Cells',
  'Align Centre': 'Cells',
  'Align Right': 'Cells',
  'Align Top': 'Cells',
  'Align Middle': 'Cells',
  'Align Bottom': 'Cells',
  'Merge Cells': 'Cells',
  'Wrap Text': 'Cells',
  'Clear Formatting': 'Cells',
  'Number Format': 'Numbers',
  'Fewer Decimals': 'Numbers',
  'More Decimals': 'Numbers',
  Sort: 'Data',
  Filter: 'Data',
  Freeze: 'Data',
  'Bar Chart': 'Charts',
  'Line Chart': 'Charts',
  'Pie Chart': 'Charts',
  'Maths Functions': 'Functions',
  'Statistics Functions': 'Functions',
  'All Functions': 'Functions',
  'Lookup Functions': 'Functions',
};
// Switch the toolbar to a category through its switcher.
const pickCategory = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Toolbar category' }));
  fireEvent.click(screen.getByRole('option', { name: new RegExp(name) }));
};
// A toolbar button by its exact name, switching to its category when it is not showing.
const btn = (name: string) => {
  const showing = screen.queryByRole('button', { name });
  if (showing) return showing;
  if (CATEGORY_OF[name]) pickCategory(CATEGORY_OF[name]);
  return screen.getByRole('button', { name });
};
// A menu row (a command menu's item), after its check mark or glyph if it has one.
const row = (label: string) =>
  screen.getByRole('menuitem', { name: new RegExp(`^(\\S\\s*)?${esc(label)}$`) });
const checked = (label: string) => row(label).textContent!.includes('✓');
const open = (name: string) => fireEvent.click(btn(name));

describe('the sheet toolbar', () => {
  let h: SheetHarness;
  beforeEach(async () => {
    h = await makeSheet({ cells: { A1: '1.5', A2: '2', B1: 'x' } });
  });

  it('makes a chart from the selection, or the data around the cell, and says so when there is none', () => {
    show(h);
    act(() => h.select('A1:A2'));
    fireEvent.click(btn('Bar Chart'));
    const [kind, range] = h.placeChart.mock.calls[0]!;
    expect(kind).toBe('bar-chart');
    const { rows, cols } = h.store.sheet(SHEET_ID)!.layout;
    expect(range).toEqual({ r1: rows[0], c1: cols[0], r2: rows[1], c2: cols[0] });
    act(() => h.select('A1'));
    fireEvent.click(btn('Pie Chart'));
    expect(h.placeChart.mock.calls[1]![1]).toEqual({
      r1: rows[0],
      c1: cols[0],
      r2: rows[1],
      c2: cols[1],
    });
    act(() => h.select('F9'));
    fireEvent.click(btn('Line Chart'));
    expect(h.toast).toHaveBeenCalledWith('Select the cells to chart first');
    expect(h.placeChart).toHaveBeenCalledTimes(2);
  });

  it('keeps presses to itself, and leaves Undo and Redo to the canvas', () => {
    const outer = vi.fn();
    renderSheet(h, ({ actions }) => (
      <div onPointerDown={outer} onDoubleClick={outer}>
        <SheetToolbar actions={actions} />
      </div>
    ));
    fireEvent.pointerDown(screen.getByRole('toolbar', { name: 'Sheet formatting' }));
    fireEvent.doubleClick(screen.getByRole('toolbar', { name: 'Sheet formatting' }));
    expect(outer).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Redo' })).toBeNull();
  });

  it('toggles bold, italic, underline and strikethrough over the selection, pressed from the active cell', async () => {
    show(h);
    act(() => h.select('A1:A2'));
    for (const [label, flag] of [
      ['Bold', 'b'],
      ['Italic', 'i'],
      ['Underline', 'u'],
      ['Strikethrough', 'st'],
    ] as const) {
      expect(btn(label).getAttribute('aria-pressed')).toBe('false');
      fireEvent.click(btn(label));
      expect(h.cell('A1')?.format?.[flag]).toBe(true);
      expect(h.cell('A2')?.format?.[flag]).toBe(true);
      expect(btn(label).getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(btn(label));
      expect(h.cell('A1')?.format?.[flag]).toBeUndefined();
      expect(btn(label).getAttribute('aria-pressed')).toBe('false');
    }
    await h.store.settle();
    expect(h.writes.length).toBe(8);
    expect(track).toHaveBeenCalledWith('Sheet', 'Changed', 'Format');
  });

  it('sets number formats, currency included, with the current one checked', () => {
    show(h);
    open('Number Format');
    expect(btn('Number Format').getAttribute('aria-expanded')).toBe('true');
    expect(checked('Automatic')).toBe(true);
    fireEvent.click(row('Currency ($)'));
    expect(h.cell('A1')?.format).toMatchObject({ nf: 'currency', cur: '$' });
    expect(screen.queryByRole('menuitem', { name: /Automatic/ })).toBeNull();
    open('Number Format');
    expect(checked('Currency ($)')).toBe(true);
    expect(checked('Currency (£)')).toBe(false);
    fireEvent.click(row('Percent'));
    expect(h.cell('A1')?.format?.nf).toBe('percent');
    open('Number Format');
    fireEvent.click(row('Automatic'));
    expect(h.cell('A1')?.format?.nf).toBeUndefined();
  });

  it('steps the decimals from the value shown', () => {
    show(h);
    fireEvent.click(btn('More Decimals'));
    expect(h.cell('A1')?.format?.dp).toBe(2);
    fireEvent.click(btn('Fewer Decimals'));
    fireEvent.click(btn('Fewer Decimals'));
    expect(h.cell('A1')?.format?.dp).toBe(0);
  });

  it('colours the text and the fill from their swatches or the full picker', () => {
    show(h);
    pickCategory('Text');
    // The theme's first colours as swatches, the cell's own ringed.
    // The Theme Palette's first five, drawn with the one swatch and named by colour words, then +.
    const swatches = within(screen.getByRole('group', { name: 'Text Colour' }))
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-pressed'));
    expect(swatches).toHaveLength(5);
    expect(swatches[0]!.getAttribute('aria-label')).not.toMatch(/#/);
    fireEvent.click(swatches[0]!);
    expect(h.cell('A1')?.format?.fc).toMatch(/^#[0-9a-f]{6}$/i);
    expect(swatches[0]!.getAttribute('aria-pressed')).toBe('true');
    const more = () => fireEvent.click(screen.getByRole('button', { name: 'More Text Colours' }));
    more();
    fireEvent.click(screen.getByRole('button', { name: 'No text colour' }));
    expect(h.cell('A1')?.format?.fc).toBeUndefined();
    pickCategory('Cells');
    // The fill as the text: swatches on the toolbar, + for the full picker.
    const fills = within(screen.getByRole('group', { name: 'Fill Colour' }))
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-pressed'));
    expect(fills).toHaveLength(5);
    fireEvent.click(fills[1]!);
    expect(h.cell('A1')?.format?.bg).toMatch(/^#[0-9a-f]{6}$/i);
    expect(fills[1]!.getAttribute('aria-pressed')).toBe('true');
    const moreFill = () =>
      fireEvent.click(screen.getByRole('button', { name: 'More Fill Colours' }));
    moreFill();
    // The full picker: the Theme Palette (the theme's colours, by word), the standard colours, + for a custom one.
    const palette = screen.getByRole('group', { name: 'Theme Palette' });
    fireEvent.click(within(palette).getByRole('button', { name: 'Green' }));
    expect(h.cell('A1')?.format?.bg).toBe('#00ff00');
    const custom = (hex: string) => {
      fireEvent.click(screen.getByRole('button', { name: 'Add a custom colour' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Hex' }), { target: { value: hex } });
      fireEvent.click(screen.getByRole('button', { name: 'Use' }));
    };
    moreFill();
    custom('#123456');
    expect(h.cell('A1')?.format?.bg).toBe('#123456');
    moreFill();
    fireEvent.click(screen.getByRole('button', { name: 'No fill colour' }));
    expect(h.cell('A1')?.format?.bg).toBeUndefined();
    pickCategory('Text');
    more();
    custom('#ABCDEF');
    expect(h.cell('A1')?.format?.fc).toBe('#abcdef');
    // Its header row closes it.
    more();
    fireEvent.click(screen.getByRole('button', { name: 'Text', expanded: true }));
    expect(screen.queryByRole('button', { name: 'No text colour' })).toBeNull();
  });

  it('sets the font size with − and +, or typed, 10 being the default', () => {
    show(h);
    pickCategory('Text');
    const field = screen.getByLabelText('Font Size') as HTMLInputElement;
    expect(field.value).toBe('10');
    fireEvent.click(screen.getByRole('button', { name: 'Increase Font Size' }));
    expect(h.cell('A1')?.format?.fs).toBe(11);
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Font Size' }));
    expect(h.cell('A1')?.format?.fs).toBeUndefined();
    fireEvent.change(field, { target: { value: '15' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(h.cell('A1')?.format?.fs).toBe(15);
    // Out of range is kept within the limits.
    fireEvent.change(field, { target: { value: '400' } });
    fireEvent.blur(field);
    expect(h.cell('A1')?.format?.fs).toBe(96);
  });

  it('offers the sizes as a menu once Font Size folds into More', () => {
    width = 0;
    show(h);
    pickCategory('Text');
    expect(screen.queryByLabelText('Font Size')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(row('Font Size'));
    expect(checked('10')).toBe(true);
    fireEvent.click(row('14'));
    expect(h.cell('A1')?.format?.fs).toBe(14);
  });

  it('draws borders in the line style picked, kept for the next time', () => {
    show(h);
    act(() => h.select('A1:B2'));
    open('Borders');
    const lineOf = (name: string) => screen.getByRole('menuitemradio', { name });
    const lineOn = (name: string) => lineOf(name).getAttribute('aria-checked') === 'true';
    expect(lineOn('Thin')).toBe(true);
    fireEvent.click(lineOf('Dashed'));
    // Picking a line keeps the menu open, with the line checked.
    expect(lineOn('Dashed')).toBe(true);
    fireEvent.click(row('All Borders'));
    const dashed = expect.objectContaining({ w: 1, s: 'dashed' });
    expect(h.cell('A1')?.format).toMatchObject({ bt: dashed, bl: dashed });
    expect(h.cell('B2')?.format).toMatchObject({ bb: dashed, br: dashed });
    open('Borders');
    expect(lineOn('Dashed')).toBe(true);
    fireEvent.click(lineOf('Thick'));
    fireEvent.click(row('Outer Borders'));
    expect(h.cell('A1')?.format?.bt).toMatchObject({ w: 3, s: 'solid' });
    open('Borders');
    fireEvent.click(lineOf('Thin'));
    fireEvent.click(row('No Borders'));
    expect(h.cell('A1')?.format?.bt).toBeUndefined();
  });

  it('merges straight away when nothing is lost, and asks first when values would be', () => {
    show(h);
    act(() => h.select('C1:D1'));
    open('Merge Cells');
    fireEvent.click(row('Merge Across'));
    expect(h.store.sheet('sheet0001')!.layout.merges).toHaveLength(1);
    expect(screen.queryByRole('menuitem', { name: 'Merge All' })).toBeNull();
    open('Merge Cells');
    fireEvent.click(row('Unmerge'));
    expect(h.store.sheet('sheet0001')!.layout.merges ?? []).toHaveLength(0);
    // A1:B1 both hold values: merging would keep only A1's.
    act(() => h.select('A1:B1'));
    open('Merge Cells');
    fireEvent.click(row('Merge All'));
    const ask = screen.getByRole('alertdialog', { name: 'Merge Cells' });
    expect(ask.textContent).toContain('Merge A1:B1?');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(h.store.sheet('sheet0001')!.layout.merges ?? []).toHaveLength(0);
    fireEvent.click(row('Merge All'));
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    expect(h.store.sheet('sheet0001')!.layout.merges).toHaveLength(1);
    expect(h.value('B1')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('cascades a category\u2019s buttons in on a switch, not on first paint, with dividers between groups', () => {
    show(h);
    expect(screen.getByRole('toolbar').querySelector('.lvd-cascade')).toBeNull();
    pickCategory('Data');
    pickCategory('Cells');
    expect(btn('Align Left').closest('.lvd-cascade')).toBeTruthy();
    // Fill, borders, the horizontal and vertical alignments, merge and wrap, then Clear Formatting.
    const toolbar = btn('Align Left').closest('[role=toolbar]')!;
    expect(toolbar.querySelectorAll('span[aria-hidden].w-px')).toHaveLength(5);
  });

  it('offers every function, a menu per family, each starting its function in the active cell', () => {
    width = 2400;
    show(h);
    pickCategory('Functions');
    for (const [family] of FUNCTION_FAMILIES)
      expect(
        screen.getByRole('button', { name: `${FUNCTION_FAMILY_LABELS[family]} Functions` }),
      ).toBeTruthy();
    fireEvent.click(btn('Lookup Functions'));
    const lookups = Object.keys(FUNCTION_FAMILIES.find(([f]) => f === 'Lookup')![1]);
    for (const name of lookups)
      expect(screen.getByRole('menuitem', { name: `Insert ${name}` })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Insert VLOOKUP' }));
    expect(h.ctl().editing).toMatchObject({ draft: '=VLOOKUP(', origin: 'type' });
  });

  it('aligns with a button each, pressed for the active cell, and wraps', () => {
    show(h);
    open('Align Centre');
    expect(h.cell('A1')?.format?.ha).toBe('c');
    expect(btn('Align Centre').getAttribute('aria-pressed')).toBe('true');
    open('Align Right');
    expect(h.cell('A1')?.format?.ha).toBe('r');
    // Pressed again, back to automatic.
    open('Align Right');
    expect(h.cell('A1')?.format?.ha).toBeUndefined();
    open('Align Left');
    expect(h.cell('A1')?.format?.ha).toBe('l');
    // Middle is the default: pressed with nothing set, and pressing it clears the setting.
    expect(btn('Align Middle').getAttribute('aria-pressed')).toBe('true');
    open('Align Top');
    expect(h.cell('A1')?.format?.va).toBe('t');
    open('Align Bottom');
    expect(h.cell('A1')?.format?.va).toBe('b');
    open('Align Middle');
    expect(h.cell('A1')?.format?.va).toBeUndefined();
    open('Wrap Text');
    fireEvent.click(row('Wrap'));
    expect(h.cell('A1')?.format?.wr).toBe('w');
    open('Wrap Text');
    fireEvent.click(row('Clip'));
    expect(h.cell('A1')?.format?.wr).toBe('c');
    open('Wrap Text');
    fireEvent.click(row('Overflow'));
    expect(h.cell('A1')?.format?.wr).toBeUndefined();
  });

  it('sorts the sheet by the active column, and opens Custom Sort', () => {
    show(h);
    open('Sort');
    fireEvent.click(row('Sort Sheet Z to A'));
    expect(h.value('A1')).toBe(2);
    expect(h.announce).toHaveBeenCalledWith('Sorted Z to A');
    open('Sort');
    fireEvent.click(row('Sort Sheet A to Z'));
    expect(h.value('A1')).toBe(1.5);
    open('Sort');
    fireEvent.click(row('Custom Sort…'));
    expect(h.ctl().menu).toEqual({ kind: 'sort' });
  });

  it('toggles the filter, pressed while it is on', () => {
    show(h);
    act(() => h.select('A1:B2'));
    fireEvent.click(btn('Filter'));
    expect(h.store.sheet('sheet0001')!.layout.filter).toBeTruthy();
    expect(btn('Filter').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(btn('Filter'));
    expect(h.store.sheet('sheet0001')!.layout.filter).toBeFalsy();
  });

  it('freezes rows and columns, up to the active cell', () => {
    show(h);
    act(() => h.select('C3'));
    open('Freeze');
    expect(checked('No Rows')).toBe(true);
    fireEvent.click(row('1 Row'));
    expect(h.store.sheet('sheet0001')!.layout.frozenRows).toBe(1);
    open('Freeze');
    expect(checked('1 Row')).toBe(true);
    fireEvent.click(row('Up to Row 3'));
    expect(h.store.sheet('sheet0001')!.layout.frozenRows).toBe(3);
    open('Freeze');
    fireEvent.click(row('2 Columns'));
    expect(h.store.sheet('sheet0001')!.layout.frozenCols).toBe(2);
    open('Freeze');
    expect(checked('2 Columns')).toBe(true);
    fireEvent.click(row('Up to Column C'));
    expect(h.store.sheet('sheet0001')!.layout.frozenCols).toBe(3);
    open('Freeze');
    fireEvent.click(row('No Columns'));
    open('Freeze');
    fireEvent.click(row('2 Rows'));
    open('Freeze');
    fireEvent.click(row('1 Column'));
    expect(h.store.sheet('sheet0001')!.layout).toMatchObject({ frozenRows: 2, frozenCols: 1 });
    open('Freeze');
    fireEvent.click(row('No Rows'));
    expect(h.store.sheet('sheet0001')!.layout.frozenRows ?? 0).toBe(0);
  });

  it('starts a picked function in the active cell, or writes it over the selection into the cell below', () => {
    // Room for every family's menu, so All Functions shows rather than folding into More.
    width = 2400;
    show(h);
    act(() => h.select('C2'));
    const fn = (family: string, name: string) => {
      fireEvent.click(btn(`${family} Functions`));
      fireEvent.click(screen.getByRole('menuitem', { name: `Insert ${name}` }));
    };
    fn('Statistics', 'AVERAGE');
    expect(h.ctl().editing).toMatchObject({ r: 1, c: 2, draft: '=AVERAGE(', origin: 'type' });
    act(() => h.ctl().setEditing(null));
    act(() => h.select('A1:A2'));
    fn('Maths', 'SUM');
    expect(h.ctl().editing).toMatchObject({ r: 2, c: 0, draft: '=SUM(A1:A2)', origin: 'cell' });
    expect(h.ctl().selection.active).toEqual({ r: 2, c: 0 });
    act(() => h.ctl().setEditing(null));
    // At the last row there is no cell below: the formula starts in the active cell.
    act(() => h.select('B7:B8'));
    fn('Statistics', 'MAX');
    expect(h.ctl().editing).toMatchObject({ r: 6, c: 1, draft: '=MAX(' });
    act(() => h.ctl().setEditing(null));
    const win = vi.spyOn(window, 'open').mockImplementation(() => null);
    fireEvent.click(btn('All Functions'));
    expect(win).toHaveBeenCalledWith(
      '/help/canvas/plan-mode/sheet-functions/',
      '_blank',
      'noopener',
    );
    win.mockRestore();
  });

  it('shows one category at a time, kept for the next Sheet', () => {
    const view = show(h);
    pickCategory('Data');
    expect(screen.getByRole('button', { name: 'Sort' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bold' })).toBeNull();
    view.unmount();
    show(h);
    expect(screen.getByRole('button', { name: 'Sort' })).toBeTruthy();
  });

  it('clears formatting and hands focus back to the grid', () => {
    const grid = document.createElement('div');
    grid.tabIndex = 0;
    document.body.appendChild(grid);
    show(h);
    act(() => h.ctl().setGridEl(grid));
    fireEvent.click(btn('Clear Formatting'));
    expect(h.notify).toHaveBeenCalledWith('No formatting to clear here');
    fireEvent.click(btn('Bold'));
    expect(h.cell('A1')?.format?.b).toBe(true);
    fireEvent.click(btn('Clear Formatting'));
    expect(h.cell('A1')?.format).toBeUndefined();
    expect(h.value('A1')).toBe(1.5);
    expect(document.activeElement).toBe(grid);
    grid.remove();
  });

  it('folds the buttons that do not fit into More, from the right', () => {
    width = 200;
    show(h);
    pickCategory('Text');
    expect(btn('Bold')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Font Size' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    // A folded button runs from the menu and closes it; a folded menu opens in its place.
    fireEvent.click(row('Strikethrough'));
    expect(h.cell('A1')?.format?.st).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(row('Font Size'));
    fireEvent.click(row('18'));
    expect(h.cell('A1')?.format?.fs).toBe(18);
  });

  it('folds every button at no width, and none when all fit', () => {
    width = 0;
    const view = show(h);
    pickCategory('Text');
    expect(screen.queryByRole('button', { name: 'Bold' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(row('Bold'));
    expect(h.cell('A1')?.format?.b).toBe(true);
    view.unmount();
    width = 1000;
    show(h);
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });

  it('labels the buttons when they all fit, never on a phone or a narrow Sheet, and never the plain four', () => {
    // Room for every Cells button with its label, its menu chevrons and dividers counted.
    width = 1200;
    const view = show(h);
    pickCategory('Text');
    // Bold, Italic, Underline and Strikethrough are their glyph alone, named by their tooltip.
    expect(screen.queryByText('Strikethrough')).toBeNull();
    expect(screen.getByRole('button', { name: 'Strikethrough' })).toBeTruthy();
    pickCategory('Cells');
    expect(screen.getByText('Wrap Text')).toBeTruthy();
    view.unmount();
    width = 300;
    const narrow = show(h);
    pickCategory('Cells');
    expect(screen.queryByText('Wrap Text')).toBeNull();
    narrow.unmount();
    width = 1200;
    phone = true;
    show(h);
    pickCategory('Cells');
    expect(screen.queryByText('Wrap Text')).toBeNull();
    expect(screen.getByRole('button', { name: 'Wrap Text' })).toBeTruthy();
  });
});
