// Format-painter field projections. Given a source element, return
// the subset of fields that should be copied onto a target of the
// same kind. Pure functions split out from `applyFormatFromSource`
// in editor-page.tsx so each list is the single source of truth for
// "what does the format painter actually paint?" and the boxed /
// arrow projections are testable in isolation.
//
// Why explicit per-field listing instead of "spread the source":
// some fields (id, type, shape, label, link, commentThread,
// locked, position x / y) are identity or content and must NOT be
// copied. A spread that omitted those would still drag along future
// fields silently. Listing each painted field by name makes a future
// addition to BoxedElement / ArrowElement an active, deliberate
// choice ("does this belong on the painter?") instead of a passive,
// silent one ("the painter just started copying my new field too").
//
// A projection key whose value is `undefined` is deliberate: it means
// "the source is on the default here", and `applyPaint` clears the
// target's override so the target ends up looking like the source
// (spec/09). A key that is ABSENT means the source's kind doesn't carry
// the field at all, so it has no opinion and the target keeps its own.

import {
  hasRichFormatting,
  normalizeRuns,
  type AnimationSpeed,
  type ArrowElement,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type BoxedElement,
  type ElementShadow,
  type IconAnimation,
  type IconSize,
  type RunBoolKey,
  type TextRun,
} from '@livediagram/diagram';

type BoxedKind = BoxedElement['type'];

// The boxed kinds that carry each optional family of look fields. The
// element types declare some of these on every variant for union
// ergonomics (an image "has" a textColor it never draws), so the
// painter reads what each kind actually renders rather than what it
// merely declares.
const BORDER_KINDS: ReadonlySet<BoxedKind> = new Set(['shape', 'table', 'freehand']);
const RADIUS_KINDS: ReadonlySet<BoxedKind> = new Set(['shape', 'freehand']);
const SHADOW_KINDS: ReadonlySet<BoxedKind> = new Set([
  'shape',
  'sticky',
  'image',
  'link-card',
  'video',
]);

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

// Boxed (shape / text / sticky / ...) painter projection. Carries every
// formatting field the source's kind renders: size + aspect lock +
// opacity + colours + every text-styling switch + padding, plus the
// border / shadow / icon families where the kind has them. Position and
// identity stay on the target.
export function paintableBoxedFields(source: BoxedElement): Partial<BoxedElement> {
  const kind = source.type;
  // Fields every boxed kind shares, images included.
  const base: Partial<BoxedElement> = {
    width: source.width,
    height: source.height,
    aspectLocked: source.aspectLocked,
    opacity: source.opacity,
    // Looping animation (spec/09) is a cosmetic field, so paint it like the rest.
    animation: source.animation,
    animationSpeed: source.animationSpeed,
    animationRepeat: source.animationRepeat,
  };
  // Drop shadow (spec/86): cosmetic, painted alongside where the kind draws one.
  if (SHADOW_KINDS.has(kind)) {
    (base as { shadow?: ElementShadow }).shadow = (source as { shadow?: ElementShadow }).shadow;
  }
  // ImageElement is a boxed element (move / resize / lock) but
  // renders no colour / text / padding, so its projection stops at the
  // fields above.
  if (kind === 'image') return base;

  // Read the variant-specific fields through a loose view so the
  // projection compiles across the union; each is only emitted for the
  // kinds that carry it (see the sets above).
  const ext = source as {
    strokeWidth?: BorderStroke;
    strokeStyle?: BorderStyle;
    borderRadius?: BorderRadius;
    colorPreset?: string;
    themeLockFill?: boolean;
    headerFill?: string;
    headerTextColor?: string;
    font?: string;
    richText?: TextRun[];
    iconAnimation?: IconAnimation;
    iconAnimationSpeed?: AnimationSpeed;
    iconAnimationRepeat?: boolean;
    iconSize?: IconSize;
  };
  // Effective whole-label formatting: a uniform richText run wins over
  // the (often unset) element-level flag, otherwise the element field.
  const rt = ext.richText;
  const out: Record<string, unknown> = {
    ...base,
    fillColor: source.fillColor,
    strokeColor: source.strokeColor,
    // A table's header row / a lane's title gutter (spec/09, spec/119).
    headerFill: ext.headerFill,
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
  };
  // Border presets. Carried so painting a styled border onto another
  // shape actually copies the border, not just the stroke colour.
  if (BORDER_KINDS.has(kind)) {
    out.strokeWidth = ext.strokeWidth;
    out.strokeStyle = ext.strokeStyle;
  }
  if (RADIUS_KINDS.has(kind)) out.borderRadius = ext.borderRadius;
  if (kind === 'table') out.headerTextColor = ext.headerTextColor;
  if (kind === 'shape') {
    // Colour-preset binding (spec/48) + the fill's theme lock: carried
    // alongside the colours so a painted shape tracks the theme exactly
    // like the source did. applyPaint decides whether the binding holds.
    out.colorPreset = ext.colorPreset;
    out.themeLockFill = ext.themeLockFill;
    // Per-icon glyph animation + speed and the Technology mark's fixed
    // size preset (spec/09 / spec/41).
    out.iconAnimation = ext.iconAnimation;
    out.iconAnimationSpeed = ext.iconAnimationSpeed;
    out.iconAnimationRepeat = ext.iconAnimationRepeat;
    out.iconSize = ext.iconSize;
  }
  return out as Partial<BoxedElement>;
}

