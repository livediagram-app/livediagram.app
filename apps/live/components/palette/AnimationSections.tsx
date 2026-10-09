// Every animation category for a selection (docs/specs/028-animation/element-animations.md "The
// menu"): one per set present, titled by its set, in a fixed order, each acting only on its own
// members. The single-element menu passes one element; the multi-select menu passes the whole
// selection, so the two menus cannot drift.

import {
  ANIMATION_SET_NAME,
  DEFAULT_ANIMATION_SPEED,
  PIE_LOOPING_ANIMS,
  animLoops,
  animationSetsOf,
  isChartShape,
  type AnimationSetId,
  type Element,
  type ShapeElement,
} from '@livediagram/document';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import { AnimationMenuGlyph } from '@/components/palette/context-menu-icons';
import { FlowTiles, IconAnimationTiles } from '@/components/palette/context-menu-tiles';
import { PieAnimTiles } from '@/components/palette/context-menu-rows';
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
>;

type SectionProps = { open: boolean; onToggle: () => void; flush?: boolean };

// The categories in menu order. Body sets come before the words they carry; arrows come last.
type Category = AnimationSetId | 'icon' | 'chart' | 'arrow';
const ORDER: readonly Category[] = [
  'shape',
  'sticky',
  'drawing',
  'media',
  'table',
  'icon',
  'chart',
  'text',
  'arrow',
];
const OWN_NAME: Record<'icon' | 'chart' | 'arrow', string> = {
  icon: 'Icon',
  chart: 'Chart',
  arrow: 'Arrow',
};

const nameOf = (c: Category) =>
  c in OWN_NAME ? OWN_NAME[c as keyof typeof OWN_NAME] : ANIMATION_SET_NAME[c as AnimationSetId];

/** The categories a selection shows, in order. */
export function animationCategoriesOf(elements: readonly Element[]): Category[] {
  const present = new Set<Category>(animationSetsOf(elements));
  for (const el of elements) {
    if (el.type === 'arrow') present.add('arrow');
    if (el.type === 'shape' && el.shape === 'icon') present.add('icon');
    if (el.type === 'shape' && isChartShape(el.shape)) present.add('chart');
  }
  return ORDER.filter((c) => present.has(c));
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
  const categories = animationCategoriesOf(elements);
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
      current={state.value}
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
