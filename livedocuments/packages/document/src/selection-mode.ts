// Fixed-size elements.

// Shape kinds that are a FIXED SIZE: not a box you draw. They get no resize
// handles, ignore a drag-to-draw's size, and are left alone when a
// multi-selection is scaled.
const FIXED_SIZE_SHAPES: ReadonlySet<string> = new Set([
  // A badge fits its text (docs/specs/009-elements/badge.md): it is never resized by hand.
  'badge',
]);

export function isFixedSizeShape(kind: string): boolean {
  return FIXED_SIZE_SHAPES.has(kind);
}

// The element-level answer to "can this be resized?" — true for the
// fixed-size shape KINDS above, and for any element stamped `fixedSize` at
// creation. Structural param so leaf callers don't need the full
// Element union.
export function isFixedSizeElement(el: {
  type: string;
  shape?: string;
  fixedSize?: boolean;
}): boolean {
  if (el.fixedSize === true) return true;
  return el.type === 'shape' && el.shape != null && isFixedSizeShape(el.shape);
}
