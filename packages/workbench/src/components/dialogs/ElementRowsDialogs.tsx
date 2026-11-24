'use client';

import type { ComponentType, ReactNode } from 'react';
import { chartRamp } from '@liveworkspace/element-model/chart-palettes';
import { isConceptShape, type ConceptShape } from '@liveworkspace/element-model/concept';
import {
  PIE_DEFAULT_SLICES,
  type ChecklistItem,
  type LegendItem,
  type PieSlice,
} from '@liveworkspace/element-model/data-shapes';
import type { Element as ModelElement } from '@liveworkspace/element-model/element';
import type { WebRows } from '@liveworkspace/element-model/web-components';
import type { TextSize, TextSizePreset } from '@liveworkspace/model-core/basics';
import { checklistHeroArt } from '@liveworkspace/ui/dialog-hero-art/checklist';
import { elementRowsHeroArt } from '@liveworkspace/ui/dialog-hero-art/element-rows';
import { legendHeroArt } from '@liveworkspace/ui/dialog-hero-art/legend';
import { lineDataHeroArt } from '@liveworkspace/ui/dialog-hero-art/line-data';
import { tableHeroArt } from '@liveworkspace/ui/dialog-hero-art/table';
import type { HeroArt } from '@liveworkspace/ui/dialog-hero';
import { useCanvasSurface } from '../canvas/CanvasSurfaceContext';
import { standardGroup, type ColourGroup } from '../colour/colour-options';
import { shownColour } from '../palette/ink-row';
import { ElementRowsDialog, type RowsEditorOpen } from './ElementRowsDialog';
import { TableSettings, type TableLook, type TableTextStyle } from './TableSettings';

// An element's rows in their dialog (each editor's docs/specs/008-canvas/canvas-and-palette.md "A category that opens
// a dialog"): a checklist's rows, a legend's, a pie, column or bar chart's slices, a concept's or web's rows, a
// table's look, and in livediagram an agenda's segments. The element menu's row opens it; the rows were once edited
// inside the menu, where a row of colour, label and value had no room. One copy for every editor: each hands in its
// editor state and a profile of its own row editors (its components/dialogs/ElementRowsDialogs.tsx), and this picks
// the dialog, its art and its words.

/** What every element has, as far as this reads it. */
type RowsElement = { id: string; type: string; locked?: boolean };

/** A shape's fields the rows dialogs read: its kind and the rows it holds. */
type RowsShapeFields = {
  shape: string;
  chartPalette?: string;
  checklistItems?: ChecklistItem[];
  legendItems?: LegendItem[];
  pieSlices?: PieSlice[];
};

/** A table's fields the Table dialog reads: its look, and its cells' colour and size. */
type RowsTableFields = TableLook & { textColor?: string; textSize?: TextSize };

export type RowsShape<E> = Extract<E, { type: 'shape' }> & RowsShapeFields;
export type RowsTable<E> = Extract<E, { type: 'table' }> & RowsTableFields;
type RowsConcept<E> = RowsShape<E> & { shape: ConceptShape };

/** The hover preview and commit a concept's settings write through (each editor's lib/element-style-ops.ts). */
export type RowsStyleOps<E> = {
  commit: (map: (el: E) => E, telemetryType: string) => void;
  preview: (map: (el: E) => E) => void;
  end: () => void;
};

/** The editor state the dialogs read and write: each editor's EditorContext, as it is. */
export type RowsDialogsEditor<E extends RowsElement> = {
  activeTab: { elements: readonly E[] };
  rowsEditorOpenFor: RowsEditorOpen | null;
  setRowsEditorOpenFor: (open: RowsEditorOpen | null) => void;
  setChecklistItemsSelected: (items: ChecklistItem[]) => void;
  toggleChecklistItem: (id: string, index: number) => void;
  setLegendItemsSelected: (items: LegendItem[]) => void;
  setPieDataSelected: (slices: PieSlice[]) => void;
  setWebRowsSelected: (rows: WebRows) => void;
  commitElementStyle: RowsStyleOps<E>['commit'];
  previewElementStyle: RowsStyleOps<E>['preview'];
  clearStylePreview: () => void;
  setTableHeaderRowSelected: (on: boolean) => void;
  setTableHeaderColumnSelected: (on: boolean) => void;
  setTableZebraSelected: (on: boolean) => void;
  toggleTextStyleSelected: (style: TableTextStyle) => void;
  commitTextSize: (size: TextSize) => void;
  previewTextSize: (size: TextSize) => void;
  setTextColorSelected: (colour: string) => void;
};

