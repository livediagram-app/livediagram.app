'use client';

// Right-click context menu for the editor, lifted out of
// editor-page.tsx. Renders one of two menus depending on what was
// clicked: a single-element menu (link / layer order / note /
// comment) or a whole-selection 'multi' menu. The canvas (empty-space)
// right-click opens the tab menu with its canvas sections folded in,
// rendered by the TabBar — not here. Duplicate lives in the selection
// toolbar (SelectionPopover), not here.
//
// Purely presentational: every action is a callback prop, and each
// item closes the menu after firing (the close-then-act pattern the
// inline version used). The page owns the open/closed state + the
// handlers; this component only decides which items to show.

import dynamic from 'next/dynamic';
import { CardMenuSection } from '@/components/palette/CardMenuSection';
import { QuoteMenuSection } from '@/components/palette/QuoteMenuSection';
import { ChipMenuSection } from '@/components/palette/ChipMenuSection';
import { PointerNoteMenuSection } from '@/components/palette/PointerNoteMenuSection';
import { TagColoursBlock } from '@/components/palette/TagColoursBlock';
import { StackMenuSection } from '@/components/palette/StackMenuSection';
import {
  elementKindLabel,
  isChipShape,
  LINE_DEFAULT_SERIES,
  chartRamp,
  chartTypeOf,
  PIE_DEFAULT_SLICES,
  RATING_DEFAULT,
  type PieSlice,
} from '@livedocuments/document';
import {
  ProgressMenuGlyph,
  ToolsMenuGlyph,
} from '@liveworkspace/workbench/components/palette/context-menu-icons';
import {
  MenuAccordionSection,
  MenuGroupSeparator,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { AnimationSections } from '@/components/palette/AnimationSections';
import { MenuDialogSection } from '@liveworkspace/workbench/components/primitives/MenuDialogSection';
import { MenuToolsSection } from '@liveworkspace/workbench/components/primitives/MenuToolsSection';
import { LegendTextSize } from '@/components/palette/TypographySections';

import { LegendPositionTiles } from '@/components/palette/context-menu-tiles';
import { ChartAxisRows } from '@liveworkspace/workbench/components/palette/ChartAxisRows';
import { MenuToggleRow } from '@/components/palette/context-menu-input-rows';

import { ChartTypeTiles } from '@liveworkspace/workbench/components/palette/ChartTypeTiles';
import { SheetLinkSection } from '@liveworkspace/workbench/components/sheet-links/SheetLinkSection';
import {
  hasWebRowsSection,
  WebRowsMenuSection,
} from '@/components/palette/context-menu-web-editors';
import { DataMenuGlyph } from '@liveworkspace/workbench/components/palette/context-menu-data-parts';
import {
  ChartMenuGlyph,
  LineDataSummary,
  PieDataSummary,
  ProgressRow,
  RatingMenuGlyph,
  RatingPickerRow,
} from '@/components/palette/context-menu-rows';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { useContextMenuScaffold } from '@liveworkspace/workbench/components/palette/useContextMenuScaffold';
import { ChartPalettePresets } from './StylePresets';

// A Sankey's sections (docs/specs/009-elements/sankey.md "The menu") load only when a Sankey's menu opens.
const SankeyMenuSections = dynamic(
  () => import('./SankeyMenuSection').then((m) => m.SankeyMenuSections),
  { ssr: false },
);

// So do a map's (docs/specs/009-elements/map.md "The menu").
const MapMenuSections = dynamic(() => import('./MapMenuSection').then((m) => m.MapMenuSections), {
  ssr: false,
});

type Scaffold = ReturnType<typeof useContextMenuScaffold>;

// The element menu's data-shape sections: Progress, Timeline Rail, Rating, and
// the Pie / Bar / Line chart Data + Chart + Animation controls. Split out of
// ElementAppearanceSections; the type flags are passed in (the parent already
// derives them) and the shape narrowing is re-derived off target.
type ElementDataSectionsProps = {
  props: EditorContextMenuProps;
  target: EditorContextMenuProps['elements'][number];
  isProgress: boolean;
  isRating: boolean;
  isChart: boolean;
  isLine: boolean;
  isCodeBlock: boolean;
  isChecklist: boolean;
  isLegend: boolean;
  // Sankey diagram (docs/specs/009-elements/sankey.md): its Sankey and Display sections.
  isSankey: boolean;
  sectionProps: Scaffold['sectionProps'];
  flyoutProps: Scaffold['flyoutProps'];
  // The menu, or the element's settings dialog (the sections alone, laid open).
  surface?: 'menu' | 'dialog';
};

// Row editors re-seed their draft when handed a different array, so the fallbacks for an element
// without rows are one stable array each rather than a fresh one per render (which reset the draft).
const DEFAULT_PIE_ROWS: PieSlice[] = PIE_DEFAULT_SLICES.map((s) => ({ ...s }));

export function ElementDataSections({
  props,
  target,
  isProgress,
  isRating,
  isChart,
  isLine,
  isCodeBlock,
  isChecklist,
  isLegend,
  isSankey,
  sectionProps: menuSectionProps,
  flyoutProps,
  surface = 'menu',
}: ElementDataSectionsProps) {
  // In the element's settings dialog every section lies open: there is room, and nothing to fold away.
  const sectionProps: typeof menuSectionProps =
    surface === 'dialog'
      ? () => ({ open: true, onToggle: () => {}, flush: true })
      : menuSectionProps;
  const shapeTarget = target.type === 'shape' ? target : null;
  // What an uncoloured slice / series shows as, so the swatches in the data
  // rows match the chart: the ladder the canvas draws with (chartRamp, docs/specs/009-elements/pie-chart.md).
  const chartFallbackPalette = chartRamp(shapeTarget?.chartPalette, props.chartThemeRamp);
  // The Tools flyout (docs/specs/008-canvas/canvas-and-palette.md): the data-shape-specific controls —
  // Progress (bar / ring), Timeline rail, Rating, and the chart Data +
  // Chart sections — fold behind one "Tools" row, the same side-flyout
  // pattern as Style and Text, so a data element's menu doesn't grow a
  // band of bespoke rows. Animation stays top-level (every boxed
  // element has it).
  const isChip = shapeTarget ? isChipShape(shapeTarget.shape) : false;
  // A locked element's rows dialogs are not offered (onEditRows absent), so a kind whose only section opens one
  // has no Tools of its own then.
  const rowsOffered = !!props.onEditRows;
  const showTools =
    (hasWebRowsSection(target) && (rowsOffered || shapeTarget?.shape === 'card')) ||
    shapeTarget?.shape === 'quote' ||
    isChip ||
    shapeTarget?.shape === 'pointer-note' ||
    shapeTarget?.shape === 'stack' ||
    isProgress ||
    isRating ||
    isChart ||
    isCodeBlock ||
    (isChecklist && rowsOffered) ||
    isLegend ||
    isSankey ||
    shapeTarget?.shape === 'map';
  return (
    <>
      {surface === 'dialog' ? null : (
        <>
          {/* Animation sits straight under Appearance, on every element (owner, 2026-11-23); what is the element's
          own (its Tools, or the one row that opens its dialog) follows under a rule, as a table's Table row does. */}
          <AnimationSections
            elements={[target]}
            keyPrefix=""
            sectionProps={sectionProps}
            flyoutProps={flyoutProps}
            handlers={props}
          />
          {showTools ? <MenuGroupSeparator /> : null}
        </>
      )}
      {showTools ? (
        <MenuToolsSection
          title={elementKindLabel(target)}
          icon={<ToolsMenuGlyph />}
          onOpen={props.onOpenTools}
          inline={surface === 'dialog'}
        >
          {/* Progress (docs/specs/009-elements/progress.md) — the percentage; how the fill animates is the
            Animation row's Progress category. Only for progress bars / rings. */}
          {isProgress ? (
            <MenuAccordionSection
              title="Progress"
              icon={<ProgressMenuGlyph />}
              {...sectionProps('progress')}
            >
              <ProgressRow value={shapeTarget?.progress ?? 50} onChange={props.onSetProgress} />
            </MenuAccordionSection>
          ) : null}
          {/* Rating (docs/specs/009-elements/rating.md) — the star score; its animation is the Animation row's Rating
            category. */}
          {isRating ? (
            <MenuAccordionSection
              title="Rating"
              icon={<RatingMenuGlyph />}
              {...sectionProps('rating')}
            >
              <RatingPickerRow
                value={shapeTarget?.rating ?? RATING_DEFAULT}
                onChange={props.onSetRating}
              />
            </MenuAccordionSection>
          ) : null}
          {/* Chart Type (docs/specs/009-elements/pie-chart.md "Chart types"): first, as how the chart draws comes
              before what it draws. */}
          {isChart ? (
            <MenuAccordionSection
              title="Chart Type"
              icon={<ChartMenuGlyph />}
              {...sectionProps('chart-type')}
            >
              <ChartTypeTiles
                current={shapeTarget ? chartTypeOf(shapeTarget) : null}
                onSet={props.onSetChartType}
              />
            </MenuAccordionSection>
          ) : null}
          {/* Data (docs/specs/009-elements/pie-chart.md) — the chart's data. Pie / bar edit a single row of
            label+value inline; the line chart's 2-D grid is too wide for the
            menu, so it summarises the series + opens a modal to edit. */}
          {isChart ? (
            <MenuAccordionSection
              title="Data"
              icon={<DataMenuGlyph />}
              {...sectionProps('pie-data')}
            >
              {/* Linked to a liveplanner sheet (pie-chart.md "Charts linked to a liveplanner sheet"): the Sheet
                  row in place of the rows, which the sheet now fills; else the rows and an Editor's Link to Sheet. */}
              {shapeTarget ? (
                <SheetLinkSection
                  chart={shapeTarget}
                  onClose={props.onClose}
                  rows={
                    isLine ? (
                      <LineDataSummary
                        palette={chartFallbackPalette}
                        series={
                          shapeTarget.lineSeries ??
                          LINE_DEFAULT_SERIES.map((s) => ({ ...s, values: [...s.values] }))
                        }
                        onEdit={() => props.onEditLineData(shapeTarget.id)}
                      />
                    ) : (
                      <PieDataSummary
                        palette={chartFallbackPalette}
                        slices={shapeTarget.pieSlices ?? DEFAULT_PIE_ROWS}
                        onEdit={
                          props.onEditRows
                            ? () => shapeTarget && props.onEditRows?.(shapeTarget.id, 'slices')
                            : undefined
                        }
                      />
                    )
                  }
                />
              ) : null}
            </MenuAccordionSection>
          ) : null}
          {/* Code (docs/specs/009-elements/code-block.md "The menu"): the row opens the code in its dialog (a
            multi-line editor is too big for the menu), where its language and Wrap Long Lines are too. */}
          {isCodeBlock && shapeTarget ? (
            <MenuDialogSection
              title="Code"
              icon={<DataMenuGlyph />}
              onOpen={() => props.onEditCodeBlock(shapeTarget.id)}
              flush
            />
          ) : null}
          {/* Web components (docs/specs/009-elements/web-components-and-no-groups.md) — a stat row's cards, a process's
            steps, a header's links: add / remove / reorder. */}
          {/* A badge's or step number's look, Detach, Renumber, Play in Order (docs/specs/009-elements/badge.md). */}
          {shapeTarget && isChip ? (
            <ChipMenuSection
              target={shapeTarget}
              ops={props.elementStyle}
              stepsInOrder={props.elements.some(
                (el) => el.type === 'shape' && el.shape === 'step' && el.stepSequence === true,
              )}
              sectionProps={sectionProps}
            />
          ) : null}
          {/* A stack's arrangement (docs/specs/009-elements/stack.md). */}
          {shapeTarget?.shape === 'stack' ? (
            <StackMenuSection
              target={shapeTarget}
              ops={props.elementStyle}
              elements={props.elements}
              sectionProps={sectionProps}
            />
          ) : null}
          {/* A pointer note's Detach (docs/specs/009-elements/pointer-note.md). */}
          {shapeTarget?.shape === 'pointer-note' ? (
            <PointerNoteMenuSection
              target={shapeTarget}
              ops={props.elementStyle}
              sectionProps={sectionProps}
            />
          ) : null}
          {/* The card's slots (docs/specs/009-elements/card.md): band, title, meta line, media. */}
          {shapeTarget?.shape === 'card' ? (
            <CardMenuSection
              target={shapeTarget}
              ops={props.elementStyle}
              sectionProps={sectionProps}
              tagColours={
                props.onSetTagColour ? (
                  <TagColoursBlock
                    target={shapeTarget}
                    tagColours={props.tagColours}
                    colourPalette={props.colourPalette}
                    onSetTagColour={props.onSetTagColour}
                  />
                ) : null
              }
            />
          ) : null}
          {/* The quote's look, lines and portrait (docs/specs/009-elements/quote.md). */}
          {shapeTarget?.shape === 'quote' ? (
            <QuoteMenuSection
              target={shapeTarget}
              ops={props.elementStyle}
              sectionProps={sectionProps}
              onOpenPicker={props.onOpenImagePicker}
              onRemovePhoto={props.onRemoveImage}
            />
          ) : null}
          {shapeTarget && hasWebRowsSection(shapeTarget) && props.onEditRows ? (
            <WebRowsMenuSection
              target={shapeTarget}
              onOpen={() => props.onEditRows?.(shapeTarget.id, 'web-rows')}
            />
          ) : null}
          {/* Checklist (docs/specs/009-elements/checklist.md): the row opens its rows in the Checklist dialog. */}
          {isChecklist && shapeTarget && props.onEditRows ? (
            <MenuDialogSection
              title="Checklist"
              icon={<DataMenuGlyph />}
              onOpen={() => props.onEditRows?.(shapeTarget.id, 'checklist')}
              flush
            />
          ) : null}
          {/* Legend (docs/specs/009-elements/pie-chart.md): the key's rows, a colour and a word each. */}
          {isLegend && shapeTarget && props.onEditRows ? (
            <MenuDialogSection
              title="Legend"
              icon={<DataMenuGlyph />}
              onOpen={() => props.onEditRows?.(shapeTarget.id, 'legend')}
              flush
            />
          ) : null}
          {isLegend ? (
            <MenuAccordionSection
              title="Legend Style"
              icon={<DataMenuGlyph />}
              {...sectionProps('legend')}
            >
              <LegendTextSize
                current={shapeTarget?.textSize ?? 'md'}
                onSet={props.onSetTextSize}
                onPreview={props.onPreviewTextSize}
                onPreviewEnd={props.onPreviewStyleEnd}
              />
              {/* Its own palette (docs/specs/009-elements/pie-chart.md "Legend"): re-colours every uncoloured row,
                  so a legend set to a chart's palette stays in step with it. */}
              <p className="px-3 pt-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Palette
              </p>
              <ChartPalettePresets
                current={shapeTarget?.chartPalette}
                onApply={props.onApplyChartPalette}
                onPreview={props.onPreviewChartPalette}
                onPreviewEnd={props.onPreviewStyleEnd}
                onReset={() => props.onApplyChartPalette(null)}
              />
            </MenuAccordionSection>
          ) : null}
          {/* Sankey (docs/specs/009-elements/sankey.md): its flows and node colours, then how it draws. Only
            for someone who may edit it (an Editor, on an unlocked diagram). */}
          {isSankey && shapeTarget && props.sankey ? (
            <SankeyMenuSections
              target={shapeTarget}
              handlers={props.sankey}
              sectionProps={sectionProps}
              onOpen={props.onOpenTools}
              inline={surface === 'dialog'}
              onPreviewTextSize={props.onPreviewTextSize}
              onPreviewEnd={props.onPreviewStyleEnd}
            />
          ) : null}
          {/* Map (docs/specs/009-elements/map.md "The menu"): Edit Map and the View, for an Editor only. */}
          {shapeTarget?.shape === 'map' && props.map ? (
            <MapMenuSections
              target={shapeTarget}
              handlers={props.map}
              sectionProps={sectionProps}
              flyoutProps={flyoutProps('map')}
            />
          ) : null}
          {/* Chart (docs/specs/009-elements/pie-chart.md) — display options. Legend placement: Off + 4 sides. */}
          {isChart ? (
            <MenuAccordionSection
              title="Chart"
              icon={<ChartMenuGlyph />}
              {...sectionProps('chart')}
            >
              <p className="px-3 pt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Legend
              </p>
              <LegendPositionTiles
                position={shapeTarget?.chartLegendPosition ?? 'bottom'}
                show={shapeTarget?.chartLegend !== false}
                onSetOff={() => props.onSetChartLegend(false)}
                onSetPosition={props.onSetChartLegendPosition}
              />
              {shapeTarget?.chartLegend !== false ? (
                <LegendTextSize
                  current={shapeTarget?.textSize ?? 'md'}
                  onSet={props.onSetTextSize}
                  onPreview={props.onPreviewTextSize}
                  onPreviewEnd={props.onPreviewStyleEnd}
                />
              ) : null}
              <MenuToggleRow
                label="Show Values"
                description="Each mark's number on the chart"
                checked={shapeTarget?.chartValues === true}
                onToggle={() => props.onSetChartValues(shapeTarget?.chartValues !== true)}
              />
              {/* A pie has no value axis. */}
              {shapeTarget?.shape !== 'pie-chart' ? (
                <ChartAxisRows
                  axis={shapeTarget?.chartAxis === true}
                  series={isLine ? (shapeTarget?.lineSeries ?? LINE_DEFAULT_SERIES) : null}
                  palette={chartFallbackPalette}
                  onSetAxis={props.onSetChartAxis}
                  onSetRightAxis={props.onSetChartRightAxis}
                />
              ) : null}
            </MenuAccordionSection>
          ) : null}
        </MenuToolsSection>
      ) : null}
      {/* Animation (docs/specs/028-animation/element-animations.md): one category per animation set the
            element takes, such as Shape Animation and Text Animation for a labelled shape. */}
      {/* Colours — text / background / border swatches. Boxed elements that
            support colours (excludes images). Icons included: Text tints a
            line-art glyph, Background / Border paint the icon's box. Pie charts
            colour per-slice via their Data category, so they're excluded. */}
    </>
  );
}
