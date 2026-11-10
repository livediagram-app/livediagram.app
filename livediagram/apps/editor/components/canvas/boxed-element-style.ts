import type { describeVariant } from '@/components/canvas/element-variant';
import type { useBoxedElementAnimation } from '@/components/canvas/useBoxedElementAnimation';
import type { BoxedElement } from '@livediagram/document';
import type { BoxedElementViewProps } from './BoxedElementView.types';

// How far a non-votable element recedes during a layer-scoped vote.
// Enough to push it back clearly, not so far it stops being legible
// context for the elements you ARE voting on.
const VOTE_DIMMED_OPACITY = 0.35;

// The wrapper's inline style (BoxedElementView): where the box sits and how big, its colour, font and
// opacity, its variant and animation, its turn, and how it stacks and takes pointers.
export function boxedElementStyle({
  isoDepth,
  element,
  width,
  height,
  textColor,
  fontFamily,
  layerOpacity,
  voteDimmed,
  variant,
  animStyle,
  isRotated,
  insertShift,
  rotation,
  editLook,
  passThrough,
}: {
  isoDepth: BoxedElementViewProps['isoDepth'];
  element: BoxedElement;
  width: number;
  height: number;
  textColor: string;
  fontFamily: BoxedElementViewProps['fontFamily'];
  layerOpacity: BoxedElementViewProps['layerOpacity'];
  voteDimmed: boolean;
  variant: ReturnType<typeof describeVariant>;
  animStyle: ReturnType<typeof useBoxedElementAnimation>['animStyle'];
  isRotated: boolean;
  insertShift: string;
  rotation: number;
  editLook: { raise: boolean };
  passThrough: boolean;
}): React.CSSProperties {
  return {
    // Isometric depth stagger (docs/specs/008-canvas/isometric-view.md): see globals.css [data-iso].
    ...({ '--iso-z': isoDepth } as React.CSSProperties),
    left: element.x,
    top: element.y,
    width,
    height,
    color: textColor,
    // Every word on the element in its face, so a face that writes its own (a progress value, a panel's
    // rows, a button) wears the tab's font and finish like its label does (docs/specs/008-canvas/finish.md).
    // Unset when nothing picks one, so the editor default still applies.
    ...(fontFamily ? { fontFamily } : {}),
    // Layer-scoped vote (docs/specs/012-collaboration/vote-layer-scope.md): elements off the votable layer stay
    // VISIBLE (you still need the canvas's context to judge what
    // you're voting on) but drop back so the votable set reads as the
    // foreground. Only while casting is open; once the vote ends the
    // canvas returns to normal for the results walkthrough.
    opacity: (element.opacity ?? 1) * (layerOpacity ?? 1) * (voteDimmed ? VOTE_DIMMED_OPACITY : 1),
    ...variant.style,
    ...animStyle,
    // Spin about the centre (the wrapper already has origin-center).
    // The handles' frame in the grips layer turns by the same angle.
    //
    // The angle is ALSO published as --lvd-enter-rot, which the pop-in
    // entry keyframe multiplies into its scale. A keyframe that touches
    // `transform` replaces this inline value while it runs, so without
    // that variable a tilted element (any rotated shape, and every
    // sticker) popped in flat and then snapped to its angle at the end.
    ...(isRotated
      ? ({
          transform: `${insertShift}rotate(${rotation}deg)`,
          '--lvd-enter-rot': `${rotation}deg`,
        } as React.CSSProperties)
      : insertShift
        ? { transform: insertShift.trim() }
        : {}),
    // Deliberately do NOT raise z-index on plain selection. Keeping
    // the element at its natural paint order means selecting a
    // container doesn't jump it above the content layered on top of
    // it: users resize containers against their visible content.
    // While EDITING the label, though, raise it so the text the user
    // is typing isn't hidden behind elements painted above it. (The
    // selection handles live in the grips layer, SelectionChromeLayer.)
    ...(editLook.raise ? { zIndex: 10 } : {}),
    // Only the drawn line picks an element not yet selected (its hit
    // line, in FreehandSvg / ShapeHitOutline); the rest of its box lets pointers through.
    ...(passThrough ? { pointerEvents: 'none' as const } : {}),
  };
}
