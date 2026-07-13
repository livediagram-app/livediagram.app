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

import {
  animLoops,
  DEFAULT_ANIMATION_SPEED,
  LINE_DEFAULT_SERIES,
  PIE_DEFAULT_SLICES,
  PIE_LOOPING_ANIMS,
  PROGRESS_LOOPING_ANIMS,
  RAIL_DEFAULT_POINTS,
  RATING_DEFAULT,
  RATING_LOOPING_ANIMS,
  type AnimationSpeed,
  type ArrowFlow,
  type ElementAnimation,
  type IconAnimation,
} from '@livediagram/diagram';
import {} from '@/components/palette/palette-icons';
import {
  AnimationMenuGlyph,
  ProgressMenuGlyph,
  ToolsMenuGlyph,
} from '@/components/palette/context-menu-icons';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';

import {
  AnimationTiles,
  FlowTiles,
  IconAnimationTiles,
  LegendPositionTiles,
} from '@/components/palette/context-menu-tiles';
import {
  ChartMenuGlyph,
  DataMenuGlyph,
  LineDataSummary,
  PieAnimTiles,
  PieDataEditor,
  ProgressAnimTiles,
  ProgressRow,
  RailPointsRow,
  RatingAnimTiles,
  RatingMenuGlyph,
  RatingPickerRow,
} from '@/components/palette/context-menu-rows';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { useContextMenuScaffold } from './useContextMenuScaffold';

type Scaffold = ReturnType<typeof useContextMenuScaffold>;

// The element menu's data-shape sections: Progress, Timeline Rail, Rating, and
// the Pie / Bar / Line chart Data + Chart + Animation controls. Split out of
// ElementAppearanceSections; the type flags are passed in (the parent already
// derives them) and the shape narrowing is re-derived off target.
type ElementDataSectionsProps = {
  props: EditorContextMenuProps;
  target: EditorContextMenuProps['elements'][number];
  isProgress: boolean;
  isRail: boolean;
  isRating: boolean;
  isChart: boolean;
  isLine: boolean;
  isIcon: boolean;
  boxed: boolean;
  sectionProps: Scaffold['sectionProps'];
  flyoutProps: Scaffold['flyoutProps'];
};

