// The shape element's field checks (validate.ts): its kind, the bounded data arrays of charts and
// rails, and the closed sets and bounded rows of the content-carrying kinds. Each
// check names its field and rule, so a refusal says which value to fix.
// The helpers and the checks two or more products hold the same way are
// @liveworkspace/element-model/shape-field-checks; this list keeps this product's order and its own checks.

import { INSTANCE_FIELD_CHECKS } from './component-fields';
import {
  type ElementValidationIssue,
  type FieldCheck,
  isNonEmptyStr,
} from '@liveworkspace/model-core/validate-primitives';
import {
  flag,
  chartRowChecks,
  CODE_CHECKS,
  CHART_LOOK_CHECKS,
  CARD_CHECKS,
  POINTER_TIP_CHECK,
  STACK_CHECKS,
  CONCEPT_CHECKS,
  TAGS_CHECK,
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

// Absent passes every check; a present value must satisfy its rule. Ids that point at nothing
// (`windowTabId`, `attachedTo`) are legal: the element renders unpaired.
const SHAPE_FIELD_CHECKS: readonly FieldCheck[] = [
  ...chartRowChecks(),
  // A tab id that is gone is legal too: the window says its tab is not available.
  { field: 'windowTabId', valid: isNonEmptyStr, rule: 'a tab id' },
  // An instance (docs/specs/009-elements/components.md): a main that is gone is legal; it draws as missing.
  ...INSTANCE_FIELD_CHECKS,
  ...CODE_CHECKS,
  ...CHART_LOOK_CHECKS,
  ...CARD_CHECKS,
  flag('stepSequence'),
  POINTER_TIP_CHECK,
  ...STACK_CHECKS,
  flag('hubSpokes'),
  ...CONCEPT_CHECKS,
  TAGS_CHECK,
  STATS_CHECK,
  ...WEB_LIST_CHECKS,
  CHECKLIST_CHECK,
  LEGEND_CHECK,
  ...SANKEY_CHECKS,
];

// A shape's own issue, its box already checked: the kind is required, the rest optional.
export function shapeValidationIssue(el: Record<string, unknown>): ElementValidationIssue | null {
  return shapeIssue(el, SHAPE_FIELD_CHECKS);
}