/** An editor's own row editors and controls, bound once at module scope in its ElementRowsDialogs.tsx. */
export type ElementRowsProfile<E> = {
  ChecklistRowsEditor: ComponentType<{
    items: ChecklistItem[];
    onChange: (items: ChecklistItem[]) => void;
    onToggle?: (index: number) => void;
  }>;
  LegendDataEditor: ComponentType<{
    items: LegendItem[];
    palette?: readonly string[];
    onChange: (items: LegendItem[]) => void;
  }>;
  // `allowNegative` reaches the editors that take it (livediagram's column and bar charts); the rest ignore it.
  PieDataEditor: ComponentType<{
    slices: PieSlice[];
    palette?: readonly string[];
    onChange: (slices: PieSlice[]) => void;
    allowNegative?: boolean;
  }>;
  // `ops` reaches the editors whose rows commit a look of their own (livedocuments); the rest ignore it.
  WebRowsEditor: ComponentType<{
    target: RowsShape<E>;
    onSetRows: (rows: WebRows) => void;
    ops?: RowsStyleOps<E>;
  }>;
  /** The web rows dialog's title for a shape, or null when the shape has no rows to edit. */
  webRowsTitle: (target: RowsShape<E>) => string | null;
  ConceptSettings: ComponentType<{ target: RowsConcept<E>; ops: RowsStyleOps<E> }>;
  hasConceptSettings: (target: RowsConcept<E>) => boolean;
  TextSizeControl: ComponentType<{
    current: TextSize | null;
    presetPx?: (preset: TextSizePreset) => number;
    onSet: (size: TextSize) => void;
    onPreview?: (size: TextSize) => void;
    onPreviewEnd?: () => void;
  }>;
  /** The Text Size control's preset sizes for a table (its TextSizeControl.tsx presetPxFor('table')). */
  tablePresetPx: (preset: TextSizePreset) => number;
  ColourSwatchButton: ComponentType<{
    label: string;
    value: string | null;
    swatch: string;
    standard: readonly ColourGroup[];
    yours: readonly string[];
    className?: string;
    onPick: (id: string) => void;
    children?: ReactNode;
  }>;
  /** The editor's Custom colours hook (useDesignColours and its kin). */
  useCustomColours: () => readonly string[];
};

