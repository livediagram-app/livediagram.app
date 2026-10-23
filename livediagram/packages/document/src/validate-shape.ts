// The shape element's field checks (validate.ts): its kind, the bounded data arrays of charts and
// rails, and the closed sets and bounded rows of the content-carrying and collaborative kinds. Each
// check names its field and rule, so a refusal says which value to fix.

import { isChartCategory, isChartSeries, isChartSlice } from './malformed-chart-rows';
import { isRoomDoor } from './office';
import { isFlowchartDirection } from './flowchart';
import { CHART_VARIANTS, isChartVariant } from './chart-types';
import { EMBED_PROVIDERS } from './youtube';
import { SELECTION_MODES, isPickerSource, isSelectionMode, isSessionTool } from './selection-mode';
import { RESPONSES_MAX, RESPONSE_VALUE_MAX } from './responses';
import { QA_MAX_ID, QA_MAX_NAME, QA_MAX_NOTES, QA_MAX_TEXT, QA_MAX_VOTERS } from './qa-board';
import { COLLAB_ROUND_MAX } from './element-deltas';
import { QUIZ_MAX_OPTIONS, QUIZ_OPTION_MAX_TEXT } from './quiz';
import {
  AGENDA_MAX_ITEMS,
  AGENDA_MAX_TEXT,
  DECISION_MAX_DRIVERS,
  DECISION_MAX_TEXT,
  IDEA_CARD_ID_MAX,
  IDEA_MAX_CARDS,
  IDEA_MAX_TEXT,
  ROLL_CALL_MAX,
  ROLL_CALL_MAX_TEXT,
  isChairFacing,
  isDecisionDate,
  isDecisionStatus,
  isEstimateScale,
} from './collab-shapes';
import {
  CHECKLIST_MAX_ITEMS,
  PAGE_HEADING_MAX,
  ENTITY_KEYS,
  ENTITY_MAX_FIELDS,
  ENTITY_MAX_TEXT,
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
import { isBoundaryStyle } from './boundary';
import { isPyramidVariant } from './concept';
import { isChartPaletteId } from './chart-palettes';
import { isMindFlow, isMindSpacing } from './mind-flow';
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

// railLabels / lineCategories / pieSlices / lineSeries / pickerOptions / session options.
const MAX_DATA_ARRAY = 5_000;

const isStrUpTo = (max: number) => (v: unknown) => typeof v === 'string' && v.length <= max;
// A web component's row text (docs/specs/009-elements/web-components-and-no-groups.md).
const isBoundedStr = isStrUpTo(WEB_TEXT_MAX);
// A single-line heading (the page masthead's bound, docs/specs/009-elements/page-element.md).
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
const finite = (field: string): FieldCheck => ({ field, valid: isNum, rule: 'a finite number' });

// Record (docs/specs/009-elements/entity.md): rows of { name, type? }.
const isEntityField = (f: unknown) =>
  isRecord(f) &&
  isStrUpTo(ENTITY_MAX_TEXT)(f.name) &&
  isOptionalStrUpTo(f.type, ENTITY_MAX_TEXT) &&
  (f.key === undefined || (ENTITY_KEYS as readonly unknown[]).includes(f.key));

// Per-participant responses (docs/specs/012-collaboration/participant-responses.md). The
// one-per-participant rule is `setResponse`'s on write, not a load check: a duplicate from an older
// client renders as the first entry rather than failing the tab.
const isResponse = (r: unknown) =>
  isRecord(r) &&
  typeof r.participantId === 'string' &&
  isStrUpTo(RESPONSE_VALUE_MAX)(r.value) &&
  isNum(r.at);

// Q&A board (docs/specs/012-collaboration/qa-board.md): bounded notes, each with bounded voters.
// The one-vote-per-person rule is the reducer's (applyQaAction), not a load check.
const isQaAuthor = (a: unknown) =>
  isRecord(a) && isStrUpTo(QA_MAX_NAME)(a.name) && isStrUpTo(32)(a.color);
const isQaNote = (n: unknown) =>
  isRecord(n) &&
  isNonEmptyStr(n.id) &&
  n.id.length <= QA_MAX_ID &&
  isStrUpTo(QA_MAX_TEXT)(n.text) &&
  isNum(n.at) &&
  rowsOf(QA_MAX_VOTERS, isStrUpTo(QA_MAX_ID))(n.voters) &&
  (n.state === undefined || n.state === 'discussing' || n.state === 'done') &&
  (n.doneAt === undefined || isNum(n.doneAt)) &&
  (n.author === undefined || isQaAuthor(n.author));

// Agenda (docs/specs/012-collaboration/agenda.md): minutes are clamped where read
// (clampAgendaMinutes), not rejected here.
const isAgendaItem = (item: unknown) =>
  isRecord(item) && isStrUpTo(AGENDA_MAX_TEXT)(item.label) && isNum(item.minutes);

const isRollCallEntry = (entry: unknown) =>
  isRecord(entry) &&
  isStrUpTo(ROLL_CALL_MAX_TEXT)(entry.name) &&
  isStrUpTo(ROLL_CALL_MAX_TEXT)(entry.color) &&
  isNum(entry.at);

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

// Session button (docs/specs/012-collaboration/session-button.md): a known tool and bounded
// options. Durations are clamped where read (sessionButtonPlan), and the poll's answer shape falls
// back to the default style, so neither is a load check.
const isSession = (v: unknown) =>
  isRecord(v) &&
  isSessionTool(v.tool) &&
  (v.options === undefined || boundedArray(v.options, MAX_DATA_ARRAY));

// Absent passes every check; a present value must satisfy its rule. Ids that point at nothing
// (`portalTarget`, `mindParentId`) are legal: the element renders unpaired or as a root.
const SHAPE_FIELD_CHECKS: readonly FieldCheck[] = [
  { field: 'titleOrientation', valid: (v) => v === 'upright', rule: oneOfRule(['upright']) },
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
  { field: 'portalTarget', valid: isNonEmptyStr, rule: 'an element id' },
  { field: 'mode', valid: isSelectionMode, rule: oneOfRule(SELECTION_MODES) },
  { field: 'session', valid: isSession, rule: 'a session with a known tool' },
  flag('revealed'),
  { field: 'pickerSource', valid: isPickerSource, rule: 'a picker source' },
  dataArray('pickerOptions'),
  { field: 'code', valid: isStrUpTo(CODE_MAX_LENGTH), rule: stringRule(CODE_MAX_LENGTH) },
  {
    field: 'codeLanguage',
    valid: (v) => (CODE_LANGUAGES as readonly unknown[]).includes(v),
    rule: oneOfRule(CODE_LANGUAGES),
  },
  { field: 'codeTheme', valid: (v) => isCodeThemeId(v as string), rule: 'a code theme id' },
  { field: 'mindFlow', valid: (v) => isMindFlow(v as string), rule: 'a mind flow' },
  { field: 'mindSpacing', valid: (v) => isMindSpacing(v as string), rule: 'a mind spacing' },
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
  { field: 'mindParentId', valid: (v) => typeof v === 'string', rule: 'an element id' },
  { field: 'flowchartId', valid: isNonEmptyStr, rule: 'a flowchart id' },
  { field: 'flowDirection', valid: isFlowchartDirection, rule: 'a flowchart direction' },
  { field: 'flowLaneId', valid: isNonEmptyStr, rule: 'an element id' },
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
  // A person node (docs/specs/009-elements/org-chart.md).
  { field: 'mindLook', valid: (v: unknown) => v === 'person', rule: oneOfRule(['person']) },
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
  // A diagram key (docs/specs/009-elements/diagram-key.md): derived rows, and the author's meanings.
  {
    field: 'keyRows',
    valid: rowsOf(
      12,
      (r) =>
        isRecord(r) &&
        isStrUpTo(48)(r.id) &&
        (r.kind === 'line' || r.kind === 'tag') &&
        isOptionalStrUpTo(r.style, 40) &&
        isOptionalStrUpTo(r.tag, 40) &&
        isOptionalStrUpTo(r.color, 40),
    ),
    rule: 'an array of at most 12 { id, kind: line | tag, style?, tag?, color? } rows',
  },
  {
    field: 'keyMeanings',
    valid: (v: unknown) =>
      isRecord(v) &&
      Object.keys(v).length <= 24 &&
      Object.entries(v).every(([k, t]) => k.length <= 48 && isStrUpTo(60)(t)),
    rule: 'at most 24 row meanings of at most 60 characters',
  },
  flag('hubSpokes'),
  // A sequence diagram's rows (docs/specs/009-elements/sequence-diagram.md); Play is cosmetic and lenient.
  {
    field: 'sequenceParticipants',
    valid: (v: unknown) =>
      Array.isArray(v) &&
      v.length >= 2 &&
      rowsOf(
        12,
        (p) =>
          isRecord(p) &&
          isNonEmptyStr(p.id) &&
          isStrUpTo(24)(p.id) &&
          isStrUpTo(40)(p.label) &&
          (p.actor === undefined || isBool(p.actor)),
      )(v),
    rule: 'an array of 2 to 12 { id, label, actor? } participants (24 and 40 characters)',
  },
  {
    field: 'sequenceMessages',
    valid: rowsOf(
      60,
      (m) =>
        isRecord(m) &&
        isStrUpTo(24)(m.from) &&
        isStrUpTo(24)(m.to) &&
        isStrUpTo(80)(m.label) &&
        (m.kind === 'call' || m.kind === 'async' || m.kind === 'reply'),
    ),
    rule: 'an array of at most 60 { from, to, label, kind: call | async | reply } messages',
  },
  flag('sequenceNumbered'),
  // Boundary (docs/specs/009-elements/boundary.md).
  { field: 'boundaryStyle', valid: isBoundaryStyle, rule: oneOfRule(['tab', 'inset', 'c4']) },
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
    field: 'entityFields',
    valid: rowsOf(ENTITY_MAX_FIELDS, isEntityField),
    rule: arrayRule(
      ENTITY_MAX_FIELDS,
      `{ name, type?, key? } rows of ${ENTITY_MAX_TEXT} characters, key one of ${ENTITY_KEYS.join(' ')}`,
    ),
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
  { field: 'chairFacing', valid: isChairFacing, rule: 'a chair facing' },
  { field: 'roomDoor', valid: isRoomDoor, rule: 'a room doorway (n, e, s, w or none)' },
  {
    field: 'responses',
    valid: rowsOf(RESPONSES_MAX, isResponse),
    rule: arrayRule(RESPONSES_MAX, '{ participantId, value, at } responses'),
  },
  flag('responsesRevealed'),
  { field: 'estimateScale', valid: isEstimateScale, rule: 'an estimate scale' },
  {
    field: 'ideaCards',
    valid: rowsOf(IDEA_MAX_CARDS, isStrUpTo(IDEA_MAX_TEXT)),
    rule: arrayRule(IDEA_MAX_CARDS, `strings of ${IDEA_MAX_TEXT} characters`),
  },
  {
    field: 'ideaCardIds',
    valid: rowsOf(IDEA_MAX_CARDS, isStrUpTo(IDEA_CARD_ID_MAX)),
    rule: arrayRule(IDEA_MAX_CARDS, `ids of ${IDEA_CARD_ID_MAX} characters`),
  },
  flag('ideasRevealed'),
  {
    field: 'qaNotes',
    valid: rowsOf(QA_MAX_NOTES, isQaNote),
    rule: arrayRule(QA_MAX_NOTES, 'Q&A notes'),
  },
  finite('qaRev'),
  { field: 'collabRound', valid: isStrUpTo(COLLAB_ROUND_MAX), rule: stringRule(COLLAB_ROUND_MAX) },
  {
    field: 'agendaItems',
    valid: rowsOf(AGENDA_MAX_ITEMS, isAgendaItem),
    rule: arrayRule(AGENDA_MAX_ITEMS, '{ label, minutes } rows'),
  },
  finite('agendaCurrent'),
  finite('agendaTimerStartedAt'),
  { field: 'decisionStatus', valid: isDecisionStatus, rule: 'a decision status' },
  {
    field: 'decisionDate',
    valid: (v) => typeof v === 'string' && isDecisionDate(v),
    rule: 'a YYYY-MM-DD date',
  },
  {
    field: 'decisionDrivers',
    valid: rowsOf(DECISION_MAX_DRIVERS, isStrUpTo(DECISION_MAX_TEXT)),
    rule: arrayRule(DECISION_MAX_DRIVERS, `strings of ${DECISION_MAX_TEXT} characters`),
  },
  {
    field: 'rollCall',
    valid: rowsOf(ROLL_CALL_MAX, isRollCallEntry),
    rule: arrayRule(ROLL_CALL_MAX, '{ name, color, at } entries'),
  },
  {
    field: 'quizOptions',
    valid: rowsOf(QUIZ_MAX_OPTIONS, isStrUpTo(QUIZ_OPTION_MAX_TEXT)),
    rule: arrayRule(QUIZ_MAX_OPTIONS, `strings of ${QUIZ_OPTION_MAX_TEXT} characters`),
  },
  finite('quizCorrect'),
  finite('quizSeconds'),
  finite('quizStartedAt'),
  finite('quizLockedAt'),
  flag('quizRevealed'),
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
