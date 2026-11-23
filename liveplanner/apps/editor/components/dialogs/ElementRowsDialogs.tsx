'use client';

import {
  chartRamp,
  isConceptShape,
  PIE_DEFAULT_SLICES,
  type ConceptShape,
  type ShapeElement,
  type TableElement,
} from '@liveplanner/project';
import { useCanvasSurface } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { ElementRowsDialog } from '@liveworkspace/workbench/components/dialogs/ElementRowsDialog';
import { TableSettings } from '@liveworkspace/workbench/components/dialogs/TableSettings';
import { checklistHeroArt } from '@liveworkspace/ui/dialog-hero-art/checklist';
import { elementRowsHeroArt } from '@liveworkspace/ui/dialog-hero-art/element-rows';
import { legendHeroArt } from '@liveworkspace/ui/dialog-hero-art/legend';
import { lineDataHeroArt } from '@liveworkspace/ui/dialog-hero-art/line-data';
import { tableHeroArt } from '@liveworkspace/ui/dialog-hero-art/table';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import { standardGroup } from '@liveworkspace/workbench/components/colour/colour-options';
import {
  ChecklistRowsEditor,
  LegendDataEditor,
  PieDataEditor,
} from '@/components/palette/context-menu-data-editors';
import { ConceptSettings, hasConceptSettings } from '@/components/palette/ConceptMenuSection';
import { WebRowsEditor, webRowsTitle } from '@/components/palette/context-menu-web-editors';
import { shownColour } from '@liveworkspace/workbench/components/palette/ink-row';
import { presetPxFor, TextSizeControl } from '@/components/palette/TextSizeControl';
import { useProjectColours } from '@/hooks/ui/useProjectColours';
import { getTheme, themeChartPalette } from '@/lib/themes';

type ConceptElement = ShapeElement & { shape: ConceptShape };

// An element's rows in their dialog (docs/specs/008-canvas/canvas-and-palette.md "A category that opens a dialog"):
// a checklist's rows, a legend's, a pie, column or bar chart's slices. The element menu's row opens it; the rows
// were once edited inside the menu, where a row of colour, label and value had no room.
export function ElementRowsDialogs() {
  const {
    activeTab,
    rowsEditorOpenFor: open,
    setRowsEditorOpenFor,
    setChecklistItemsSelected,
    toggleChecklistItem,
    setLegendItemsSelected,
    setPieDataSelected,
    setWebRowsSelected,
    commitElementStyle,
    previewElementStyle,
    clearStylePreview,
  } = useEditorContext();
  const el = open ? activeTab.elements.find((e) => e.id === open.id) : undefined;
  if (!open || !el || el.locked) return null;
  const close = () => setRowsEditorOpenFor(null);
  if (open.kind === 'table')
    return el.type === 'table' ? (
      <ElementRowsDialog
        art={tableHeroArt}
        title="Table"
        subtitle="Its header, its striping and its cells' text."
        onClose={close}
      >
        <TableDialogSettings table={el} />
      </ElementRowsDialog>
    ) : null;
  if (el.type !== 'shape') return null;
  if (open.kind === 'web-rows') {
    const title = webRowsTitle(el);
    return title ? (
      <ElementRowsDialog
        art={elementRowsHeroArt}
        title={title}
        subtitle={
          isConceptShape(el.shape) ? 'Its shape and its rows.' : 'Add, remove and reorder them.'
        }
        onClose={close}
      >
        {isConceptShape(el.shape) && hasConceptSettings(el as ConceptElement) ? (
          <div className="pb-4">
            <ConceptSettings
              target={el as ConceptElement}
              ops={{
                commit: commitElementStyle,
                preview: previewElementStyle,
                end: clearStylePreview,
              }}
            />
          </div>
        ) : null}
        <WebRowsEditor target={el} onSetRows={setWebRowsSelected} />
      </ElementRowsDialog>
    ) : null;
  }
  // An uncoloured row's swatch matches the chart: the ladder the canvas draws with (chartRamp).
  const palette = chartRamp(el.chartPalette, themeChartPalette(getTheme(activeTab.theme)));
  if (open.kind === 'checklist')
    return (
      <ElementRowsDialog
        art={checklistHeroArt}
        title="Checklist"
        subtitle="Tick, reword, add and remove its rows."
        onClose={close}
      >
        <ChecklistRowsEditor
          items={el.checklistItems ?? []}
          onChange={setChecklistItemsSelected}
          onToggle={(index) => toggleChecklistItem(el.id, index)}
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
        <LegendDataEditor
          items={el.legendItems ?? []}
          palette={palette}
          onChange={setLegendItemsSelected}
        />
      </ElementRowsDialog>
    );
  if (open.kind === 'slices')
    return (
      <ElementRowsDialog
        art={lineDataHeroArt}
        title="Chart Data"
        subtitle="A colour, a label and a value for each one."
        onClose={close}
      >
        <PieDataEditor
          palette={palette}
          slices={el.pieSlices ?? PIE_DEFAULT_SLICES.map((s) => ({ ...s }))}
          onChange={setPieDataSelected}
        />
      </ElementRowsDialog>
    );
  return null;
}

// The Table dialog's controls (docs/specs/008-canvas/canvas-and-palette.md "The Table dialog"): the workbench's one
// copy, handed this editor's text colour picker and Text Size control.
function TableDialogSettings({ table }: { table: TableElement }) {
  const {
    setTableHeaderRowSelected,
    setTableHeaderColumnSelected,
    setTableZebraSelected,
    toggleTextStyleSelected,
    commitTextSize,
    previewTextSize,
    clearStylePreview,
    setTextColorSelected,
  } = useEditorContext();
  const surface = useCanvasSurface();
  const yours = useProjectColours();
  const colour = shownColour(table, 'text', surface, '#0f172a');
  return (
    <TableSettings
      look={table}
      onHeaderRow={setTableHeaderRowSelected}
      onHeaderColumn={setTableHeaderColumnSelected}
      onZebra={setTableZebraSelected}
      onToggleStyle={toggleTextStyleSelected}
      colour={
        <ColourSwatchButton
          label="Text colour"
          value={table.textColor ?? null}
          swatch={colour}
          standard={[standardGroup('strong', 'light', 'hex')]}
          yours={yours}
          className="h-9 w-9"
          onPick={setTextColorSelected}
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
          presetPx={presetPxFor('table')}
          onSet={commitTextSize}
          onPreview={previewTextSize}
          onPreviewEnd={clearStylePreview}
        />
      }
    />
  );
}