export function ElementRowsDialogs<E extends RowsElement>({
  editor,
  profile,
  themeRamp,
  segments,
}: {
  editor: RowsDialogsEditor<E>;
  profile: ElementRowsProfile<E>;
  /** The active tab's theme's chart ladder, which an uncoloured row's swatch falls back to (chartRamp). */
  themeRamp: readonly string[] | undefined;
  /** An agenda's Segments dialog, in the editor that has agendas: its art and its editor. */
  segments?: { art: HeroArt; render: (target: RowsShape<E>) => ReactNode };
}) {
  const open = editor.rowsEditorOpenFor;
  const el = open ? editor.activeTab.elements.find((e) => e.id === open.id) : undefined;
  if (!open || !el || el.locked) return null;
  const close = () => editor.setRowsEditorOpenFor(null);
  if (open.kind === 'table')
    return el.type === 'table' ? (
      <ElementRowsDialog
        art={tableHeroArt}
        title="Table"
        subtitle="Its header, its striping and its cells' text."
        onClose={close}
      >
        <TableDialogSettings table={el as RowsTable<E>} editor={editor} profile={profile} />
      </ElementRowsDialog>
    ) : null;
  if (el.type !== 'shape') return null;
  const shape = el as RowsShape<E>;
  if (open.kind === 'web-rows') {
    const title = profile.webRowsTitle(shape);
    if (!title) return null;
    const concept = isConceptShape(shape.shape);
    const ops: RowsStyleOps<E> = {
      commit: editor.commitElementStyle,
      preview: editor.previewElementStyle,
      end: editor.clearStylePreview,
    };
    return (
      <ElementRowsDialog
        art={elementRowsHeroArt}
        title={title}
        subtitle={concept ? 'Its shape and its rows.' : 'Add, remove and reorder them.'}
        onClose={close}
      >
        {concept && profile.hasConceptSettings(shape as RowsConcept<E>) ? (
          <div className="pb-4">
            <profile.ConceptSettings target={shape as RowsConcept<E>} ops={ops} />
          </div>
        ) : null}
        <profile.WebRowsEditor target={shape} onSetRows={editor.setWebRowsSelected} ops={ops} />
      </ElementRowsDialog>
    );
  }
  if (open.kind === 'segments')
    return segments ? (
      <ElementRowsDialog
        art={segments.art}
        title="Segments"
        subtitle="A name and its minutes for each part of the meeting."
        onClose={close}
      >
        {segments.render(shape)}
      </ElementRowsDialog>
    ) : null;
  // An uncoloured row's swatch matches the chart: the ladder the canvas draws with (chartRamp).
  const palette = chartRamp(shape.chartPalette, themeRamp);
  if (open.kind === 'checklist')
    return (
      <ElementRowsDialog
        art={checklistHeroArt}
        title="Checklist"
        subtitle="Tick, reword, add and remove its rows."
        onClose={close}
      >
        <profile.ChecklistRowsEditor
          items={shape.checklistItems ?? []}
          onChange={editor.setChecklistItemsSelected}
          onToggle={(index) => editor.toggleChecklistItem(shape.id, index)}
        />
      </ElementRowsDialog>
    );
  if (open.kind === 'legend')
    return (
      <ElementRowsDialog
        art={legendHeroArt}
        title="Legend"
        subtitle="A colour and a word for each row of the key."
        onClose={close}
      >
        <profile.LegendDataEditor
          items={shape.legendItems ?? []}
          palette={palette}
          onChange={editor.setLegendItemsSelected}
        />
      </ElementRowsDialog>
    );
  // open.kind is 'slices': a pie, column or bar chart's.
  return (
    <ElementRowsDialog
      art={lineDataHeroArt}
      title="Chart Data"
      subtitle="A colour, a label and a value for each one."
      onClose={close}
    >
      <profile.PieDataEditor
        palette={palette}
        slices={shape.pieSlices ?? PIE_DEFAULT_SLICES.map((s) => ({ ...s }))}
        onChange={editor.setPieDataSelected}
        allowNegative={shape.shape !== 'pie-chart'}
      />
    </ElementRowsDialog>
  );
}

// The Table dialog's controls (canvas-and-palette.md "The Table dialog"): the workbench's one copy, handed this
// editor's text colour picker and Text Size control.
function TableDialogSettings<E extends RowsElement>({
  table,
  editor,
  profile,
}: {
  table: RowsTable<E>;
  editor: RowsDialogsEditor<E>;
  profile: ElementRowsProfile<E>;
}) {
  const surface = useCanvasSurface();
  const yours = profile.useCustomColours();
  // Every editor's table is a model element as the workbench reads one (stock colours by surface).
  const colour = shownColour(table as unknown as ModelElement, 'text', surface, '#0f172a');
  const { ColourSwatchButton, TextSizeControl } = profile;
  return (
    <TableSettings
      look={table}
      onHeaderRow={editor.setTableHeaderRowSelected}
      onHeaderColumn={editor.setTableHeaderColumnSelected}
      onZebra={editor.setTableZebraSelected}
      onToggleStyle={editor.toggleTextStyleSelected}
      colour={
        <ColourSwatchButton
          label="Text colour"
          value={table.textColor ?? null}
          swatch={colour}
          standard={[standardGroup('strong', 'light', 'hex')]}
          yours={yours}
          className="h-9 w-9"
          onPick={editor.setTextColorSelected}
        >
          <span
            aria-hidden
            className="size-6 rounded-md border border-slate-300 dark:border-slate-600"
            style={{ backgroundColor: colour }}
          />
        </ColourSwatchButton>
      }
      size={
        <TextSizeControl
          current={table.textSize ?? 'sm'}
          presetPx={profile.tablePresetPx}
          onSet={editor.commitTextSize}
          onPreview={editor.previewTextSize}
          onPreviewEnd={editor.clearStylePreview}
        />
      }
    />
  );
}
