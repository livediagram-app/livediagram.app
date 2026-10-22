// The shape element's field checks (validate.ts): its kind, the bounded data arrays of charts and
// rails, and the closed sets and bounded rows of the content-carrying kinds. Each
// check names its field and rule, so a refusal says which value to fix.

import { isChartCategory, isChartSeries, isChartSlice } from './malformed-chart-rows';
import { CHART_VARIANTS, isChartVariant } from './chart-types';
import { EMBED_PROVIDERS } from './youtube';
import {
  CHECKLIST_MAX_ITEMS,
  PAGE_HEADING_MAX,
  CHECKLIST_MAX_TEXT,
  LEGEND_MAX_ITEMS,
  LEGEND_MAX_TEXT,
  CODE_LANGUAGES,
  CODE_MAX_LENGTH,
} from './data-shapes';
import { NAV_LINKS_MAX, PROCESS_MAX_STEPS, STATS_MAX, WEB_TEXT_MAX } from './web-components';
import { isCodeThemeId } from './code-themes';
import { CARD_TAG_MAX, CARD_TAGS_MAX, isCardMedia } from './card';
import { isChipLook } from './chip';
import { isAttachPoint } from './attachment';
import { isPointerTip } from './pointer-note';
import { isPyramidVariant } from './concept';
import { isChartPaletteId } from './chart-palettes';
import {
  type ElementValidationIssue,
  type FieldCheck,
  arrayRule,
  boundedArray,
  firstFieldIssue,
  isBool,
  isNonEmptyStr,
  isNum,
  issue,
  oneOfRule,
  stringRule,
} from './validate-primitives';
import { isRecord } from './is-record';
import {
  SANKEY_ALIGNS,
  SANKEY_LEFTOVERS,
  SANKEY_ANIMS,
  SANKEY_LINK_COLORS,
  SANKEY_MAX_FLOWS,
  SANKEY_MAX_NODES,
  SANKEY_NAME_MAX,
  SANKEY_UNIT_MAX,
  SANKEY_VALUE_LABELS,
  SANKEY_VALUE_MAX,
} from './sankey-model';

// railLabels / lineCategories / pieSlices / lineSeries.
const MAX_DATA_ARRAY = 5_000;

const isStrUpTo = (max: number) => (v: unknown) => typeof v === 'string' && v.length <= max;
// A web component's row text (docs/specs/009-elements/web-components-and-no-groups.md).
const isBoundedStr = isStrUpTo(WEB_TEXT_MAX);
// A single-line heading (pageTitle / pageSubtitle).
const isHeadingStr = isStrUpTo(PAGE_HEADING_MAX);
const isOptionalStrUpTo = (v: unknown, max: number) => v === undefined || isStrUpTo(max)(v);
const rowsOf =
  (max: number, row: (v: unknown) => boolean) =>
  (v: unknown): boolean =>
    boundedArray(v, max) && v.every(row);
const dataArray = (field: string): FieldCheck => ({
  field,
  valid: (v) => boundedArray(v, MAX_DATA_ARRAY),
  rule: arrayRule(MAX_DATA_ARRAY),
});
// The chart palette ids a refusal lists, written out: reading CHART_PALETTES while this module loads would meet it
// before it is defined in a bundle that orders the two the other way (the api worker failed to start). A test keeps
// the two in step.
export const CHART_PALETTE_IDS_RULE = [
  'vivid',
  'ocean',
  'forest',
  'sunset',
  'berry',
  'earth',
  'grey',
  'contrast',
] as const;

// The chip looks and attach points a refusal lists, written out for the same reason as the chart palettes above:
// chip.ts sits in an import cycle with this module, so its lists may be uninitialised while this one loads. A test
// keeps the copies equal.
export const CHIP_LOOKS_RULE = ['solid', 'ink', 'outline', 'tinted', 'quiet'] as const;
export const ATTACH_POINTS_RULE = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
] as const;

const flag = (field: string): FieldCheck => ({ field, valid: isBool, rule: 'a boolean' });

const isChecklistItem = (item: unknown) =>
  isRecord(item) && isStrUpTo(CHECKLIST_MAX_TEXT)(item.text) && isBool(item.done);

// Sankey (docs/specs/009-elements/sankey.md): a zero or negative amount is stored (the Flows dialog names
// why it is not drawn), but not one past SANKEY_VALUE_MAX, nor a name past SANKEY_NAME_MAX.
const isSankeyFlow = (item: unknown) =>
  isRecord(item) &&
  isStrUpTo(SANKEY_NAME_MAX)(item.from) &&
  isStrUpTo(SANKEY_NAME_MAX)(item.to) &&
  isNum(item.value) &&
  Math.abs(item.value) <= SANKEY_VALUE_MAX;

