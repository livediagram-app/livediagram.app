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

import { CardMenuSection } from '@/components/palette/CardMenuSection';
import { ChipMenuSection } from '@/components/palette/ChipMenuSection';
import { PointerNoteMenuSection } from '@/components/palette/PointerNoteMenuSection';
import { TagColoursBlock } from '@/components/palette/TagColoursBlock';
import { StackMenuSection } from '@/components/palette/StackMenuSection';
import { BoundaryMenuSection } from '@/components/palette/BoundaryMenuSection';
import {
  hasBuiltInDoorway,
  isChipShape,
  isConceptShape,
  LINE_DEFAULT_SERIES,
  chartRamp,
  chartTypeOf,
  PIE_DEFAULT_SLICES,
  RATING_DEFAULT,
  type ChecklistItem,
  type LegendItem,
  type PieSlice,
} from '@livehuddle/document';
import { ProgressMenuGlyph, ToolsMenuGlyph } from '@/components/palette/context-menu-icons';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { AnimationSections } from '@/components/palette/AnimationSections';
import { MenuFlyoutSection } from '@liveworkspace/workbench/components/primitives/MenuFlyoutSection';
import { LegendTextSize } from '@/components/palette/TypographySections';
import { PortalMenuSection } from '@/components/palette/PortalMenuSection';
import { StageMenuSection } from '@/components/palette/StageMenuSection';
import { JukeboxMenuSection, WorldClockMenuSection } from '@/components/palette/SocialMenuSections';
import { ScreenMenuSection } from '@/components/palette/ScreenMenuSection';
import {
  // The office pieces' settings: a chair's facing and a room's doorway.
  ChairMenuSection,
  RoomMenuSection,
  RoomWallsMenuSection,
} from '@/components/palette/CollabMenuSections';

import { LegendPositionTiles } from '@/components/palette/context-menu-tiles';
import { ChartAxisRows } from '@/components/palette/ChartAxisRows';
import { MenuToggleRow } from '@/components/palette/context-menu-input-rows';

import { ChartTypeTiles } from '@/components/palette/ChartTypeTiles';
import {
  hasWebRowsSection,
  WebRowsMenuSection,
} from '@/components/palette/context-menu-web-editors';
import {
  ChartMenuGlyph,
  ChecklistRowsEditor,
  CodeSummary,
  DataMenuGlyph,
  LegendDataEditor,
  LineDataSummary,
  PieDataEditor,
  ProgressRow,
  RatingMenuGlyph,
  RatingPickerRow,
} from '@/components/palette/context-menu-rows';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { useContextMenuScaffold } from './useContextMenuScaffold';
import { ChartPalettePresets } from './StylePresets';

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
  isPortal: boolean;
  isChair: boolean;
  sectionProps: Scaffold['sectionProps'];
  flyoutProps: Scaffold['flyoutProps'];
};

