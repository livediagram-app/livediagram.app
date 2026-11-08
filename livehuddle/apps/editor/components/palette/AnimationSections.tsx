// Every animation category for a selection (docs/specs/028-animation/element-animations.md "The
// menu"): one per set present, titled by its set, in a fixed order, each acting only on its own
// members. The single-element menu passes one element; the multi-select menu passes the whole
// selection, so the two menus cannot drift.

import {
  ANIMATION_SET_NAME,
  DEFAULT_ANIMATION_SPEED,
  animationSetsOf,
  type AnimationSetId,
  type Element,
  type ShapeAnimation,
  type ShapeElement,
  inAnimationSet,
  shapeAnimationsFor,
} from '@livehuddle/document';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { MenuFlyoutSection } from '@liveworkspace/workbench/components/primitives/MenuFlyoutSection';
import { AnimationMenuGlyph } from '@/components/palette/context-menu-icons';
import { FlowTiles, IconAnimationTiles } from '@/components/palette/context-menu-tiles';
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
  | 'onSetArrowFlow'
  | 'onSetFlowSpeed'
  | 'onSetFlowRepeat'
  | 'onPreviewArrowFlow'
  | 'elementStyle'
>;

type SectionProps = { open: boolean; onToggle: () => void; flush?: boolean };

// The categories in menu order. Body sets come before the words they carry; arrows come last.
type OwnCategory = 'icon' | 'arrow';
type Category = AnimationSetId | OwnCategory;
const ORDER: readonly Category[] = ['shape', 'sticky', 'drawing', 'media', 'icon', 'text', 'arrow'];
const OWN_NAME: Record<OwnCategory, string> = {
  icon: 'Icon',
  arrow: 'Arrow',
};

// The element-owned category a shape takes, if any (each read and written by its own tiles below).
function ownCategoryOf(el: Element): OwnCategory | undefined {
  if (el.type === 'arrow') return 'arrow';
  if (el.type !== 'shape') return undefined;
  if (el.shape === 'icon') return 'icon';
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
      // Shape offers what every member takes: a boundary only the motions that leave it in place
      // (docs/specs/009-elements/boundary.md), a photo or a note only the motions (element-animations.md "Shape motions").
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
