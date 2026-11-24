// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { resetDialogSlot } from '@liveworkspace/ui';
import type { HeroArt } from '@liveworkspace/ui/dialog-hero';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RowsEditorKind } from './ElementRowsDialog';
import {
  ElementRowsDialogs,
  type ElementRowsProfile,
  type RowsDialogsEditor,
} from './ElementRowsDialogs';

// Each editor's docs/specs/008-canvas/canvas-and-palette.md "A category that opens a dialog": the workbench's one
// copy of the rows dialogs, handed an editor's state and a profile of its row editors. The editors stand in here as
// what they were handed, so each test reads which one the dialog drew and with what.
afterEach(() => {
  cleanup();
  resetDialogSlot();
});

type Shape = {
  id: string;
  type: 'shape';
  shape: string;
  locked?: boolean;
  chartPalette?: string;
  checklistItems?: { text: string; done: boolean }[];
  legendItems?: { label: string; color?: string }[];
  pieSlices?: { label: string; value: number; color?: string }[];
};
type Table = { id: string; type: 'table'; locked?: boolean; textColor?: string; zebra?: boolean };
type Arrow = { id: string; type: 'arrow'; locked?: boolean };
type El = Shape | Table | Arrow;

const shown = (name: string, props: object) => (
  <div data-testid={name} data-props={JSON.stringify(props)} />
);
const propsOf = (name: string) =>
  JSON.parse(screen.getByTestId(name).getAttribute('data-props')!) as Record<string, unknown>;

function profile(over: Partial<ElementRowsProfile<El>> = {}): ElementRowsProfile<El> {
  return {
    ChecklistRowsEditor: ({ items, onChange, onToggle }) => (
      <div data-testid="checklist" data-props={JSON.stringify({ items })}>
        <button type="button" onClick={() => onChange([{ text: 'New', done: false }])}>
          Change rows
        </button>
        <button type="button" onClick={() => onToggle?.(1)}>
          Tick row
        </button>
      </div>
    ),
    LegendDataEditor: ({ items, palette }) => shown('legend', { items, palette }),
    PieDataEditor: ({ slices, palette, allowNegative }) =>
      shown('slices', { slices, palette, allowNegative }),
    WebRowsEditor: ({ target, ops }) => (
      <div data-testid="web-rows" data-props={JSON.stringify({ id: target.id })}>
        <button type="button" onClick={() => ops?.commit((e) => e, 'Rows')}>
          Commit rows
        </button>
      </div>
    ),
    webRowsTitle: (target) => (target.shape === 'plain' ? null : 'Rows'),
    ConceptSettings: ({ target, ops }) => (
      <div data-testid="concept" data-props={JSON.stringify({ shape: target.shape })}>
        <button type="button" onClick={() => ops.preview((e) => e)}>
          Preview look
        </button>
        <button type="button" onClick={ops.end}>
          End look
        </button>
      </div>
    ),
    hasConceptSettings: (target) => target.shape !== 'cycle',
    TextSizeControl: ({ current, presetPx, onSet, onPreview, onPreviewEnd }) => (
      <div data-testid="size" data-props={JSON.stringify({ current, sm: presetPx?.('sm') })}>
        <button type="button" onClick={() => onSet(20)}>
          Set size
        </button>
        <button type="button" onClick={() => onPreview?.('lg')}>
          Preview size
        </button>
        <button type="button" onClick={onPreviewEnd}>
          End size
        </button>
      </div>
    ),
    tablePresetPx: () => 13,
    ColourSwatchButton: ({ label, value, swatch, yours, onPick, children }) => (
      <button
        type="button"
        aria-label={label}
        data-props={JSON.stringify({ value, swatch, yours })}
        onClick={() => onPick('#ff0000')}
      >
        {children}
      </button>
    ),
    useCustomColours: () => ['#123456'],
    ...over,
  };
}

function editor(elements: El[], kind: RowsEditorKind | null, id = elements[0]?.id ?? 'x') {
  const fn = () => vi.fn();
  const e: RowsDialogsEditor<El> = {
    activeTab: { elements },
    rowsEditorOpenFor: kind ? { id, kind } : null,
    setRowsEditorOpenFor: fn(),
    setChecklistItemsSelected: fn(),
    toggleChecklistItem: fn(),
    setLegendItemsSelected: fn(),
    setPieDataSelected: fn(),
    setWebRowsSelected: fn(),
    commitElementStyle: fn(),
    previewElementStyle: fn(),
    clearStylePreview: fn(),
    setTableHeaderRowSelected: fn(),
    setTableHeaderColumnSelected: fn(),
    setTableZebraSelected: fn(),
    toggleTextStyleSelected: fn(),
    commitTextSize: fn(),
    previewTextSize: fn(),
    setTextColorSelected: fn(),
  };
  return e;
}