// Row editors re-seed their draft when handed a different array, so the fallbacks for an element
// without rows are one stable array each rather than a fresh one per render (which reset the draft).
const DEFAULT_PIE_ROWS: PieSlice[] = PIE_DEFAULT_SLICES.map((s) => ({ ...s }));
const NO_CHECKLIST_ITEMS: ChecklistItem[] = [];
const NO_LEGEND_ITEMS: LegendItem[] = [];

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
  isPortal,
  isChair,
  sectionProps,
  flyoutProps,
}: ElementDataSectionsProps) {
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
  const showTools =
    hasWebRowsSection(target) ||
    isChip ||
    shapeTarget?.shape === 'boundary' ||
    shapeTarget?.shape === 'pointer-note' ||
    shapeTarget?.shape === 'stack' ||
    (shapeTarget ? isConceptShape(shapeTarget.shape) : false) ||
    isProgress ||
    isRating ||
    isChart ||
    isCodeBlock ||
    isChecklist ||
    isLegend ||
    isPortal ||
    isChair ||
    (!!shapeTarget && hasBuiltInDoorway(shapeTarget)) ||
    // Every room's Walls, Solid or Glass (docs/specs/009-elements/office.md "Glass walls").
    shapeTarget?.shape === 'room' ||
    shapeTarget?.shape === 'stage' ||
    (shapeTarget?.shape === 'screen' && !!props.onSetScreenUrl) ||
    shapeTarget?.shape === 'world-clock' ||
    shapeTarget?.shape === 'jukebox';
  return (
    <>
      {showTools ? (
        <MenuFlyoutSection title="Tools" icon={<ToolsMenuGlyph />} {...flyoutProps('tools')}>
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
              {isLine ? (
                <LineDataSummary
                  palette={chartFallbackPalette}
                  series={
                    shapeTarget?.lineSeries ??
                    LINE_DEFAULT_SERIES.map((s) => ({ ...s, values: [...s.values] }))
                  }
                  onEdit={() => target.type === 'shape' && props.onEditLineData(target.id)}
                />
              ) : (
                <PieDataEditor
                  palette={chartFallbackPalette}
                  slices={shapeTarget?.pieSlices ?? DEFAULT_PIE_ROWS}
                  onChange={props.onSetPieData}
                />
              )}
            </MenuAccordionSection>
          ) : null}
          {/* Code (docs/specs/009-elements/code-block.md) — the snippet summary + the modal opener (the
            multi-line editor is too big for the menu, like the line grid). */}
          {isCodeBlock ? (
            <MenuAccordionSection title="Code" icon={<DataMenuGlyph />} {...sectionProps('code')}>
              <CodeSummary
                code={shapeTarget?.code ?? ''}
                language={shapeTarget?.codeLanguage ?? 'plain'}
                wrap={shapeTarget?.codeWrap !== false}
                onSetWrap={props.onSetCodeWrap}
                onEdit={() => target.type === 'shape' && props.onEditCodeBlock(target.id)}
              />
            </MenuAccordionSection>
          ) : null}
          {/* Only an older room keeps a doorway of its own (docs/specs/009-elements/office.md "Older rooms keep their
          built-in doorway"): a new Room's and a custom room's ways in are Door pieces. */}
          {shapeTarget && hasBuiltInDoorway(shapeTarget) ? (
            <RoomMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetDoor={props.onSetRoomDoor}
            />
          ) : null}
          {/* Every room's walls, Solid or Glass (docs/specs/009-elements/office.md "Glass walls"). */}
          {shapeTarget?.shape === 'room' ? (
            <RoomWallsMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetWalls={props.onSetRoomWalls}
            />
          ) : null}
          {shapeTarget?.shape === 'stage' ? (
            <StageMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetStage={props.onSetStage}
            />
          ) : null}
          {shapeTarget?.shape === 'world-clock' && props.onSetClockZones ? (
            <WorldClockMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetZones={props.onSetClockZones}
            />
          ) : null}
          {shapeTarget?.shape === 'jukebox' && props.onSetJukeboxSource ? (
            <JukeboxMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetSource={props.onSetJukeboxSource}
            />
          ) : null}
          {shapeTarget?.shape === 'screen' && props.onSetScreenUrl ? (
            <ScreenMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetScreenUrl={props.onSetScreenUrl}
            />
          ) : null}
          {isChair ? (
            <ChairMenuSection
              target={shapeTarget ?? undefined}
              sectionProps={sectionProps}
              onSetFacing={props.onSetChairFacing}
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
          {shapeTarget && hasWebRowsSection(shapeTarget) ? (
            <WebRowsMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetRows={props.onSetWebRows}
            />
          ) : null}
          {/* Checklist (docs/specs/009-elements/checklist.md) — the rows: done toggles, text, add / remove. */}
          {isChecklist ? (
            <MenuAccordionSection
              title="Checklist"
              icon={<DataMenuGlyph />}
              {...sectionProps('checklist')}
            >
              <ChecklistRowsEditor
                items={shapeTarget?.checklistItems ?? NO_CHECKLIST_ITEMS}
                onChange={props.onSetChecklistItems}
                onToggle={
                  shapeTarget && props.onToggleChecklistItem
                    ? (index) => props.onToggleChecklistItem!(shapeTarget.id, index)
                    : undefined
                }
              />
            </MenuAccordionSection>
          ) : null}
          {/* Legend (docs/specs/009-elements/pie-chart.md): the key's rows, a colour and a word each. */}
          {isLegend ? (
            <MenuAccordionSection
              title="Legend"
              icon={<DataMenuGlyph />}
              {...sectionProps('legend')}
            >
              <LegendDataEditor
                items={shapeTarget?.legendItems ?? NO_LEGEND_ITEMS}
                palette={chartFallbackPalette}
                onChange={props.onSetLegendItems}
              />
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
        </MenuFlyoutSection>
      ) : null}
      {/* Animation (docs/specs/028-animation/element-animations.md): one category per animation set the
            element takes, such as Shape Animation and Text Animation for a labelled shape. */}
      <AnimationSections
        elements={[target]}
        keyPrefix=""
        sectionProps={sectionProps}
        flyoutProps={flyoutProps}
        handlers={props}
      />
      {/* Colours — text / background / border swatches. Boxed elements that
            support colours (excludes images). Icons included: Text tints a
            line-art glyph, Background / Border paint the icon's box. Pie charts
            colour per-slice via their Data category, so they're excluded. */}
    </>
  );
}
