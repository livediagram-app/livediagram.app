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

import type {
  AnimationSpeed,
  ArrowElement,
  BorderRadius,
  BorderStroke,
  BorderStyle,
  BoxedElement,
  IconAnimation,
  IconSize,
  TextRun,
} from '@livediagram/diagram';

// Strip undefined keys so a `{ ...target, ...projection }` spread
// never overwrites a defined value on the target with `undefined`.
// Object.entries returns string keys, so the explicit cast keeps
// the function-level signature precise without bothering callers
// with the entries-typing dance.
function stripUndefined<T extends object>(o: Partial<T>): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// The inline editor stores "select all + bold" as a single attributed
// `richText` run, not the element-level `textBold` flag (see
// hasRichFormatting / commitLabel) — so a label that LOOKS uniformly
// bold carries its formatting in the runs, leaving the element-level
// text fields unset. The painter copies element-level fields, so
// without this it would silently drop that formatting. We collapse the
// runs: an attribute every run agrees on becomes the painted
// whole-label value; a partially-styled label (runs disagree) has no
// single value to paint, so that attribute falls back to the
// element-level field. richText itself is NOT painted — its runs are
// bound to the source's characters, not the target's.
function uniformRunValue<K extends keyof TextRun>(
  runs: TextRun[] | undefined,
  key: K,
): TextRun[K] | undefined {
  if (!runs || runs.length === 0) return undefined;
  const first = runs[0]?.[key];
  if (first === undefined) return undefined;
  return runs.every((r) => r[key] === first) ? first : undefined;
}

// Boxed (shape / text / sticky) painter projection. Carries every
// formatting field: size + aspect lock + opacity + colours + every
// text-styling switch + padding. Position and identity stay on the
// target.
export function paintableBoxedFields(source: BoxedElement): Partial<BoxedElement> {
  // ImageElement is a boxed element (move / resize / lock / group)
  // but carries no colour / text / padding fields, so the painter
  // projection is just the size + aspect lock + opacity it shares
  // with the others. Early-return keeps the field list explicit per
  // variant instead of leaking ImageElement's narrower shape into
  // the shape / text / sticky branch's typings.
  if (source.type === 'image') {
    return stripUndefined<BoxedElement>({
      width: source.width,
      height: source.height,
      aspectLocked: source.aspectLocked,
      opacity: source.opacity,
    });
  }
  // Border + font live only on some boxed variants (shape / table carry
  // the border presets; shape / text / sticky / table carry `font`).
  // Read them through a loose view so the projection compiles across the
  // union; stripUndefined drops any the source doesn't actually have, and
  // a target that lacks the field harmlessly ignores the stray key.
  const ext = source as {
    strokeWidth?: BorderStroke;
    strokeStyle?: BorderStyle;
    borderRadius?: BorderRadius;
    colorPreset?: string;
    font?: string;
    richText?: TextRun[];
  };
  // Effective whole-label formatting: a uniform richText run wins over
  // the (often unset) element-level flag, otherwise the element field.
  const rt = ext.richText;
  return stripUndefined<BoxedElement>({
    width: source.width,
    height: source.height,
    aspectLocked: source.aspectLocked,
    opacity: source.opacity,
    fillColor: source.fillColor,
    strokeColor: source.strokeColor,
    // Colour-preset binding (spec/48): carried alongside the colours so a
    // painted shape tracks the theme exactly like the source did. A target
    // that isn't a shape harmlessly ignores the stray key.
    colorPreset: ext.colorPreset,
    textColor: uniformRunValue(rt, 'color') ?? source.textColor,
    textSize: uniformRunValue(rt, 'size') ?? source.textSize,
    textAlignX: source.textAlignX,
    textAlignY: source.textAlignY,
    textBold: uniformRunValue(rt, 'bold') ?? source.textBold,
    textItalic: uniformRunValue(rt, 'italic') ?? source.textItalic,
    textUnderline: uniformRunValue(rt, 'underline') ?? source.textUnderline,
    textStrikethrough: uniformRunValue(rt, 'strikethrough') ?? source.textStrikethrough,
    font: ext.font,
    padding: source.padding,
    // Border presets (shape / table). Carried so painting a styled
    // border onto another shape actually copies the border, not just
    // the fill / stroke colour.
    strokeWidth: ext.strokeWidth,
    strokeStyle: ext.strokeStyle,
    borderRadius: ext.borderRadius,
    // Looping animation (spec/09) is a cosmetic field, so paint it like the rest.
    animation: source.animation,
    animationSpeed: source.animationSpeed,
    animationRepeat: source.animationRepeat,
    // Per-icon glyph animation + speed and the Technology mark's fixed
    // size preset (spec/09 / spec/41); cosmetic, painted alongside. Only
    // ShapeElement carries them, so read them off a structural view.
    iconAnimation: (source as { iconAnimation?: IconAnimation }).iconAnimation,
    iconAnimationSpeed: (source as { iconAnimationSpeed?: AnimationSpeed }).iconAnimationSpeed,
    iconAnimationRepeat: (source as { iconAnimationRepeat?: boolean }).iconAnimationRepeat,
    iconSize: (source as { iconSize?: IconSize }).iconSize,
  });
}

// Arrow painter projection. Arrows carry stroke + opacity + arrowhead
// shape + line-pattern preset, plus label text styling (arrow labels
// store formatting element-level only — commitLabel drops richText for
// arrows — so the flags below capture the whole label look).
export function paintableArrowFields(source: ArrowElement): Partial<ArrowElement> {
  return stripUndefined<ArrowElement>({
    strokeColor: source.strokeColor,
    strokeWidth: source.strokeWidth,
    strokeStyle: source.strokeStyle,
    opacity: source.opacity,
    arrowEnds: source.arrowEnds,
    // Arrowhead + path-shape presets, so painting copies the whole look
    // (a curved dashed UML connector), not just colour + ends.
    arrowheadSize: source.arrowheadSize,
    arrowheadShape: source.arrowheadShape,
    arrowStyle: source.arrowStyle,
    // Flow animation (spec/09): marching dashes / travelling dot.
    flow: source.flow,
    flowSpeed: source.flowSpeed,
    flowRepeat: source.flowRepeat,
    // Label text styling (spec/09). Arrows don't carry alignment /
    // padding (the label rides the line), but do carry the same text
    // switches + size + colour + font as boxed labels.
    textColor: source.textColor,
    textSize: source.textSize,
    textBold: source.textBold,
    textItalic: source.textItalic,
    textUnderline: source.textUnderline,
    textStrikethrough: source.textStrikethrough,
    font: source.font,
  });
}
