// The shape element's field checks (validate.ts): its kind, the bounded data arrays of charts and
// rails, and the closed sets and bounded rows of the content-carrying kinds. Each
// check names its field and rule, so a refusal says which value to fix.
// The helpers and the checks two or more products hold the same way are
// @liveworkspace/element-model/shape-field-checks; this list keeps this product's order and its own checks.

import { STAT_CHANGE_MAX, STATS_MAX, WEB_TEXT_MAX } from './web-components';
import { QUOTE_LOOKS } from './quote';
import {
  type ElementValidationIssue,
  type FieldCheck,
  arrayRule,
  isNonEmptyStr,
} from '@liveworkspace/model-core/validate-primitives';
import { isRecord } from '@liveworkspace/model-core/is-record';
import {
  isMapCode,
  isMapPin,
  MAP_HIGHLIGHTS_MAX,
  MAP_LAT_MAX,
  MAP_PIN_LABEL_MAX,
  MAP_PINS_MAX,
  MAP_REGIONS,
} from './map-model';
import {
  isBoundedStr,
  isOptionalStrUpTo,
  rowsOf,
  flag,
  oneOf,
  chartRowChecks,
  CODE_CHECKS,
  CHART_LOOK_CHECKS,
  CARD_CHECKS,
  POINTER_TIP_CHECK,
  STACK_CHECKS,
  CONCEPT_CHECKS,
  TAGS_CHECK,
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
  ...CODE_CHECKS,
  ...CHART_LOOK_CHECKS,
  ...CARD_CHECKS,
  flag('stepSequence'),
  POINTER_TIP_CHECK,
  ...STACK_CHECKS,
  flag('hubSpokes'),
  ...CONCEPT_CHECKS,
  TAGS_CHECK,
  {
    field: 'stats',
    valid: rowsOf(
      STATS_MAX,
      (s) =>
        isRecord(s) &&
        isBoundedStr(s.value) &&
        isBoundedStr(s.caption) &&
        isOptionalStrUpTo(s.change, STAT_CHANGE_MAX),
    ),
    rule: arrayRule(
      STATS_MAX,
      `{ value, caption, change? } rows of ${WEB_TEXT_MAX} characters (a change ${STAT_CHANGE_MAX})`,
    ),
  },
  // A stat row's count-up switch (docs/specs/009-elements/stat-row.md).
  flag('statCountUp'),
  // The quote (docs/specs/009-elements/quote.md): its look and its portrait's photo.
  oneOf('quoteLook', QUOTE_LOOKS),
  { field: 'imageId', valid: isNonEmptyStr, rule: 'an image id' },
  ...WEB_LIST_CHECKS,
  CHECKLIST_CHECK,
  LEGEND_CHECK,
  ...SANKEY_CHECKS,
  // Map (docs/specs/009-elements/map.md "Model").
  oneOf('mapRegion', MAP_REGIONS),
  { field: 'mapCountry', valid: isMapCode, rule: 'a country code of 2 or 3 capital letters' },
  {
    field: 'mapHighlights',
    valid: rowsOf(MAP_HIGHLIGHTS_MAX, isMapCode),
    rule: arrayRule(MAP_HIGHLIGHTS_MAX, 'country codes of 2 or 3 capital letters'),
  },
  {
    field: 'mapPins',
    valid: rowsOf(MAP_PINS_MAX, isMapPin),
    rule: arrayRule(
      MAP_PINS_MAX,
      `{ id, lat (-${MAP_LAT_MAX} to ${MAP_LAT_MAX}), lon (-180 to 180), label? (${MAP_PIN_LABEL_MAX} characters) } rows`,
    ),
  },
];

// A shape's own issue, its box already checked: the kind is required, the rest optional.
export function shapeValidationIssue(el: Record<string, unknown>): ElementValidationIssue | null {
  return shapeIssue(el, SHAPE_FIELD_CHECKS);
}
