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

import { SheetLinkSection } from '@liveworkspace/workbench/components/sheet-links/SheetLinkSection';
import dynamic from 'next/dynamic';
import {
  elementKindLabel,
  bpmnSymbolOf,
  isChipShape,
  LINE_DEFAULT_SERIES,
  chartRamp,
  chartTypeOf,
  PIE_DEFAULT_SLICES,
  RATING_DEFAULT,
  type PieSlice,
} from '@livediagram/document';
import {
  ProgressMenuGlyph,
  ToolsMenuGlyph,
} from '@liveworkspace/workbench/components/palette/context-menu-icons';
import {
  MenuAccordionSection,
  MenuGroupSeparator,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { MindMapMenuSections } from './MindMapMenuSections';
import { FlowchartMenuSections } from '@/components/flowchart/FlowchartMenuSections';
import { AnimationSections } from '@/components/palette/AnimationSections';
import { MenuDialogSection } from '@liveworkspace/workbench/components/primitives/MenuDialogSection';
import { MenuToolsSection } from '@liveworkspace/workbench/components/primitives/MenuToolsSection';
import { LegendTextSize } from '@/components/palette/TypographySections';
import { DecisionMenuSection, EstimateMenuSection } from '@/components/palette/CollabMenuSections';

import { LegendPositionTiles } from '@/components/palette/context-menu-tiles';
import { ChartAxisRows } from '@liveworkspace/workbench/components/palette/ChartAxisRows';
import { MenuToggleRow } from '@/components/palette/context-menu-input-rows';

import { ChartTypeTiles } from '@liveworkspace/workbench/components/palette/ChartTypeTiles';
import { hasWebRowsSection } from '@/components/palette/context-menu-web-editors';
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
import { ElementBehaviourToolSections } from './ElementBehaviourToolSections';
import { ElementLayoutToolSections } from './ElementLayoutToolSections';

// A Sankey's sections (docs/specs/009-elements/sankey.md "The menu") load only when a Sankey's menu opens.
const SankeyMenuSections = dynamic(
  () => import('./SankeyMenuSection').then((m) => m.SankeyMenuSections),
  { ssr: false },
);
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
  isMindNode: boolean;
  isEntity: boolean;
  isModeButton: boolean;
  isSessionButton: boolean;
  isReveal: boolean;
  isPicker: boolean;
  isReactionPad: boolean;
  // The collaboration elements that carry settings (docs/specs/012-collaboration/estimate-card.md, 127, 128, 130).
  // The temperature check, idea box and roll call have none — they are entirely
  // driven from their own faces — so they get no flag.
  isEstimate: boolean;
  isAgenda: boolean;
  isDecision: boolean;
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
  isMindNode,
  isEntity,
  isModeButton,
  isSessionButton,
  isReveal,
  isPicker,
  isReactionPad,
  isEstimate,
  isAgenda,
  isDecision,
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
    isChip ||
    shapeTarget?.shape === 'boundary' ||
    (shapeTarget ? !!bpmnSymbolOf(shapeTarget) : false) ||
    shapeTarget?.shape === 'pointer-note' ||
    shapeTarget?.shape === 'stack' ||
    // A sequence diagram has its row only for someone who may open its dialog.
    (shapeTarget?.shape === 'sequence' && !!props.onEditSequence) ||
    isProgress ||
    isRating ||
    isChart ||
    isCodeBlock ||
    (isChecklist && rowsOffered) ||
    (isLegend && rowsOffered) ||
    isSankey ||
    isMindNode ||
    (isEntity && !!props.onEditEntityFields) ||
    isModeButton ||
    isSessionButton ||
    isReveal ||
    isPicker ||
    isReactionPad ||
    isEstimate ||
    (isAgenda && rowsOffered) ||
    isDecision ||
    !!props.flowchart;
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
                            ? () => props.onEditRows?.(shapeTarget.id, 'slices')
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
          {/* The collaboration elements' settings (docs/specs/012-collaboration/estimate-card.md, 127, 128, 130).
            Each is a small form of its own — see CollabMenuSections. */}
          {isEstimate ? (
            <EstimateMenuSection
              target={shapeTarget ?? undefined}
              sectionProps={sectionProps}
              onSetScale={props.onSetEstimateScale}
            />
          ) : null}
          {/* Agenda (docs/specs/012-collaboration/agenda.md): the row opens its segments in the Segments dialog. */}
          {isAgenda && shapeTarget && props.onEditRows ? (
            <MenuDialogSection
              title="Segments"
              icon={<DataMenuGlyph />}
              onOpen={() => props.onEditRows?.(shapeTarget.id, 'segments')}
              flush
            />
          ) : null}
          {isDecision ? (
            <DecisionMenuSection
              target={shapeTarget ?? undefined}
              sectionProps={sectionProps}
              onSetStatus={props.onSetDecisionStatus}
              onSetDate={props.onSetDecisionDate}
              onSetDrivers={props.onSetDecisionDrivers}
            />
          ) : null}
          {/* Called, not rendered: hookless, its fragment counts section by section for the flyout's lone-section promotion. */}
          {ElementLayoutToolSections({ props, shapeTarget, isChip, sectionProps })}
          {/* Entity (docs/specs/009-elements/entity.md "The Fields dialog"): the row opens the fields in a dialog,
            where a row of key, name and type has room. */}
          {isEntity && shapeTarget && props.onEditEntityFields ? (
            <MenuDialogSection
              title="Fields"
              icon={<DataMenuGlyph />}
              onOpen={() => props.onEditEntityFields?.(shapeTarget.id)}
              flush
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
          {/* Mind map (docs/specs/009-elements/mind-node.md "The Mind Map menu"): a flyout of Outline, Branching and Spacing.
            Branching and Spacing set the ROOT's, so one pick re-shapes the whole map rather than half of it. */}
          {isMindNode ? (
            <MindMapMenuSections
              flow={props.mindFlow}
              spacing={props.mindSpacing}
              onSetFlow={props.onSetMindFlow}
              onSetSpacing={props.onSetMindSpacing}
              onTidy={props.onTidyMindMap}
              onEditOutline={props.onEditMindOutline}
              onSelectBranch={props.onSelectMindBranch}
              onSelectMap={props.onSelectMindMap}
              sectionProps={sectionProps}
              flyoutProps={flyoutProps('mind-map')}
            />
          ) : null}
          {/* Flowchart (docs/specs/009-elements/flowchart.md "The Flowchart menu"): a flyout of Chart (lanes and
            tidy), the step's Step Type and the chart's Direction. */}
          {props.flowchart ? (
            <FlowchartMenuSections
              {...props.flowchart}
              sectionProps={sectionProps}
              flyoutProps={flyoutProps('flowchart')}
            />
          ) : null}
          {/* Called, not rendered: hookless, its fragment counts section by section for the flyout's lone-section promotion. */}
          {ElementBehaviourToolSections({
            props,
            shapeTarget,
            isModeButton,
            isSessionButton,
            isReveal,
            isPicker,
            isReactionPad,
            sectionProps,
          })}
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
