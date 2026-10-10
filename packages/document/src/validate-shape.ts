// The shape element's field checks (validate.ts): its kind, the bounded data arrays of charts and
// rails, and the closed sets and bounded rows of the content-carrying and collaborative kinds. Each
// check names its field and rule, so a refusal says which value to fix.

import { isPlanViewSettings, isValidItemId, normaliseBoardSetup } from '@livediagram/items';
import { isPlanSheetRef } from './element-types';
import { isChartSource } from './chart-source';
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
import { isChartPaletteId } from './chart-palettes';
import { isMindFlow } from './mind-flow';
import {
  type ElementValidationIssue,
  type FieldCheck,
  arrayRule,
  boundedArray,
  firstFieldIssue,
  isBool,
  isNonEmptyStr,
  isNum,
  isObj,
  issue,
  oneOfRule,
  stringRule,
} from './validate-primitives';

// railLabels / lineCategories / pieSlices / lineSeries / pickerOptions / session options.
const MAX_DATA_ARRAY = 5_000;
// A Plan card's sizes (PlanCardRef.size): the same three as @livediagram/items' CARD_SIZES, written out because
// that package imports this one and its binding may be uninitialised at module load; plan-shapes.test.ts keeps
// the two equal.
export const PLAN_CARD_SIZES: readonly string[] = ['minimal', 'compact', 'detailed'];

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
const flag = (field: string): FieldCheck => ({ field, valid: isBool, rule: 'a boolean' });
const finite = (field: string): FieldCheck => ({ field, valid: isNum, rule: 'a finite number' });

// Record (docs/specs/009-elements/entity.md): rows of { name, type? }.
const isEntityField = (f: unknown) =>
  isObj(f) && isStrUpTo(ENTITY_MAX_TEXT)(f.name) && isOptionalStrUpTo(f.type, ENTITY_MAX_TEXT);

// Per-participant responses (docs/specs/012-collaboration/participant-responses.md). The
// one-per-participant rule is `setResponse`'s on write, not a load check: a duplicate from an older
// client renders as the first entry rather than failing the tab.
const isResponse = (r: unknown) =>
  isObj(r) &&
  typeof r.participantId === 'string' &&
  isStrUpTo(RESPONSE_VALUE_MAX)(r.value) &&
  isNum(r.at);

// Q&A board (docs/specs/012-collaboration/qa-board.md): bounded notes, each with bounded voters.
// The one-vote-per-person rule is the reducer's (applyQaAction), not a load check.
const isQaAuthor = (a: unknown) =>
  isObj(a) && isStrUpTo(QA_MAX_NAME)(a.name) && isStrUpTo(32)(a.color);
const isQaNote = (n: unknown) =>
  isObj(n) &&
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
  isObj(item) && isStrUpTo(AGENDA_MAX_TEXT)(item.label) && isNum(item.minutes);

const isRollCallEntry = (entry: unknown) =>
  isObj(entry) &&
  isStrUpTo(ROLL_CALL_MAX_TEXT)(entry.name) &&
  isStrUpTo(ROLL_CALL_MAX_TEXT)(entry.color) &&
  isNum(entry.at);

const isChecklistItem = (item: unknown) =>
  isObj(item) && isStrUpTo(CHECKLIST_MAX_TEXT)(item.text) && isBool(item.done);

const isLegendItem = (item: unknown) =>
  isObj(item) &&
  isStrUpTo(LEGEND_MAX_TEXT)(item.label) &&
  (item.color === undefined || typeof item.color === 'string');

// Session button (docs/specs/012-collaboration/session-button.md): a known tool and bounded
// options. Durations are clamped where read (sessionButtonPlan), and the poll's answer shape falls
// back to the default style, so neither is a load check.
const isSession = (v: unknown) =>
  isObj(v) &&
  isSessionTool(v.tool) &&
  (v.options === undefined || boundedArray(v.options, MAX_DATA_ARRAY));

// Absent passes every check; a present value must satisfy its rule. Ids that point at nothing
// (`portalTarget`, `mindParentId`) are legal: the element renders unpaired or as a root.
const SHAPE_FIELD_CHECKS: readonly FieldCheck[] = [
  { field: 'titleOrientation', valid: (v) => v === 'upright', rule: oneOfRule(['upright']) },
  dataArray('railLabels'),
  dataArray('lineCategories'),
  dataArray('pieSlices'),
  dataArray('lineSeries'),
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
  {
    field: 'chartPalette',
    valid: (v) => isChartPaletteId(v as string),
    rule: 'a chart palette id',
  },
  {
    field: 'embedProvider',
    valid: (v) => (EMBED_PROVIDERS as readonly unknown[]).includes(v),
    rule: oneOfRule(EMBED_PROVIDERS),
  },
  { field: 'mindParentId', valid: (v) => typeof v === 'string', rule: 'an element id' },
  { field: 'pageTitle', valid: isHeadingStr, rule: stringRule(PAGE_HEADING_MAX) },
  { field: 'pageSubtitle', valid: isHeadingStr, rule: stringRule(PAGE_HEADING_MAX) },
  {
    field: 'entityFields',
    valid: rowsOf(ENTITY_MAX_FIELDS, isEntityField),
    rule: arrayRule(ENTITY_MAX_FIELDS, `{ name, type? } rows of ${ENTITY_MAX_TEXT} characters`),
  },
  {
    field: 'stats',
    valid: rowsOf(STATS_MAX, (s) => isObj(s) && isBoundedStr(s.value) && isBoundedStr(s.caption)),
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
    field: 'planBoard',
    valid: (v: unknown) => normaliseBoardSetup(v) !== null,
    rule: 'a Plan board set-up: 1 to 12 columns, each an id and a status',
  },
  {
    field: 'planCard',
    valid: (v: unknown) =>
      typeof v === 'object' &&
      v !== null &&
      typeof (v as { itemId?: unknown }).itemId === 'string' &&
      ((v as { itemId: string }).itemId === '' ||
        isValidItemId((v as { itemId: string }).itemId)) &&
      ((v as { size?: unknown }).size === undefined ||
        PLAN_CARD_SIZES.includes((v as { size: string }).size)),
    rule: 'an object { itemId, size? } naming an item, size minimal, compact or detailed',
  },
  {
    field: 'planView',
    // Called, not referenced: @livediagram/items imports this package too, so at module load the binding
    // may not be initialised yet (a ReferenceError in the browser).
    valid: (v: unknown) => isPlanViewSettings(v),
    rule: 'an object { view } naming a plan view, with an optional swimlaneBy, swimlaneField, namesWidth (120 to 2000) and rowOrder (up to 2000 card ids)',
  },
  {
    field: 'chartSource',
    valid: (v: unknown) => isChartSource(v),
    rule: 'an object { sheetId, range: { r1, c1, r2, c2 } } naming a sheet of the document and row and column ids',
  },
  {
    field: 'planSheet',
    valid: (v: unknown) => isPlanSheetRef(v),
    rule: 'an object { sheetId } naming a sheet of the document',
  },
  {
    field: 'legendItems',
    valid: rowsOf(LEGEND_MAX_ITEMS, isLegendItem),
    rule: arrayRule(LEGEND_MAX_ITEMS, '{ label, color? } rows'),
  },
];

// A shape's own issue, its box already checked: the kind is required, the rest optional.
export function shapeValidationIssue(el: Record<string, unknown>): ElementValidationIssue | null {
  if (!isNonEmptyStr(el.shape)) return issue('shape', 'a shape kind');
  return firstFieldIssue(el, SHAPE_FIELD_CHECKS);
}
