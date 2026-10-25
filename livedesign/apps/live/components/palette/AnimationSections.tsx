// Every animation category for a selection (docs/specs/028-animation/element-animations.md "The
// menu"): one per set present, titled by its set, in a fixed order, each acting only on its own
// members. The single-element menu passes one element; the multi-select menu passes the whole
// selection, so the two menus cannot drift.

import {
  ANIMATION_SET_NAME,
  DEFAULT_ANIMATION_SPEED,
  PIE_LOOPING_ANIMS,
  PROGRESS_LOOPING_ANIMS,
  RATING_LOOPING_ANIMS,
  SANKEY_LOOPING_ANIMS,
  animLoops,
  animationSetsOf,
  isChartShape,
  isConceptShape,
  isProgressShape,
  isRatingShape,
  isSankeyShape,
  type ConceptShape,
  type AnimationSetId,
  type Element,
  type ShapeAnimation,
  type ShapeElement,
  inAnimationSet,
  shapeAnimationsFor,
} from '@livedesign/design';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { MenuFlyoutSection } from '@liveworkspace/workbench/components/primitives/MenuFlyoutSection';
import { AnimationMenuGlyph } from '@liveworkspace/workbench/components/palette/context-menu-icons';
import { FlowTiles, IconAnimationTiles } from '@/components/palette/context-menu-tiles';
import { PieAnimTiles } from '@/components/palette/context-menu-rows';
import {
  ProgressAnimTiles,
  RatingAnimTiles,
  SankeyAnimTiles,
} from '@/components/palette/context-menu-data-rows';
import { ConceptAnimTiles } from '@/components/palette/ElementAnimationTiles';
import { AnimationSetTiles } from '@/components/palette/AnimationSetTiles';
import { setAnimationState } from '@/lib/animation-set-writes';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

type Handlers = Pick<
  EditorContextMenuProps,
  | 'onSetSetAnimation'
  | 'onPreviewSetAnimation'
  | 'onSetSetAnimationSpeed'
  | 'onSetSetAnimationRepeat'
  | 'onAnimationPreviewEnd'
  | 'onSetIconAnimation'
  | 'onSetIconAnimationSpeed'
  | 'onSetIconAnimationRepeat'
  | 'onPreviewIconAnimation'
  | 'onSetPieAnim'
  | 'onSetPieAnimSpeed'
  | 'onSetPieAnimRepeat'
  | 'onSetArrowFlow'
  | 'onSetFlowSpeed'
  | 'onSetFlowRepeat'
  | 'onPreviewArrowFlow'
  | 'onSetProgressAnim'
  | 'onSetProgressAnimSpeed'
  | 'onSetProgressAnimRepeat'
  | 'onSetRatingAnim'
  | 'onSetRatingAnimSpeed'
  | 'onSetRatingAnimRepeat'
  | 'elementStyle'
  | 'sankey'
>;

type SectionProps = { open: boolean; onToggle: () => void; flush?: boolean };

// The categories in menu order. Body sets come before the words they carry; arrows come last.
type OwnCategory = 'icon' | 'chart' | 'sankey' | 'progress' | 'rating' | 'concept' | 'arrow';
type Category = AnimationSetId | OwnCategory;
const ORDER: readonly Category[] = [
  'shape',
  'sticky',
  'drawing',
  'media',
  'table',
  'icon',
  'chart',
  'sankey',
  'progress',
  'rating',
  'concept',
  'text',
  'arrow',
];
const OWN_NAME: Record<OwnCategory, string> = {
  icon: 'Icon',
  chart: 'Chart',
  sankey: 'Sankey',
  progress: 'Progress',
  rating: 'Rating',
  concept: 'Concept',
  arrow: 'Arrow',
};

// The element-owned category a shape takes, if any (each read and written by its own tiles below).
function ownCategoryOf(el: Element): OwnCategory | undefined {
  if (el.type === 'arrow') return 'arrow';
  if (el.type !== 'shape') return undefined;
  if (el.shape === 'icon') return 'icon';
  if (isChartShape(el.shape)) return 'chart';
  if (isSankeyShape(el.shape)) return 'sankey';
  if (isProgressShape(el.shape)) return 'progress';
  if (isRatingShape(el.shape)) return 'rating';
  if (isConceptShape(el.shape)) return 'concept';
  return undefined;
}