const isSankeyNode = (item: unknown) =>
  isRecord(item) &&
  isStrUpTo(SANKEY_NAME_MAX)(item.name) &&
  (item.color === undefined || isStrUpTo(64)(item.color)) &&
  (item.leftover === undefined || item.leftover === false);

const oneOf = (field: string, values: readonly string[]): FieldCheck => ({
  field,
  valid: (v) => values.includes(v as string),
  rule: oneOfRule(values),
});

const isLegendItem = (item: unknown) =>
  isRecord(item) &&
  isStrUpTo(LEGEND_MAX_TEXT)(item.label) &&
  (item.color === undefined || typeof item.color === 'string');

// Absent passes every check; a present value must satisfy its rule. Ids that point at nothing
// (`windowTabId`, `attachedTo`) are legal: the element renders unpaired.
const SHAPE_FIELD_CHECKS: readonly FieldCheck[] = [
  dataArray('railLabels'),
  // A chart's rows (docs/specs/009-elements/pie-chart.md "Model").
  {
    field: 'lineCategories',
    valid: rowsOf(MAX_DATA_ARRAY, isChartCategory),
    rule: arrayRule(MAX_DATA_ARRAY, 'categories, each text'),
  },
  {
    field: 'pieSlices',
    valid: rowsOf(MAX_DATA_ARRAY, isChartSlice),
    rule: arrayRule(MAX_DATA_ARRAY, 'slices, each { label, value }'),
  },
  {
    field: 'lineSeries',
    valid: rowsOf(MAX_DATA_ARRAY, isChartSeries),
    rule: arrayRule(MAX_DATA_ARRAY, 'series, each { name, values }'),
  },
  // A tab id that is gone is legal too: the window says its tab is not available.
  { field: 'windowTabId', valid: isNonEmptyStr, rule: 'a tab id' },
  { field: 'code', valid: isStrUpTo(CODE_MAX_LENGTH), rule: stringRule(CODE_MAX_LENGTH) },
  {
    field: 'codeLanguage',
    valid: (v) => (CODE_LANGUAGES as readonly unknown[]).includes(v),
    rule: oneOfRule(CODE_LANGUAGES),
  },
  { field: 'codeTheme', valid: (v) => isCodeThemeId(v as string), rule: 'a code theme id' },
  {
    field: 'chartVariant',
    valid: isChartVariant,
    rule: oneOfRule(CHART_VARIANTS),
  },
  {
    field: 'chartPalette',
    valid: (v) => isChartPaletteId(v as string),
    rule: oneOfRule(CHART_PALETTE_IDS_RULE),
  },
  {
    field: 'embedProvider',
    valid: (v) => (EMBED_PROVIDERS as readonly unknown[]).includes(v),
    rule: oneOfRule(EMBED_PROVIDERS),
  },
  { field: 'pageTitle', valid: isHeadingStr, rule: stringRule(PAGE_HEADING_MAX) },
  { field: 'pageSubtitle', valid: isHeadingStr, rule: stringRule(PAGE_HEADING_MAX) },
  // Card slots (docs/specs/009-elements/card.md).
  { field: 'cardMedia', valid: isCardMedia, rule: oneOfRule(['badge', 'tile', 'initial']) },
  flag('cardHeader'),
  // Badge and Step number (docs/specs/009-elements/badge.md).
  { field: 'chipLook', valid: isChipLook, rule: oneOfRule(CHIP_LOOKS_RULE) },
  { field: 'attachedTo', valid: isNonEmptyStr, rule: 'an element id' },
  { field: 'attachAt', valid: isAttachPoint, rule: oneOfRule(ATTACH_POINTS_RULE) },
  flag('stepSequence'),
  {
    field: 'pointerTip',
    // Read at call time: pointer-note.ts sits on an import cycle with attachment.ts, so it may not be loaded yet
    // when this table is built.
    valid: (v: unknown) => isPointerTip(v),
    rule: 'an { x, y } of finite numbers within ±4000',
  },
  // A stack's arrangement (docs/specs/009-elements/stack.md).
  {
    field: 'stackDirection',
    valid: (v: unknown) => v === 'row' || v === 'column' || v === 'grid',
    rule: oneOfRule(['row', 'column', 'grid']),
  },
  {
    field: 'stackAlign',
    valid: (v: unknown) => v === 'start' || v === 'center' || v === 'end',
    rule: oneOfRule(['start', 'center', 'end']),
  },
  {
    field: 'stackGap',
    valid: (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 64,
    rule: 'a whole number 0 to 64',
  },
  {
    field: 'stackPadding',
    valid: (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 64,
    rule: 'a whole number 0 to 64',
  },
  {
    field: 'stackColumns',
    valid: (v: unknown) => Number.isInteger(v) && (v as number) >= 2 && (v as number) <= 6,
    rule: 'a whole number 2 to 6',
  },
  flag('hubSpokes'),
  // Concept graphics (docs/specs/009-elements/concept-graphics.md): the rows are content; the animation is
  // cosmetic and lenient, like every element animation.
  {
    field: 'conceptRows',
    valid: rowsOf(8, (r) => isRecord(r) && isStrUpTo(60)(r.label) && isOptionalStrUpTo(r.note, 40)),
    rule: 'an array of at most 8 { label, note? } rows (60 and 40 characters)',
  },
  {
    field: 'pyramidVariant',
    valid: isPyramidVariant,
    rule: oneOfRule(['pyramid', 'inverted', 'funnel']),
  },
  {
    field: 'tags',
    valid: rowsOf(CARD_TAGS_MAX, isStrUpTo(CARD_TAG_MAX)),
    rule: `an array of at most ${CARD_TAGS_MAX} strings of at most ${CARD_TAG_MAX} characters`,
  },
  {
    field: 'stats',
    valid: rowsOf(
      STATS_MAX,
      (s) => isRecord(s) && isBoundedStr(s.value) && isBoundedStr(s.caption),
    ),
    rule: arrayRule(STATS_MAX, `{ value, caption } rows of ${WEB_TEXT_MAX} characters`),
  },
  {
    field: 'processSteps',
    valid: rowsOf(PROCESS_MAX_STEPS, isBoundedStr),
    rule: arrayRule(PROCESS_MAX_STEPS, `strings of ${WEB_TEXT_MAX} characters`),
  },
  {
    field: 'navLinks',
    valid: rowsOf(NAV_LINKS_MAX, isBoundedStr),
    rule: arrayRule(NAV_LINKS_MAX, `strings of ${WEB_TEXT_MAX} characters`),
  },
  {
    field: 'checklistItems',
    valid: rowsOf(CHECKLIST_MAX_ITEMS, isChecklistItem),
    rule: arrayRule(CHECKLIST_MAX_ITEMS, '{ text, done } rows'),
  },
  {
    field: 'legendItems',
    valid: rowsOf(LEGEND_MAX_ITEMS, isLegendItem),
    rule: arrayRule(LEGEND_MAX_ITEMS, '{ label, color? } rows'),
  },
  {
    field: 'sankeyFlows',
    valid: rowsOf(SANKEY_MAX_FLOWS, isSankeyFlow),
    rule: arrayRule(
      SANKEY_MAX_FLOWS,
      `{ from, to, value } rows, names up to ${SANKEY_NAME_MAX} characters`,
    ),
  },
  {
    field: 'sankeyNodes',
    valid: rowsOf(SANKEY_MAX_NODES, isSankeyNode),
    rule: arrayRule(SANKEY_MAX_NODES, '{ name, color?, leftover?: false } rows'),
  },
  oneOf('sankeyLinkColor', SANKEY_LINK_COLORS),
  oneOf('sankeyAlign', SANKEY_ALIGNS),
  oneOf('sankeyValueLabel', SANKEY_VALUE_LABELS),
  oneOf('sankeyAnim', SANKEY_ANIMS),
  { field: 'sankeyUnit', valid: isStrUpTo(SANKEY_UNIT_MAX), rule: stringRule(SANKEY_UNIT_MAX) },
  oneOf('sankeyLeftover', SANKEY_LEFTOVERS),
  {
    field: 'sankeyLeftoverName',
    valid: isStrUpTo(SANKEY_NAME_MAX),
    rule: stringRule(SANKEY_NAME_MAX),
  },
  flag('sankeyAnimRepeat'),
];

// A shape's own issue, its box already checked: the kind is required, the rest optional.
export function shapeValidationIssue(el: Record<string, unknown>): ElementValidationIssue | null {
  if (!isNonEmptyStr(el.shape)) return issue('shape', 'a shape kind');
  return firstFieldIssue(el, SHAPE_FIELD_CHECKS);
}
