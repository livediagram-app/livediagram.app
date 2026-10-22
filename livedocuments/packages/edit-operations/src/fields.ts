// Fields onto an element (docs/specs/024-agents/blueprints/edit-operations.md "Fields and values"):
// the spec's aliases (`label note shape fill text line`) or any stored field of the element's type.
// `null` unsets. Identity, live fields and prototype keys are refused. A shape's long label is capped
// into its note once every field is written, so it moves into the note the element ends with.

import type { EditRejection, EditWarning } from '@livedocuments/api-schema';
import {
  BORDER_DASH_ARRAY,
  isTextSize,
  TEXT_PX_MAX,
  TEXT_PX_MIN,
  ELEMENT_FIELD_NAMES,
  ELEMENT_FIELD_VALUES,
  LIVE_ELEMENT_FIELDS,
  coerceShapeKind,
  fieldValueIssue,
  isElementFieldName,
  mergeElementUpdate,
  themeColourFields,
  type Element,
  type ThemeDefinition,
  rederiveColorPresetForTheme,
  shapeColorPresets,
} from '@livedocuments/document';
import { fillValue, isHexColour, resolveColourValue } from './colours';
import { kindOf } from './element-text';
import { applyLabel } from './labels';
import { invalidValue, unknownField } from './rejections';
import type { FieldValue, Fields } from './types';
import { PROTOTYPE_KEYS } from './vocabulary';
import { iconsLike, isIconId } from '@livedocuments/icons/search';

// The spec's names, then the style keys the views print (`STYLE_KEYS`), so a printed `key=value` writes back
// unchanged; `font` is a stored field name already.
const FIELD_ALIASES = [
  'label',
  'note',
  'shape',
  'fill',
  'stroke',
  'text-color',
  'border',
  'text',
  'line',
] as const;
type Alias = (typeof FIELD_ALIASES)[number];

export const TEXT_SIZES = ['sm', 'md', 'lg', 'scale'] as const;
/** What the `text` alias takes, as the format line and a rejection spell it. */
const TEXT_SIZE_VALUES = `${TEXT_SIZES.join(' ')} or a px from ${TEXT_PX_MIN} to ${TEXT_PX_MAX}`;
export const ARROW_STYLES = ['straight', 'angled', 'curved'] as const;
export const BORDER_STYLES = Object.keys(BORDER_DASH_ARRAY);
const LIVE_FIELDS: ReadonlySet<string> = new Set(LIVE_ELEMENT_FIELDS);
const IDENTITY_FIELDS: ReadonlySet<string> = new Set(['id', 'type']);
const RAW_COLOURS: ReadonlySet<string> = new Set(['fillColor', 'strokeColor', 'textColor']);
// A stroke's former point fields, which normalising packs (docs/specs/006-document/stroke-points.md).
const FORMER_FIELDS: Readonly<Partial<Record<Element['type'], readonly string[]>>> = {
  freehand: ['points', 'pressures'],
};
const LIVE_HINT = "comments go through the comment commands; responses and ideas are people's";

const hasField = (el: Element, field: string) => isElementFieldName(el.type, field);

// The aliases an element takes.
export function aliasesOf(el: Element): Alias[] {
  return FIELD_ALIASES.filter((alias) => {
    switch (alias) {
      case 'label':
      case 'note':
        return hasField(el, alias);
      case 'shape':
        return el.type === 'shape';
      case 'fill':
        return el.type === 'sticky' || themeColourFields(el).some((f) => f.element === 'fillColor');
      case 'stroke':
        return hasField(el, 'strokeColor');
      case 'text-color':
        return hasField(el, 'textColor');
      case 'border':
        return hasField(el, 'strokeStyle');
      case 'text':
        return hasField(el, 'textSize');
      case 'line':
        return el.type === 'arrow';
    }
  });
}

// The stored fields an alias writes under another name, so a ~ line prints the change under the name
// the agent used.
export const ALIAS_FIELDS: Readonly<Record<string, readonly string[]>> = {
  fill: ['fillColor', 'fillSwatch'],
  stroke: ['strokeColor', 'strokeSwatch'],
  'text-color': ['textColor'],
  border: ['strokeStyle'],
  text: ['textSize'],
  line: ['arrowStyle'],
};