const nameOf = (c: Category) =>
  c in OWN_NAME ? OWN_NAME[c as keyof typeof OWN_NAME] : ANIMATION_SET_NAME[c as AnimationSetId];

/** The categories a selection shows, in order. */
export function animationCategoriesOf(elements: readonly Element[]): Category[] {
  const present = new Set<Category>(animationSetsOf(elements));
  for (const el of elements) {
    const own = ownCategoryOf(el);
    if (own) present.add(own);
  }
  return ORDER.filter((c) => present.has(c));
}

/** The Shape values every Shape member of the selection is offered, in the set's order. */
export function sharedShapeAnimations(elements: readonly Element[]): readonly ShapeAnimation[] {
  let shared: readonly ShapeAnimation[] | undefined;
  for (const el of elements) {
    if (!inAnimationSet('shape', el)) continue;
    const own = shapeAnimationsFor(el);
    shared = shared ? shared.filter((v) => own.includes(v)) : own;
  }
  return shared ?? [];
}

/**
 * One Animation row whose flyout holds a section per category (Shape, Text, ...). With a single
 * category there is nothing to choose between, so its section shows inline, titled Animation.
 */
export function AnimationSections({
  elements,
  keyPrefix,
  sectionProps,
  flyoutProps,
  handlers: h,
}: {
  elements: readonly Element[];
  // '' for the single-element menu, 'm-' for the multi-select menu: keeps their open sections apart.
  keyPrefix: '' | 'm-';
  sectionProps: (id: string) => SectionProps;
  flyoutProps: (id: string) => SectionProps;
  handlers: Handlers;
}) {
  // A Sankey's animation is offered only where its edits are (h.sankey: an Editor, one diagram selected).
  const categories = animationCategoriesOf(elements).filter((c) => c !== 'sankey' || !!h.sankey);
  if (categories.length === 0) return null;
  const sections = categories.map((c) => (
    <MenuAccordionSection
      key={c}
      title={categories.length === 1 ? 'Animation' : nameOf(c)}
      icon={<AnimationMenuGlyph />}
      // The arrow keeps its old section key so a remembered open state carries over.
      {...sectionProps(c === 'arrow' ? `${keyPrefix}flow` : `${keyPrefix}animation-${c}`)}
    >
      <CategoryBody category={c} elements={elements} h={h} />
    </MenuAccordionSection>
  ));
  if (sections.length === 1) return sections[0]!;
  return (
    <MenuFlyoutSection
      title="Animation"
      icon={<AnimationMenuGlyph />}
      {...flyoutProps(`${keyPrefix}animation`)}
    >
      {sections}
    </MenuFlyoutSection>
  );
}

