// How a boxed element meets the pointer (BoxedElementView): the cursor it wears, whether its body lets presses
// through, and whether it is picked by its drawn line or outline rather than its box.
import type { BoxedElement } from '@livediagram/document';
import { editingLook } from '@/components/canvas/element-variant';
import { outlineHit } from '@/components/canvas/ShapeHitOutline';

export function boxedPointer({
  element,
  isEditing,
  isSelected,
  isMultiSelected,
  remotelyLocked,
  isPaintMode,
  isLocked,
  movable,
  onWhiteboard,
}: {
  element: BoxedElement;
  isEditing: boolean;
  isSelected: boolean;
  isMultiSelected: boolean;
  remotelyLocked: boolean;
  isPaintMode: boolean | undefined;
  isLocked: boolean | undefined;
  movable: boolean;
  onWhiteboard: boolean;
}) {
  // A label being typed wears the text cursor and rises; a path in its edit mode does neither.
  const editLook = editingLook(element, isEditing);
  const cursor = remotelyLocked
    ? 'cursor-not-allowed'
    : isPaintMode
      ? 'cursor-copy'
      : editLook.textCursor
        ? 'cursor-text'
        : isLocked || !movable
          ? 'cursor-default'
          : 'cursor-move';
  // A Quiz (docs/specs/012-collaboration/quiz.md) is a disc in a square box:
  // the box itself takes no presses, so the empty corners and the gaps between
  // its answers behave as bare canvas. The face re-enables the disc, which is
  // the one place that selects and drags it.
  const bodyPassesThrough = element.type === 'shape' && element.shape === 'quiz';
  // A whiteboard pen stroke and a path are picked by their drawn line, not their box
  // (docs/specs/023-draw-mode/draw-mode.md "Selecting", path-tool.md "Selecting and erasing");
  // once selected, the box drags either as any element, and the line still catches pointers
  // outside the box, so a press on its outer half never falls to the board.
  const selected = isSelected || isMultiSelected;
  const hitLine =
    (element.type === 'freehand' &&
      element.penWidth !== undefined &&
      element.pen !== 'highlighter') ||
    (element.type === 'path' && !isEditing);
  // A whiteboard shape likewise, by its drawn outline (ShapeHitOutline).
  const shapeHit = outlineHit(element, { onWhiteboard, selected });
  // Not yet selected, only the drawn line picks it: the rest of its box lets pointers through.
  const passThrough = (hitLine && !selected) || shapeHit === 'outline';
  return { editLook, cursor, bodyPassesThrough, hitLine, shapeHit, passThrough };
}