// What an element holds under a field name, an alias read as it is written.
export function fieldValue(el: Element, key: string, theme: ThemeDefinition): unknown {
  if (key === 'fill') return fillValue(el, theme);
  const stored = ALIAS_FIELDS[key];
  return Reflect.get(el, stored ? stored[0]! : key);
}

export type FieldsWrite<T extends Element = Element> = {
  next: T;
  // The keys written, aliases as named: the order a ~ line prints them in.
  written: string[];
  warnings: EditWarning[];
  // The label the caller gave was capped.
  capped: boolean;
};

type Patch = Record<string, FieldValue | undefined>;

const oneOf = (values: readonly string[], value: FieldValue) =>
  typeof value === 'string' && values.includes(value);

// Writes `fields` onto `el`. `ref` names the element in warnings.
export function writeFieldsOnto<T extends Element>(
  el: T,
  fields: Fields,
  theme: ThemeDefinition,
  ref: string,
  operation: number,
): FieldsWrite<T> | EditRejection {
  const aliases = aliasesOf(el);
  const stored = ELEMENT_FIELD_NAMES[el.type];
  const patch: Patch = {};
  const warnings: EditWarning[] = [];
  let label: string | null | undefined;
  for (const [given, value] of Object.entries(fields)) {
    // `icon`, the short name for a node's icon, is read as the stored `iconId` on an element that has one.
    const key =
      given === 'icon' && hasField(el, 'iconId') && !hasField(el, 'icon') ? 'iconId' : given;
    if (PROTOTYPE_KEYS.has(key)) return unknownField(operation, kindOf(el), key, stored, aliases);
    if (IDENTITY_FIELDS.has(key)) return invalidValue(operation, key, value, 'cannot be changed');
    if (LIVE_FIELDS.has(key))
      return invalidValue(
        operation,
        key,
        value,
        'people change it, not edit operations',
        LIVE_HINT,
      );
    const alias = aliases.find((a) => a === key);
    if (alias) {
      const rejection = writeAlias(el, alias, value, theme, ref, operation, patch, warnings);
      if (rejection) return rejection;
      if (alias === 'label') label = typeof value === 'string' ? value : null;
      continue;
    }
    if (!isElementFieldName(el.type, key) && !(FORMER_FIELDS[el.type]?.includes(key) ?? false))
      return unknownField(operation, kindOf(el), key, stored, aliases);
    // A closed vocabulary's value off its list is refused with the list (element-field-values.ts).
    if (fieldValueIssue(key, value))
      return invalidValue(
        operation,
        key,
        value,
        'is not a value it takes',
        `${key} takes ${ELEMENT_FIELD_VALUES[key]!.join(', ')}.`,
      );
    if (RAW_COLOURS.has(key) && el.type !== 'sticky' && isHexColour(value))
      warnings.push(overridesTheme(ref, key, value));
    // An icon id that names no icon draws a question mark: refused, with the icons like it.
    if (key === 'iconId' && typeof value === 'string' && !isIconId(value)) {
      const like = iconsLike(value).map((i) => i.id);
      return invalidValue(
        operation,
        key,
        value,
        'is not an icon',
        like.length
          ? `Icons like it: ${like.join(', ')}.`
          : 'Name the thing it shows in plain words (a heart, a clock, a server) and pick an icon id like it.',
      );
    }
    patch[key] = value;
  }
  let capped = false;
  if (typeof label === 'string') {
    const note = 'note' in patch ? patch.note : Reflect.get(el, 'note');
    const write = applyLabel(el, label, typeof note === 'string' ? note : undefined);
    patch.label = write.label;
    if (write.note !== undefined) patch.note = write.note;
    if (write.capped) {
      capped = true;
      const where = el.type === 'arrow' ? 'the rest was cut' : 'the full text is in its note';
      warnings.push({
        code: 'label_capped',
        ref,
        message: `${ref} label kept as ${JSON.stringify(write.label)}; ${where}`,
      });
    }
  }
  const set = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== null && v !== undefined),
  );
  let merged = mergeElementUpdate(el, set);
  for (const [key, v] of Object.entries(patch))
    if (v === null || v === undefined) delete merged[key];
  // A shape's preset is its look in the tab's theme (docs/specs/010-palette/style-presets.md): its colours are the
  // preset's, as picking it in the editor sets them, then any colour this write names itself. Stored alone, the id
  // drew nothing of it.
  if (typeof patch.colorPreset === 'string' && el.type === 'shape') {
    const derived = rederiveColorPresetForTheme(merged as Element, theme) as Record<
      string,
      unknown
    >;
    if (derived === merged) {
      const ids = shapeColorPresets(theme).map((p) => p.id);
      return invalidValue(
        operation,
        'colorPreset',
        patch.colorPreset,
        'is not a preset of the theme',
        `colorPreset takes ${ids.join(', ')}.`,
      );
    }
    // Every field the write names itself wins over the preset: its colours, and a width or style of border too
    // (the preset brings its own), so nothing the agent asked for is dropped while being reported as written.
    const own = Object.fromEntries(
      Object.keys(patch).flatMap((k) =>
        k !== 'colorPreset' && patch[k] != null ? [[k, merged[k]]] : [],
      ),
    );
    merged = { ...derived, ...own };
  }
  // Every key was checked against the element's type above, so the element keeps its type; finalise
  // validates the values.
  return { next: merged as T, written: Object.keys(fields), warnings, capped };
}