function CategoryBody({
  category,
  elements,
  h,
}: {
  category: Category;
  elements: readonly Element[];
  h: Handlers;
}) {
  if (category === 'icon') {
    const icon = elements.find(
      (el): el is ShapeElement => el.type === 'shape' && el.shape === 'icon',
    )!;
    return (
      <IconAnimationTiles
        animation={icon.iconAnimation ?? null}
        speed={icon.iconAnimationSpeed ?? DEFAULT_ANIMATION_SPEED}
        repeat={icon.iconAnimationRepeat ?? true}
        onSet={h.onSetIconAnimation}
        onSetSpeed={h.onSetIconAnimationSpeed}
        onSetRepeat={h.onSetIconAnimationRepeat}
        onPreview={h.onPreviewIconAnimation}
        onPreviewEnd={h.onAnimationPreviewEnd}
      />
    );
  }
  if (category === 'chart') {
    const chart = elements.find(
      (el): el is ShapeElement => el.type === 'shape' && isChartShape(el.shape),
    )!;
    return (
      <PieAnimTiles
        anim={chart.pieAnim ?? null}
        speed={chart.pieAnimSpeed ?? DEFAULT_ANIMATION_SPEED}
        repeat={animLoops(chart.pieAnim, chart.pieAnimRepeat, PIE_LOOPING_ANIMS)}
        onSet={h.onSetPieAnim}
        onSetSpeed={h.onSetPieAnimSpeed}
        onSetRepeat={h.onSetPieAnimRepeat}
      />
    );
  }
  if (category === 'sankey') {
    const sankey = elements.find(
      (el): el is ShapeElement => el.type === 'shape' && isSankeyShape(el.shape),
    );
    if (!sankey || !h.sankey) return null;
    const set = h.sankey.onSetOption;
    return (
      <SankeyAnimTiles
        anim={sankey.sankeyAnim ?? null}
        speed={sankey.sankeyAnimSpeed ?? DEFAULT_ANIMATION_SPEED}
        repeat={animLoops(sankey.sankeyAnim, sankey.sankeyAnimRepeat, SANKEY_LOOPING_ANIMS)}
        onSet={(v) => set({ sankeyAnim: v ?? undefined })}
        onSetSpeed={(v) => set({ sankeyAnimSpeed: v })}
        onSetRepeat={(v) => set({ sankeyAnimRepeat: v })}
      />
    );
  }
  if (category === 'progress' || category === 'rating') {
    const el = elements.find((e): e is ShapeElement => ownCategoryOf(e) === category)!;
    return category === 'progress' ? (
      <ProgressAnimTiles
        anim={el.progressAnim ?? null}
        speed={el.progressAnimSpeed ?? DEFAULT_ANIMATION_SPEED}
        repeat={animLoops(el.progressAnim, el.progressAnimRepeat, PROGRESS_LOOPING_ANIMS)}
        onSet={h.onSetProgressAnim}
        onSetSpeed={h.onSetProgressAnimSpeed}
        onSetRepeat={h.onSetProgressAnimRepeat}
      />
    ) : (
      <RatingAnimTiles
        anim={el.ratingAnim ?? null}
        speed={el.ratingAnimSpeed ?? DEFAULT_ANIMATION_SPEED}
        repeat={animLoops(el.ratingAnim, el.ratingAnimRepeat, RATING_LOOPING_ANIMS)}
        onSet={h.onSetRatingAnim}
        onSetSpeed={h.onSetRatingAnimSpeed}
        onSetRepeat={h.onSetRatingAnimRepeat}
      />
    );
  }
  if (category === 'concept') {
    const el = elements.find(
      (e): e is ShapeElement & { shape: ConceptShape } => ownCategoryOf(e) === 'concept',
    )!;
    return <ConceptAnimTiles target={el} ops={h.elementStyle} />;
  }
  if (category === 'arrow') {
    const arrow = elements.find((el) => el.type === 'arrow');
    if (arrow?.type !== 'arrow') return null;
    return (
      <FlowTiles
        flow={arrow.flow ?? null}
        speed={arrow.flowSpeed ?? DEFAULT_ANIMATION_SPEED}
        repeat={arrow.flowRepeat ?? true}
        onSet={h.onSetArrowFlow}
        onSetSpeed={h.onSetFlowSpeed}
        onSetRepeat={h.onSetFlowRepeat}
        onPreview={h.onPreviewArrowFlow}
        onPreviewEnd={h.onAnimationPreviewEnd}
      />
    );
  }
  const set = category;
  const state = setAnimationState(elements, set);
  if (!state) return null;
  return (
    <AnimationSetTiles
      set={set}
      // Shape offers what every member takes: a photo or a note only the motions (element-animations.md "Shape motions").
      values={set === 'shape' ? sharedShapeAnimations(elements) : undefined}
      current={state.value}
      legacy={state.legacy}
      speed={state.speed ?? DEFAULT_ANIMATION_SPEED}
      repeat={state.repeat}
      onSet={(v) => h.onSetSetAnimation(set, v)}
      onSetSpeed={(v) => h.onSetSetAnimationSpeed(set, v)}
      onSetRepeat={(v) => h.onSetSetAnimationRepeat(set, v)}
      onPreview={(v) => h.onPreviewSetAnimation(set, v)}
      onPreviewEnd={h.onAnimationPreviewEnd}
    />
  );
}
