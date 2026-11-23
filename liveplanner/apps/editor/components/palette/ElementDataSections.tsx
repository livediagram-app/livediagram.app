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
import { ChipMenuSection } from '@/components/palette/ChipMenuSection';
import { PointerNoteMenuSection } from '@/components/palette/PointerNoteMenuSection';
import { TagColoursBlock } from '@/components/palette/TagColoursBlock';
import { StackMenuSection } from '@/components/palette/StackMenuSection';
import { BoundaryMenuSection } from '@/components/palette/BoundaryMenuSection';
import { SequenceMenuSection } from '@/components/palette/SequenceMenuSection';
import {
  elementKindLabel,
  isChipShape,
  LINE_DEFAULT_SERIES,
  chartRamp,
  chartTypeOf,
  PIE_DEFAULT_SLICES,
  RATING_DEFAULT,
  type PieSlice,
} from '@liveplanner/project';
import {
  ProgressMenuGlyph,
  ToolsMenuGlyph,
} from '@liveworkspace/workbench/components/palette/context-menu-icons';
import {
  MenuAccordionSection,
  MenuGroupSeparator,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { AnimationSections } from '@/components/palette/AnimationSections';
import { useCoversCanvas } from '@/hooks/plan/plan-cover-store';
import { MenuDialogSection } from '@liveworkspace/workbench/components/primitives/MenuDialogSection';
import { MenuToolsSection } from '@liveworkspace/workbench/components/primitives/MenuToolsSection';
import { LegendTextSize } from '@/components/palette/TypographySections';
import { PortalMenuSection } from '@/components/palette/PortalMenuSection';
import { DecisionMenuSection } from '@/components/palette/CollabMenuSections';
import { PickerMenuSection, SessionMenuSection } from '@/components/palette/BehaviourMenuSections';

import { LegendPositionTiles } from '@/components/palette/context-menu-tiles';
import { ChartAxisRows } from '@liveworkspace/workbench/components/palette/ChartAxisRows';
import { MenuToggleRow } from '@/components/palette/context-menu-input-rows';

import { ChartTypeTiles } from '@liveworkspace/workbench/components/palette/ChartTypeTiles';
import {
  hasWebRowsSection,
  WebRowsMenuSection,
} from '@/components/palette/context-menu-web-editors';
import { DataMenuGlyph } from '@liveworkspace/workbench/components/palette/context-menu-data-parts';
import {
  ChartMenuGlyph,
  LineDataSummary,
  LinkedChartData,
  PieDataSummary,
  ProgressRow,
  RatingMenuGlyph,
  RatingPickerRow,
} from '@/components/palette/context-menu-rows';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { useContextMenuScaffold } from '@liveworkspace/workbench/components/palette/useContextMenuScaffold';
import { ChartPalettePresets } from './StylePresets';

// Plan's UI loads only when it is drawn (docs/specs/026-plan/plan-mode.md "Cost"), so a project without
// Plan pays nothing for it.
// A Sankey's sections (docs/specs/009-elements/sankey.md "The menu") load only when a Sankey's menu opens.
const SankeyMenuSections = dynamic(
  () => import('./SankeyMenuSection').then((m) => m.SankeyMenuSections),
  { ssr: false },
);
const PlanBoardMenuSections = dynamic(
  () => import('./PlanBoardMenuSection').then((m) => m.PlanBoardMenuSections),
  { ssr: false },
);

// A Sheet's settings flyout (docs/specs/029-sheets/sheet.md "Sheet Settings"), loaded with the sheet chunk.
const SheetMenuSection = dynamic(
  () => import('@/components/sheets/SheetMenuSection').then((m) => m.SheetMenuSection),
  { ssr: false },
);

// A Plan card's Card flyout (docs/specs/026-plan/plan-board.md "The Plan card"), loaded with the rest of Plan.
const PlanCardMenuSection = dynamic(
  () => import('./PlanCardMenuSection').then((m) => m.PlanCardMenuSection),
  { ssr: false },
);
// A Gantt chart's View flyout (docs/specs/026-plan/plan-views.md "Swimlanes"), loaded with the rest of Plan.
const PlanViewMenuSection = dynamic(
  () => import('./PlanViewMenuSection').then((m) => m.PlanViewMenuSection),
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
  isPortal: boolean;
  isSessionButton: boolean;
  isPicker: boolean;
  // The collaboration element that carries settings (docs/specs/012-collaboration/decision-record.md).
  // The temperature check has none — it is entirely driven from its own face — so it gets no flag.
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
  isPortal,
  isSessionButton,
  isPicker,
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
  const covering = useCoversCanvas(target.id);
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
  const showTools =
    hasWebRowsSection(target) ||
    isChip ||
    shapeTarget?.shape === 'boundary' ||
    shapeTarget?.shape === 'pointer-note' ||
    shapeTarget?.shape === 'stack' ||
    // A sequence diagram has its row only for someone who may open its dialog.
    (shapeTarget?.shape === 'sequence' && !!props.onEditSequence) ||
    isProgress ||
    isRating ||
    isChart ||
    isCodeBlock ||
    isChecklist ||
    isLegend ||
    isSankey ||
    isPortal ||
    isSessionButton ||
    isPicker ||
    isDecision;
  return (
    <>
      {/* A Plan board's own settings (docs/specs/026-plan/plan-board.md "The board set-up"): its own
          flyout, ahead of Tools, as every board-wide choice lives here. */}
      {shapeTarget?.shape === 'plan-board' ? (
        <>
          <PlanBoardMenuSections
            element={shapeTarget}
            flyoutProps={flyoutProps}
            onClose={props.onClose}
          />
        </>
      ) : null}
      {/* A Sheet's settings: the cog's sections, as a board's Board flyout. */}
      {shapeTarget?.shape === 'plan-sheet' ? (
        <SheetMenuSection element={shapeTarget} flyoutProps={flyoutProps} onClose={props.onClose} />
      ) : null}
      {shapeTarget?.shape === 'plan-card' && shapeTarget.planCard ? (
        <PlanCardMenuSection
          element={shapeTarget}
          flyoutProps={flyoutProps('plan-card')}
          sectionProps={sectionProps}
        />
      ) : null}
      {shapeTarget?.shape === 'plan-view' && shapeTarget.planView ? (
        <PlanViewMenuSection
          element={shapeTarget}
          flyoutProps={flyoutProps('plan-view')}
          sectionProps={sectionProps}
        />
      ) : null}
      {surface === 'dialog' ? null : (
        <>
          {/* Animation sits straight under Appearance, on every element (owner, 2026-11-23); what is the element's
          own (its Tools, or the one row that opens its dialog) follows under a rule, as a table's Table row does. */}
          {/* Animation (docs/specs/008-canvas/canvas-and-palette.md "Animated elements"): the element's own animation category (an icon's, a chart's, an
            arrow's). None while it covers the canvas (maximised, or Fill Tab): it does not animate there. */}
          {covering ? null : (
            <AnimationSections
              elements={[target]}
              keyPrefix=""
              sectionProps={sectionProps}
              flyoutProps={flyoutProps}
              handlers={props}
            />
          )}
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
              {shapeTarget?.chartSource ? (
                <LinkedChartData onUnlink={props.onUnlinkChart} />
              ) : isLine ? (
                <LineDataSummary
                  palette={chartFallbackPalette}
                  series={
                    shapeTarget?.lineSeries ??
                    LINE_DEFAULT_SERIES.map((s) => ({ ...s, values: [...s.values] }))
                  }
                  onEdit={() => target.type === 'shape' && props.onEditLineData(target.id)}
                />
              ) : (
                <PieDataSummary
                  palette={chartFallbackPalette}
                  slices={shapeTarget?.pieSlices ?? DEFAULT_PIE_ROWS}
                  onEdit={() => shapeTarget && props.onEditRows(shapeTarget.id, 'slices')}
                />
              )}
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
          {/* The decision record's settings (docs/specs/012-collaboration/decision-record.md), a small form of its
            own — see CollabMenuSections. */}
          {isDecision ? (
            <DecisionMenuSection
              target={shapeTarget ?? undefined}
              sectionProps={sectionProps}
              onSetStatus={props.onSetDecisionStatus}
              onSetDate={props.onSetDecisionDate}
              onSetDrivers={props.onSetDecisionDrivers}
            />
          ) : null}
          {/* Web components (docs/specs/009-elements/web-components-and-no-groups.md) — a stat row's cards, a process's
            steps, a header's links: add / remove / reorder. */}
          {/* A boundary's style (docs/specs/009-elements/boundary.md). */}
          {shapeTarget?.shape === 'boundary' ? (
            <BoundaryMenuSection
              target={shapeTarget}
              ops={props.elementStyle}
              sectionProps={sectionProps}
            />
          ) : null}
          {/* A badge's or step number's look, Detach, Renumber (docs/specs/009-elements/badge.md). */}
          {shapeTarget && isChip ? (
            <ChipMenuSection
              target={shapeTarget}
              ops={props.elementStyle}
              sectionProps={sectionProps}
            />
          ) : null}
          {/* A stack's arrangement (docs/specs/009-elements/stack.md). */}
          {shapeTarget?.shape === 'stack' ? (
            <StackMenuSection
              target={shapeTarget}
              ops={props.elementStyle}
              sectionProps={sectionProps}
            />
          ) : null}
          {/* A sequence diagram's summary, Edit Sequence and Numbered; Play is in the Animation row
              (docs/specs/009-elements/sequence-diagram.md "The menu"). */}
          {shapeTarget?.shape === 'sequence' ? (
            <SequenceMenuSection target={shapeTarget} onEdit={props.onEditSequence} />
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
          {shapeTarget && hasWebRowsSection(shapeTarget) ? (
            <WebRowsMenuSection
              target={shapeTarget}
              onOpen={() => props.onEditRows(shapeTarget.id, 'web-rows')}
            />
          ) : null}
          {/* Checklist (docs/specs/009-elements/checklist.md): the row opens its rows in the Checklist dialog. */}
          {isChecklist && shapeTarget ? (
            <MenuDialogSection
              title="Checklist"
              icon={<DataMenuGlyph />}
              onOpen={() => props.onEditRows(shapeTarget.id, 'checklist')}
              flush
            />
          ) : null}
          {/* Legend (docs/specs/009-elements/pie-chart.md): the key's rows, a colour and a word each. */}
          {isLegend && shapeTarget ? (
            <MenuDialogSection
              title="Legend"
              icon={<DataMenuGlyph />}
              onOpen={() => props.onEditRows(shapeTarget.id, 'legend')}
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
          {/* Portal (docs/specs/009-elements/portal-element.md) — its name, where it leads (any tab), and a
            shortcut to create the far end. See PortalMenuSection. */}
          {isPortal && shapeTarget ? (
            <PortalMenuSection
              portal={shapeTarget}
              tabs={props.tabs}
              activeTabId={props.activeTabId}
              onSetPortalTarget={props.onSetPortalTarget}
              onSetPortalName={props.onSetPortalName}
              onCreateLinkedPortal={props.onCreateLinkedPortal}
              sectionProps={sectionProps('portal-target')}
            />
          ) : null}
          {/* Session button (docs/specs/012-collaboration/session-button.md) — which tool a press starts, and its
            one setting. See BehaviourMenuSections. */}
          {isSessionButton && shapeTarget && props.onSetSession ? (
            <SessionMenuSection
              element={shapeTarget}
              onSetSession={props.onSetSession}
              sectionProps={sectionProps('session')}
            />
          ) : null}
          {/* Picker (docs/specs/012-collaboration/picker.md) — where it draws candidates from. */}
          {isPicker && shapeTarget ? (
            <PickerMenuSection
              element={shapeTarget}
              onSetPickerSource={props.onSetPickerSource}
              onSetPickerOptions={props.onSetPickerOptions}
              sectionProps={sectionProps('picker')}
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
      {/* Colours — text / background / border swatches. Boxed elements that
            support colours (excludes images). Icons included: Text tints a
            line-art glyph, Background / Border paint the icon's box. Pie charts
            colour per-slice via their Data category, so they're excluded. */}
    </>
  );
}
