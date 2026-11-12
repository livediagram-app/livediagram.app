import type { describeVariant, editingLook } from '@/components/canvas/element-variant';
import type { useBoxedElementAnimation } from '@/components/canvas/useBoxedElementAnimation';
import type { BoxedElementViewProps } from './BoxedElementView.types';

// The wrapper's inline style (BoxedElementView): where the box sits and how big, its colour, font and
// opacity, its variant and animation, its turn, and how it stacks and takes pointers.
export function boxedElementStyle({
  element,
  width,
  height,
  textColor,
  fontFamily,
  layerOpacity,
  variant,
  animStyle,
  isRotated,
  rotation,
  editLook,
  passThrough,
}: {
  element: BoxedElementViewProps['element'];
  width: number;
  height: number;
  textColor: string;
  fontFamily: BoxedElementViewProps['fontFamily'];
  layerOpacity: BoxedElementViewProps['layerOpacity'];
  variant: ReturnType<typeof describeVariant>;
  animStyle: ReturnType<typeof useBoxedElementAnimation>['animStyle'];
  isRotated: boolean;
  rotation: number;
  editLook: ReturnType<typeof editingLook>;
  passThrough: boolean;
}): React.CSSProperties {
  return {
    left: element.x,
    top: element.y,
    width,
    height,
    color: textColor,
    // Every word on the element in its face, so a face that writes its own (a progress value, a panel's
    // rows, a button) wears the tab's font and finish like its label does (docs/specs/008-canvas/finish.md).
    // Unset when nothing picks one, so the editor default still applies.
    ...(fontFamily ? { fontFamily } : {}),
    opacity: (element.opacity ?? 1) * (layerOpacity ?? 1),
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
          transform: `rotate(${rotation}deg)`,
          '--lvd-enter-rot': `${rotation}deg`,
        } as React.CSSProperties)
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
    // line, in FreehandSvg); the rest of its box lets pointers through.
    ...(passThrough ? { pointerEvents: 'none' as const } : {}),
  };
}
