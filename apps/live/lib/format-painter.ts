// Format-painter field projections. Given a source element, return
// the subset of fields that should be copied onto a target of the
// same kind. Pure functions split out from `applyFormatFromSource`
// in editor-page.tsx so each list is the single source of truth for
// "what does the format painter actually paint?" and the boxed /
// arrow projections are testable in isolation.
//
// Why explicit per-field listing instead of "spread the source":
// some fields (id, type, shape, label, link, commentThread, groupId,
// locked, position x / y) are identity or content and must NOT be
// copied. A spread that omitted those would still drag along future
// fields silently. Listing each painted field by name makes a future
// addition to BoxedElement / ArrowElement an active, deliberate
// choice ("does this belong on the painter?") instead of a passive,
// silent one ("the painter just started copying my new field too").

import type { ArrowElement, BoxedElement } from '@livediagram/diagram';

// Strip undefined keys so a `{ ...target, ...projection }` spread
// never overwrites a defined value on the target with `undefined`.
// Object.entries returns string keys, so the explicit cast keeps
// the function-level signature precise without bothering callers
// with the entries-typing dance.
function stripUndefined<T extends object>(o: Partial<T>): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// Boxed (shape / text / sticky) painter projection. Carries every
// formatting field: size + aspect lock + opacity + colours + every
// text-styling switch + padding. Position and identity stay on the
// target.
export function paintableBoxedFields(source: BoxedElement): Partial<BoxedElement> {
  return stripUndefined<BoxedElement>({
    width: source.width,
    height: source.height,
    aspectLocked: source.aspectLocked,
    opacity: source.opacity,
    fillColor: source.fillColor,
    strokeColor: source.strokeColor,
    textColor: source.textColor,
    textSize: source.textSize,
    textAlignX: source.textAlignX,
    textAlignY: source.textAlignY,
    textBold: source.textBold,
    textItalic: source.textItalic,
    textUnderline: source.textUnderline,
    textStrikethrough: source.textStrikethrough,
    padding: source.padding,
  });
}

// Arrow painter projection. Arrows don't carry text styling or
// aspect locks, just stroke + opacity + arrowhead shape.
export function paintableArrowFields(source: ArrowElement): Partial<ArrowElement> {
  return stripUndefined<ArrowElement>({
    strokeColor: source.strokeColor,
    strokeWidth: source.strokeWidth,
    opacity: source.opacity,
    arrowEnds: source.arrowEnds,
  });
}