const overridesTheme = (ref: string, key: string, value: string): EditWarning => ({
  code: 'colour_overrides_theme',
  ref,
  message: `${ref} ${key} ${value} overrides the theme; a theme colour follows a theme change`,
});

function writeAlias(
  el: Element,
  alias: Alias,
  value: FieldValue,
  theme: ThemeDefinition,
  ref: string,
  operation: number,
  patch: Patch,
  warnings: EditWarning[],
): EditRejection | null {
  const text = (rule: string) => invalidValue(operation, alias, value, rule);
  switch (alias) {
    case 'label':
    case 'note':
      if (value !== null && typeof value !== 'string')
        return text('text, in quotes when it has spaces');
      patch[alias] = value;
      return null;
    case 'shape': {
      if (typeof value !== 'string') return text('a shape kind');
      const shape = coerceShapeKind(value);
      if (shape !== value)
        warnings.push({
          code: 'shape_coerced',
          ref,
          message: `${ref} shape ${JSON.stringify(value)} drawn as ${shape}`,
        });
      patch.shape = shape;
      return null;
    }
    case 'fill': {
      if (value === null) {
        patch.fillColor = null;
        patch.fillSwatch = null;
        return null;
      }
      if (typeof value !== 'string') return text('a theme colour or a hex');
      const write = resolveColourValue(el, value, theme);
      if ('rule' in write)
        return {
          ...text(write.rule),
          details: [`fill=${value}: ${write.rule}`, `allowed: ${write.allowed.join(' ')}`],
        };
      for (const [key, v] of Object.entries(write.patch)) patch[key] = v ?? null;
      if (write.overridesTheme) warnings.push(overridesTheme(ref, 'fill', value));
      return null;
    }
    case 'stroke':
    case 'text-color': {
      const field = alias === 'stroke' ? 'strokeColor' : 'textColor';
      if (value !== null && typeof value !== 'string')
        return text('a colour: a hex or a marker colour');
      patch[field] = value;
      // A stroke written by value is no longer bound to a quick-style swatch.
      if (alias === 'stroke') patch.strokeSwatch = null;
      if (isHexColour(value) && themeColourFields(el).some((f) => f.element === field))
        warnings.push(overridesTheme(ref, alias, value));
      return null;
    }
    case 'border':
      if (value !== null && !oneOf(BORDER_STYLES, value))
        return text(`one of ${BORDER_STYLES.join(' ')}`);
      patch.strokeStyle = value;
      return null;
    case 'text': {
      // A preset, or an exact whole px from the Size slider's range (docs/specs/004-interface-design/fonts.md
      // "Text size"), written as a number or a numeric string ("18").
      const size = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
      if (size !== null && !isTextSize(size)) return { ...text(`one of ${TEXT_SIZE_VALUES}`) };
      patch.textSize = size;
      return null;
    }
    case 'line':
      if (value !== null && !oneOf(ARROW_STYLES, value))
        return text(`one of ${ARROW_STYLES.join(' ')}`);
      patch.arrowStyle = value;
      return null;
  }
}