const ART: HeroArt = { name: 'segments', mark: null, scene: null } as unknown as HeroArt;

function open(
  elements: El[],
  kind: RowsEditorKind | null,
  opts: {
    id?: string;
    themeRamp?: readonly string[];
    over?: Partial<ElementRowsProfile<El>>;
    segments?: Parameters<typeof ElementRowsDialogs<El>>[0]['segments'];
  } = {},
) {
  const { id, over = {}, segments } = opts;
  // A key given as undefined means no theme ladder, not the default one.
  const themeRamp = 'themeRamp' in opts ? opts.themeRamp : ['#111111', '#222222'];
  const ed = editor(elements, kind, id);
  render(
    <ElementRowsDialogs
      editor={ed}
      profile={profile(over)}
      themeRamp={themeRamp}
      segments={segments}
    />,
  );
  return ed;
}

const title = () => document.querySelector('h2')?.textContent;
const subtitle = (text: string) => screen.getByText(text);
const shape = (over: Partial<Shape> = {}): Shape => ({
  id: 's1',
  type: 'shape',
  shape: 'rect',
  ...over,
});

describe('ElementRowsDialogs', () => {
  it('draws nothing while closed, for an element that is gone, or for a locked one', () => {
    open([shape()], null);
    open([shape()], 'checklist', { id: 'gone' });
    open([shape({ locked: true })], 'checklist');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('closes through the editor from Done', async () => {
    const ed = open([shape()], 'checklist');
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
    expect(ed.setRowsEditorOpenFor).toHaveBeenCalledWith(null);
  });

  it("edits a checklist's rows and ticks one as its own change", async () => {
    const ed = open([shape({ checklistItems: [{ text: 'A', done: true }] })], 'checklist');
    expect(title()).toBe('Checklist');
    expect(subtitle('Tick, reword, add and remove its rows.')).toBeTruthy();
    expect(propsOf('checklist').items).toEqual([{ text: 'A', done: true }]);
    fireEvent.click(await screen.findByRole('button', { name: 'Change rows' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tick row' }));
    expect(ed.setChecklistItemsSelected).toHaveBeenCalledWith([{ text: 'New', done: false }]);
    expect(ed.toggleChecklistItem).toHaveBeenCalledWith('s1', 1);
  });

  it('starts an empty checklist with no rows', () => {
    open([shape()], 'checklist');
    expect(propsOf('checklist').items).toEqual([]);
  });

  it("edits a legend's rows on the theme's chart ladder", () => {
    open([shape({ legendItems: [{ label: 'Up' }] })], 'legend');
    expect(title()).toBe('Legend');
    expect(propsOf('legend')).toEqual({
      items: [{ label: 'Up' }],
      palette: ['#111111', '#222222'],
    });
  });

  it("starts an empty legend with no rows, on the chart's own palette over the theme's", () => {
    open([shape({ chartPalette: 'no-such-palette' })], 'legend', { themeRamp: undefined });
    const { items, palette } = propsOf('legend') as { items: unknown[]; palette: string[] };
    expect(items).toEqual([]);
    // No theme ladder and no known palette: the built-in one.
    expect(palette.length).toBeGreaterThan(0);
  });

  it("edits a pie's slices, positive only, from the default slices when it has none", () => {
    open([shape({ shape: 'pie-chart' })], 'slices');
    expect(title()).toBe('Chart Data');
    expect(subtitle('A colour, a label and a value for each one.')).toBeTruthy();
    const { slices, allowNegative } = propsOf('slices') as {
      slices: unknown[];
      allowNegative: boolean;
    };
    expect(slices.length).toBeGreaterThan(0);
    expect(allowNegative).toBe(false);
  });

  it("edits a column chart's own slices, below zero too", () => {
    const pieSlices = [{ label: 'Q1', value: -2 }];
    open([shape({ shape: 'bar-chart', pieSlices })], 'slices');
    expect(propsOf('slices')).toMatchObject({ slices: pieSlices, allowNegative: true });
  });

  it("edits a web's rows, committing through the editor's style ops", async () => {
    const ed = open([shape({ shape: 'web' })], 'web-rows');
    expect(title()).toBe('Rows');
    expect(subtitle('Add, remove and reorder them.')).toBeTruthy();
    expect(screen.queryByTestId('concept')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Commit rows' }));
    expect(ed.commitElementStyle).toHaveBeenCalledWith(expect.any(Function), 'Rows');
  });

  it('draws nothing for a shape whose rows have no title', () => {
    open([shape({ shape: 'plain' })], 'web-rows');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("puts a concept's settings over its rows, previewing through the editor", async () => {
    const ed = open([shape({ shape: 'pyramid' })], 'web-rows');
    expect(subtitle('Its shape and its rows.')).toBeTruthy();
    expect(propsOf('concept')).toEqual({ shape: 'pyramid' });
    fireEvent.click(await screen.findByRole('button', { name: 'Preview look' }));
    fireEvent.click(await screen.findByRole('button', { name: 'End look' }));
    expect(ed.previewElementStyle).toHaveBeenCalledTimes(1);
    expect(ed.clearStylePreview).toHaveBeenCalledTimes(1);
  });

  it('leaves the settings out for a concept that has none', () => {
    open([shape({ shape: 'cycle' })], 'web-rows');
    expect(subtitle('Its shape and its rows.')).toBeTruthy();
    expect(screen.queryByTestId('concept')).toBeNull();
    expect(screen.getByTestId('web-rows')).toBeTruthy();
  });

  it("draws an agenda's segments in the editor that has them", () => {
    const render = vi.fn((target: { id: string }) => <p>Segments of {target.id}</p>);
    open([shape({ shape: 'agenda' })], 'segments', { segments: { art: ART, render } });
    expect(title()).toBe('Segments');
    expect(subtitle('A name and its minutes for each part of the meeting.')).toBeTruthy();
    expect(screen.getByText('Segments of s1')).toBeTruthy();
  });

  it('draws no segments in an editor without agendas', () => {
    open([shape({ shape: 'agenda' })], 'segments');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('draws no rows for an element that is not a shape', () => {
    open([{ id: 'a1', type: 'arrow' }], 'checklist');
    open([shape()], 'table');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("draws a table's look with the editor's colour picker and Text Size control", async () => {
    const ed = open([{ id: 't1', type: 'table', textColor: '#00ff00', zebra: true }], 'table');
    expect(title()).toBe('Table');
    expect(subtitle("Its header, its striping and its cells' text.")).toBeTruthy();
    expect(
      screen.getByRole('switch', { name: /Zebra Striping/ }).getAttribute('aria-checked'),
    ).toBe('true');
    const colour = screen.getByRole('button', { name: 'Text colour' });
    expect(JSON.parse(colour.getAttribute('data-props')!)).toEqual({
      value: '#00ff00',
      swatch: '#00ff00',
      yours: ['#123456'],
    });
    expect(propsOf('size')).toEqual({ current: 'sm', sm: 13 });
    fireEvent.click(colour);
    fireEvent.click(screen.getByRole('switch', { name: /Header Row/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Header Column/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Zebra Striping/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Set size' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview size' }));
    fireEvent.click(screen.getByRole('button', { name: 'End size' }));
    expect(ed.setTextColorSelected).toHaveBeenCalledWith('#ff0000');
    expect(ed.setTableHeaderRowSelected).toHaveBeenCalledWith(true);
    expect(ed.setTableHeaderColumnSelected).toHaveBeenCalledWith(true);
    expect(ed.setTableZebraSelected).toHaveBeenCalledWith(false);
    expect(ed.toggleTextStyleSelected).toHaveBeenCalledWith('textBold');
    expect(ed.commitTextSize).toHaveBeenCalledWith(20);
    expect(ed.previewTextSize).toHaveBeenCalledWith('lg');
    expect(ed.clearStylePreview).toHaveBeenCalledTimes(1);
  });

  it('shows a table with no colour of its own on the stock text colour, no swatch picked', () => {
    open([{ id: 't1', type: 'table' }], 'table');
    const colour = screen.getByRole('button', { name: 'Text colour' });
    const { value, swatch } = JSON.parse(colour.getAttribute('data-props')!) as {
      value: string | null;
      swatch: string;
    };
    expect(value).toBeNull();
    expect(swatch).toMatch(/^#/);
  });
});