export function ElementDataSections({
  props,
  target,
  isProgress,
  isRail,
  isRating,
  isChart,
  isLine,
  isIcon,
  boxed,
  sectionProps,
  flyoutProps,
}: ElementDataSectionsProps) {
  const shapeTarget = target.type === 'shape' ? target : null;
  // The Tools flyout (spec/09): the data-shape-specific controls —
  // Progress (bar / ring), Timeline rail, Rating, and the chart Data +
  // Chart sections — fold behind one "Tools" row, the same side-flyout
  // pattern as Style and Text, so a data element's menu doesn't grow a
  // band of bespoke rows. Animation stays top-level (every boxed
  // element has it).
  const showTools = isProgress || isRail || isRating || isChart;
  return (
    <>
      {showTools ? (
        <MenuFlyoutSection title="Tools" icon={<ToolsMenuGlyph />} {...flyoutProps('tools')}>
          {/* Progress (spec/46) — the percentage + how the fill animates. Only
            for progress bars / rings. */}
          {isProgress ? (
            <MenuAccordionSection
              title="Progress"
              icon={<ProgressMenuGlyph />}
              {...sectionProps('progress')}
            >
              <ProgressRow value={shapeTarget?.progress ?? 50} onChange={props.onSetProgress} />
              <ProgressAnimTiles
                anim={shapeTarget?.progressAnim ?? null}
                speed={shapeTarget?.progressAnimSpeed ?? DEFAULT_ANIMATION_SPEED}
                repeat={animLoops(
                  shapeTarget?.progressAnim,
                  shapeTarget?.progressAnimRepeat,
                  PROGRESS_LOOPING_ANIMS,
                )}
                onSet={props.onSetProgressAnim}
                onSetSpeed={props.onSetProgressAnimSpeed}
                onSetRepeat={props.onSetProgressAnimRepeat}
              />
            </MenuAccordionSection>
          ) : null}
          {/* Timeline (spec/51) — how many points sit on the rail. The right-end
            "+" on the canvas adds one too; this is the precise control. */}
          {isRail ? (
            <MenuAccordionSection
              title="Timeline"
              icon={<ProgressMenuGlyph />}
              {...sectionProps('timeline')}
            >
              <RailPointsRow
                value={shapeTarget?.railCount ?? RAIL_DEFAULT_POINTS}
                onChange={props.onSetRailCount}
              />
            </MenuAccordionSection>
          ) : null}
          {/* Rating (spec/52) — the star score + a star-specific animation. */}
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
              <RatingAnimTiles
                anim={shapeTarget?.ratingAnim ?? null}
                speed={shapeTarget?.ratingAnimSpeed ?? DEFAULT_ANIMATION_SPEED}
                repeat={animLoops(
                  shapeTarget?.ratingAnim,
                  shapeTarget?.ratingAnimRepeat,
                  RATING_LOOPING_ANIMS,
                )}
                onSet={props.onSetRatingAnim}
                onSetSpeed={props.onSetRatingAnimSpeed}
                onSetRepeat={props.onSetRatingAnimRepeat}
              />
            </MenuAccordionSection>
          ) : null}
          {/* Data (spec/53) — the chart's data. Pie / bar edit a single row of
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
                  series={
                    shapeTarget?.lineSeries ??
                    LINE_DEFAULT_SERIES.map((s) => ({ ...s, values: [...s.values] }))
                  }
                  onEdit={() => target.type === 'shape' && props.onEditLineData(target.id)}
                />
              ) : (
                <PieDataEditor
                  slices={shapeTarget?.pieSlices ?? PIE_DEFAULT_SLICES.map((s) => ({ ...s }))}
                  onChange={props.onSetPieData}
                />
              )}
            </MenuAccordionSection>
          ) : null}
          {/* Chart (spec/53) — display options. Legend placement: Off + 4 sides. */}
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
                position={shapeTarget?.chartLegendPosition ?? 'right'}
                show={shapeTarget?.chartLegend !== false}
                onSetOff={() => props.onSetChartLegend(false)}
                onSetPosition={props.onSetChartLegendPosition}
              />
            </MenuAccordionSection>
          ) : null}
        </MenuFlyoutSection>
      ) : null}
      {/* Animation (spec/09) — a looping attention/status effect on the
            element. None clears it. Pie charts swap the boxed-element set for
            their own slice animations (the chart family's set). */}
      {boxed ? (
        <MenuAccordionSection
          title="Animation"
          icon={<AnimationMenuGlyph />}
          {...sectionProps('animation')}
        >
          {isChart ? (
            <PieAnimTiles
              anim={shapeTarget?.pieAnim ?? null}
              speed={shapeTarget?.pieAnimSpeed ?? DEFAULT_ANIMATION_SPEED}
              repeat={animLoops(
                shapeTarget?.pieAnim,
                shapeTarget?.pieAnimRepeat,
                PIE_LOOPING_ANIMS,
              )}
              onSet={props.onSetPieAnim}
              onSetSpeed={props.onSetPieAnimSpeed}
              onSetRepeat={props.onSetPieAnimRepeat}
            />
          ) : isIcon ? (
            // Icons get their own glyph-motion set (spin / beat / pulse / …)
            // instead of the boxed-element animation set.
            <IconAnimationTiles
              animation={(target as { iconAnimation?: IconAnimation }).iconAnimation ?? null}
              speed={
                (target as { iconAnimationSpeed?: AnimationSpeed }).iconAnimationSpeed ??
                DEFAULT_ANIMATION_SPEED
              }
              repeat={(target as { iconAnimationRepeat?: boolean }).iconAnimationRepeat ?? true}
              onSet={props.onSetIconAnimation}
              onSetSpeed={props.onSetIconAnimationSpeed}
              onSetRepeat={props.onSetIconAnimationRepeat}
              onPreview={props.onPreviewIconAnimation}
              onPreviewEnd={props.onAnimationPreviewEnd}
            />
          ) : (
            <AnimationTiles
              animation={(target as { animation?: ElementAnimation }).animation ?? null}
              speed={
                (target as { animationSpeed?: AnimationSpeed }).animationSpeed ??
                DEFAULT_ANIMATION_SPEED
              }
              repeat={(target as { animationRepeat?: boolean }).animationRepeat ?? true}
              onSet={props.onSetAnimation}
              onSetSpeed={props.onSetAnimationSpeed}
              onSetRepeat={props.onSetAnimationRepeat}
              onPreview={props.onPreviewAnimation}
              onPreviewEnd={props.onAnimationPreviewEnd}
            />
          )}
        </MenuAccordionSection>
      ) : null}
      {/* Animation (spec/09) — animate an arrow to show direction: marching
            dashes, a travelling dot, beads, or an in-place pulse / grow / glow.
            None clears it. (Labelled "Animation" to match the boxed-element
            control; the field is still `flow`.) */}
      {target.type === 'arrow' ? (
        <MenuAccordionSection
          title="Animation"
          icon={<AnimationMenuGlyph />}
          {...sectionProps('flow')}
        >
          <FlowTiles
            flow={(target as { flow?: ArrowFlow }).flow ?? null}
            speed={(target as { flowSpeed?: AnimationSpeed }).flowSpeed ?? DEFAULT_ANIMATION_SPEED}
            repeat={(target as { flowRepeat?: boolean }).flowRepeat ?? true}
            onSet={props.onSetArrowFlow}
            onSetSpeed={props.onSetFlowSpeed}
            onSetRepeat={props.onSetFlowRepeat}
            onPreview={props.onPreviewArrowFlow}
            onPreviewEnd={props.onAnimationPreviewEnd}
          />
        </MenuAccordionSection>
      ) : null}
      {/* Colours — text / background / border swatches. Boxed elements that
            support colours (excludes images). Icons included: Text tints a
            line-art glyph, Background / Border paint the icon's box. Pie charts
            colour per-slice via their Data category, so they're excluded. */}
    </>
  );
}
