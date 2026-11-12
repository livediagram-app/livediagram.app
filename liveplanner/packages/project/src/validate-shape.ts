// The shape element's field checks (validate.ts): its kind, the bounded data arrays of charts and
// rails, and the closed sets and bounded rows of the content-carrying and collaborative kinds. Each
// check names its field and rule, so a refusal says which value to fix.
// The helpers and the checks two or more products hold the same way are
// @liveworkspace/element-model/shape-field-checks; this list keeps this product's order and its own checks.

import {
  isPlanViewSettings,
  isSavedBoardFilters,
  isValidItemId,
  normaliseBoardSetup,
} from '@liveplanner/items';
import { isPlanSheetRef } from './element-types';
import { isChartSource, isSheetAnchor } from './chart-source';
import { isPickerSource, isSessionTool } from './behaviour-config';
import { RESPONSES_MAX, RESPONSE_VALUE_MAX } from './responses';
import { COLLAB_ROUND_MAX, COMMENTS_MAX, isComment } from './element-deltas';
import { CELL_THREADS_MAX, isCellKey } from './cell-comments';
import {
  DECISION_MAX_DRIVERS,
  DECISION_MAX_TEXT,
  isDecisionDate,
  isDecisionStatus,
} from './collab-shapes';
import {
  type ElementValidationIssue,
  type FieldCheck,
  arrayRule,
  isBool,
  isNonEmptyStr,
  isNum,
  oneOfRule,
  stringRule,
} from '@liveworkspace/model-core/validate-primitives';
import { isRecord } from '@liveworkspace/model-core/is-record';
import {
  isStrUpTo,
  rowsOf,
  dataArray,
  flag,
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

// A Plan card's sizes (PlanCardRef.size): the same two as @liveplanner/items' CARD_SIZES, written out because
// that package imports this one and its binding may be uninitialised at module load; plan-shapes.test.ts keeps
// the two equal.
export const PLAN_CARD_SIZES: readonly string[] = ['minimal', 'detailed'];
// The retired Compact size, still stored on older cards and sent by older prompts: valid, never refused, and read as
// Detailed (docs/specs/026-plan/plan-board.md "The Plan card").
const PLAN_CARD_RETIRED_SIZES: readonly string[] = ['compact'];

// Per-participant responses (docs/specs/012-collaboration/participant-responses.md). The
// one-per-participant rule is `setResponse`'s on write, not a load check: a duplicate from an older
// client renders as the first entry rather than failing the tab.
const isResponse = (r: unknown) =>
  isRecord(r) &&
  typeof r.participantId === 'string' &&
  isStrUpTo(RESPONSE_VALUE_MAX)(r.value) &&
  isNum(r.at);

// A Sheet's cell threads (docs/specs/029-sheets/sheet.md "Cell comments"): at most CELL_THREADS_MAX, each keyed
// by a cell key and holding a thread as an element's.
const isCellCommentThreads = (v: unknown): boolean => {
  if (!isRecord(v)) return false;
  const entries = Object.entries(v);
  return (
    entries.length <= CELL_THREADS_MAX &&
    entries.every(
      ([key, t]) =>
        isCellKey(key) &&
        isRecord(t) &&
        isBool(t.resolved) &&
        rowsOf(COMMENTS_MAX, isComment)(t.comments),
    )
  );
};

// Session button (docs/specs/012-collaboration/session-button.md): a known tool. Durations are clamped
// where read (sessionButtonPlan), so they are not a load check.
const isSession = (v: unknown) => isRecord(v) && isSessionTool(v.tool);

// Absent passes every check; a present value must satisfy its rule. Ids that point at nothing
// (`portalTarget`, `mindParentId`, `windowTabId`) are legal: the element renders unpaired or as a root.
const SHAPE_FIELD_CHECKS: readonly FieldCheck[] = [
  { field: 'titleOrientation', valid: (v) => v === 'upright', rule: oneOfRule(['upright']) },
  ...chartRowChecks(),
  { field: 'portalTarget', valid: isNonEmptyStr, rule: 'an element id' },
  // A tab id that is gone is legal too: the window says its tab is not available.
  { field: 'windowTabId', valid: isNonEmptyStr, rule: 'a tab id' },
  { field: 'session', valid: isSession, rule: 'a session with a known tool' },
  { field: 'pickerSource', valid: isPickerSource, rule: 'a picker source' },
  dataArray('pickerOptions'),
  ...CODE_CHECKS,
  ...MIND_FLOW_CHECKS,
  ...CHART_LOOK_CHECKS,
  ...FLOWCHART_CHECKS,
  ...CARD_CHECKS,
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
  {
    field: 'responses',
    valid: rowsOf(RESPONSES_MAX, isResponse),
    rule: arrayRule(RESPONSES_MAX, '{ participantId, value, at } responses'),
  },
  { field: 'collabRound', valid: isStrUpTo(COLLAB_ROUND_MAX), rule: stringRule(COLLAB_ROUND_MAX) },
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
  CHECKLIST_CHECK,
  {
    field: 'planBoard',
    // Saved filters are refused when malformed rather than read past (docs/specs/026-plan/board-widgets.md "Saved
    // filters"): at most 8, each an id, a name and what it narrows by.
    valid: (v: unknown) =>
      normaliseBoardSetup(v) !== null &&
      ((v as { savedFilters?: unknown }).savedFilters === undefined ||
        isSavedBoardFilters((v as { savedFilters?: unknown }).savedFilters)),
    rule: 'a Plan board set-up: 1 to 12 columns, each an id and a status, and at most 8 saved filters',
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
        PLAN_CARD_SIZES.includes((v as { size: string }).size) ||
        PLAN_CARD_RETIRED_SIZES.includes((v as { size: string }).size)),
    rule: 'an object { itemId, size? } naming an item, size minimal or detailed',
  },
  {
    field: 'planView',
    // Called, not referenced: @liveplanner/items imports this package too, so at module load the binding
    // may not be initialised yet (a ReferenceError in the browser).
    valid: (v: unknown) => isPlanViewSettings(v),
    rule: 'an object { view } naming a plan view, with an optional types (1 to 32 card type ids), swimlaneBy, swimlaneField, namesWidth (120 to 2000), rowOrder (up to 2000 card ids), filters (up to 8), statuses (1 to 64 status ids), startField, dueField and measure (field ids, up to 64 characters each) and title (up to 80 characters)',
  },
  {
    field: 'chartSource',
    valid: (v: unknown) => isChartSource(v),
    rule: 'an object { sheetId, range: { r1, c1, r2, c2 } } naming a sheet of the plan and row and column ids',
  },
  {
    field: 'sheetAnchor',
    valid: (v: unknown) => isSheetAnchor(v),
    rule: 'an object { x, y }, each 0 to 1000000: where the chart sits in its Sheet, in px from the corner of its cells',
  },
  {
    field: 'planSheet',
    valid: (v: unknown) => isPlanSheetRef(v),
    rule: 'an object { sheetId } naming a sheet of the plan',
  },
  {
    field: 'cellComments',
    valid: isCellCommentThreads,
    rule: `an object of at most ${CELL_THREADS_MAX} comment threads keyed by cell (rowId:colId)`,
  },
  LEGEND_CHECK,
  ...SANKEY_CHECKS,
];

// A shape's own issue, its box already checked: the kind is required, the rest optional.
export function shapeValidationIssue(el: Record<string, unknown>): ElementValidationIssue | null {
  return shapeIssue(el, SHAPE_FIELD_CHECKS);
}
