// The shape element's field checks (validate.ts): its kind, the bounded data arrays of charts and
// rails, and the closed sets and bounded rows of the content-carrying and collaborative kinds. Each
// check names its field and rule, so a refusal says which value to fix.
// The helpers and the checks two or more products hold the same way are
// @liveworkspace/element-model/shape-field-checks; this list keeps this product's order and its own checks.

import { isChartSlice } from './malformed-chart-rows';
import { isChairFacing, isRoomDoor } from './retired-elements';
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
  isDecisionDate,
  isDecisionStatus,
  isEstimateScale,
} from './collab-shapes';
import {
  type ElementValidationIssue,
  type FieldCheck,
  arrayRule,
  boundedArray,
  isNonEmptyStr,
  isNum,
  oneOfRule,
  stringRule,
} from '@liveworkspace/model-core/validate-primitives';
import { isRecord } from '@liveworkspace/model-core/is-record';
import {
  MAX_DATA_ARRAY,
  isStrUpTo,
  rowsOf,
  dataArray,
  flag,
  finite,
  chartRowChecks,
  CODE_CHECKS,
  MIND_FLOW_CHECKS,
  CHART_LOOK_CHECKS,
  FLOWCHART_CHECKS,
  CARD_CHECKS,
  POINTER_TIP_CHECK,
  MIND_LOOK_CHECK,
  STACK_CHECKS,
  DIAGRAM_KEY_CHECKS,
  SEQUENCE_CHECKS,
  BOUNDARY_CHECK,
  CONCEPT_CHECKS,
  TAGS_CHECK,
  ENTITY_FIELDS_CHECK,
  STATS_CHECK,
  WEB_LIST_CHECKS,
  CHECKLIST_CHECK,
  LEGEND_CHECK,
  SANKEY_CHECKS,
  shapeIssue,
} from '@liveworkspace/element-model/shape-field-checks';

// The refusal lists this product's tests compare with their sources.
export {
  ATTACH_POINTS_RULE,
  CHART_PALETTE_IDS_RULE,
  CHIP_LOOKS_RULE,
} from '@liveworkspace/element-model/shape-field-checks';

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
  ...chartRowChecks(isChartSlice),
  { field: 'portalTarget', valid: isNonEmptyStr, rule: 'an element id' },
  { field: 'mode', valid: isSelectionMode, rule: oneOfRule(SELECTION_MODES) },
  { field: 'session', valid: isSession, rule: 'a session with a known tool' },
  flag('revealed'),
  { field: 'pickerSource', valid: isPickerSource, rule: 'a picker source' },
  dataArray('pickerOptions'),
  ...CODE_CHECKS,
  ...MIND_FLOW_CHECKS,
  ...CHART_LOOK_CHECKS,
  ...FLOWCHART_CHECKS,
  ...CARD_CHECKS,
  flag('stepSequence'),
  POINTER_TIP_CHECK,
  MIND_LOOK_CHECK,
  ...STACK_CHECKS,
  ...DIAGRAM_KEY_CHECKS,
  flag('hubSpokes'),
  ...SEQUENCE_CHECKS,
  BOUNDARY_CHECK,
  ...CONCEPT_CHECKS,
  TAGS_CHECK,
  ENTITY_FIELDS_CHECK,
  STATS_CHECK,
  ...WEB_LIST_CHECKS,
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
  CHECKLIST_CHECK,
  LEGEND_CHECK,
  ...SANKEY_CHECKS,
];

// A shape's own issue, its box already checked: the kind is required, the rest optional.
export function shapeValidationIssue(el: Record<string, unknown>): ElementValidationIssue | null {
  return shapeIssue(el, SHAPE_FIELD_CHECKS);
}