// Arrow painter projection. Arrows carry stroke + opacity + arrowhead
// shape + line-pattern preset, plus label text styling (arrow labels
// store formatting element-level only — commitLabel drops richText for
// arrows — so the flags below capture the whole label look).
export function paintableArrowFields(source: ArrowElement): Partial<ArrowElement> {
  return {
    strokeColor: source.strokeColor,
    strokeWidth: source.strokeWidth,
    strokeStyle: source.strokeStyle,
    opacity: source.opacity,
    arrowEnds: source.arrowEnds,
    // Arrowhead + path-shape presets, so painting copies the whole look
    // (a curved dashed UML connector), not just colour + ends.
    arrowheadColor: source.arrowheadColor,
    arrowheadSize: source.arrowheadSize,
    arrowheadShape: source.arrowheadShape,
    arrowStyle: source.arrowStyle,
    // Route behind boxes (spec/90): a look choice like the rest. Absent
    // means on, so a default source turns it back on for the target.
    routeBehind: source.routeBehind,
    // Flow animation (spec/09): marching dashes / travelling dot.
    flow: source.flow,
    flowSpeed: source.flowSpeed,
    flowRepeat: source.flowRepeat,
    // Label text styling (spec/09). Arrows don't carry alignment /
    // padding (the label rides the line), but do carry the same text
    // switches + size + colour + font as boxed labels, and the
    // caption plate behind the label.
    textColor: source.textColor,
    textSize: source.textSize,
    textBold: source.textBold,
    textItalic: source.textItalic,
    textUnderline: source.textUnderline,
    textStrikethrough: source.textStrikethrough,
    labelFill: source.labelFill,
    font: source.font,
  };
}

// Element-level text field -> the run attribute that overrides it per
// character. Painting the field has to drop the attribute from the
// target's runs, or the runs keep winning and the paint looks like it
// did nothing.
const RUN_OVERRIDES: readonly (readonly [string, RunBoolKey | 'color' | 'size'])[] = [
  ['textBold', 'bold'],
  ['textItalic', 'italic'],
  ['textUnderline', 'underline'],
  ['textStrikethrough', 'strikethrough'],
  ['textColor', 'color'],
  ['textSize', 'size'],
];

const PRESET_COLOURS = ['fillColor', 'strokeColor', 'textColor'] as const;

// Lay a (filtered) projection onto the target. Defined values are set,
// `undefined` values clear the target's override (see the header), and
// the two derived fields are kept honest: the target's per-range runs
// yield to painted text, and the colour-preset binding only survives
// when it still describes the colours on the element (spec/09).
export function applyPaint<T extends BoxedElement | ArrowElement>(
  target: T,
  patch: Partial<BoxedElement> | Partial<ArrowElement>,
): T {
  const next: Record<string, unknown> = { ...target };
  const painted = patch as Record<string, unknown>;
  for (const [field, value] of Object.entries(painted)) {
    if (value === undefined) delete next[field];
    else next[field] = value;
  }

  // The binding re-derives all three colours on a theme change, so it is
  // only copied when all three travelled together. A partial colour paint
  // is a hand edit, which clears it like any other (lib/style-presets.ts).
  const colours = PRESET_COLOURS.filter((field) => field in painted).length;
  if (colours === PRESET_COLOURS.length && painted.colorPreset !== undefined) {
    next.colorPreset = painted.colorPreset;
  } else if (colours > 0) {
    delete next.colorPreset;
  }

  const runs = next.richText as TextRun[] | undefined;
  if (runs) {
    const drop = RUN_OVERRIDES.filter(([field]) => field in painted).map(([, attr]) => attr);
    if (drop.length > 0) {
      const stripped = normalizeRuns(
        runs.map((run) => {
          const copy = { ...run };
          for (const attr of drop) delete copy[attr];
          return copy;
        }),
      );
      if (hasRichFormatting(stripped)) next.richText = stripped;
      else delete next.richText;
    }
  }
  return next as T;
}
