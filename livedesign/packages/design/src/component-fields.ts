// The stored fields components add to elements (docs/specs/009-elements/blueprints/components.md "Interfaces and
// contracts"): an instance's main, overrides and edit session, and a session member's mark. Field checks only, with
// no import of the validator, so validate.ts and validate-shape.ts can take them at load without a cycle.
import {
  type FieldCheck,
  isNonEmptyStr,
  stringRule,
} from '@liveworkspace/model-core/validate-primitives';
import { isRecord } from '@liveworkspace/model-core/is-record';
import {
  COMPONENT_ID_MAX,
  COMPONENT_OVERRIDE_FIELDS,
  INSTANCE_ID_SEPARATOR,
  MAX_COMPONENT_OVERRIDES,
} from './components';
import { isElementKey } from './malformed-ids';

/** An override's text, at most. */
export const OVERRIDE_TEXT_MAX = 5_000;
/** An override's colour string, at most. */
export const OVERRIDE_COLOUR_MAX = 64;
/** A session's person key or a member's ids, at most. */
export const COMPONENT_KEY_MAX = 128;

const isStrUpTo = (max: number) => (v: unknown) => typeof v === 'string' && v.length <= max;
const isKey = (v: unknown) => isNonEmptyStr(v) && v.length <= COMPONENT_KEY_MAX;

/** A main's id: 1 to COMPONENT_ID_MAX characters, never holding the resolved-id separator. */
export function isComponentId(v: unknown): v is string {
  return isNonEmptyStr(v) && v.length <= COMPONENT_ID_MAX && !v.includes(INSTANCE_ID_SEPARATOR);
}

const OVERRIDE_KEYS = new Set<string>(COMPONENT_OVERRIDE_FIELDS);

/** One override: known keys only, each a bounded string (an icon an element key). */
export function isComponentOverride(v: unknown): boolean {
  if (!isRecord(v)) return false;
  for (const [k, value] of Object.entries(v)) {
    if (!OVERRIDE_KEYS.has(k)) return false;
    if (k === 'label') {
      if (!isStrUpTo(OVERRIDE_TEXT_MAX)(value)) return false;
    } else if (k === 'iconId') {
      if (!isElementKey(value)) return false;
    } else if (!isStrUpTo(OVERRIDE_COLOUR_MAX)(value)) return false;
  }
  return true;
}

/** An instance's overrides: a record of at most MAX_COMPONENT_OVERRIDES entries, each a valid override. */
export function isComponentOverrides(v: unknown): boolean {
  if (!isRecord(v)) return false;
  const entries = Object.entries(v);
  if (entries.length > MAX_COMPONENT_OVERRIDES) return false;
  return entries.every(([k, o]) => isKey(k) && isComponentOverride(o));
}

/** A session member's mark. */
export function isComponentMember(v: unknown): boolean {
  return isRecord(v) && isKey(v.instanceId) && isKey(v.elementId);
}

/** The instance's fields, checked on a shape. */
export const INSTANCE_FIELD_CHECKS: readonly FieldCheck[] = [
  { field: 'componentId', valid: isComponentId, rule: stringRule(COMPONENT_ID_MAX) },
  {
    field: 'componentOverrides',
    valid: isComponentOverrides,
    rule: `at most ${MAX_COMPONENT_OVERRIDES} overrides by element id, each of ${COMPONENT_OVERRIDE_FIELDS.join(', ')}`,
  },
  { field: 'componentEditBy', valid: isKey, rule: `a key of 1 to ${COMPONENT_KEY_MAX} characters` },
];

/** A member's mark, checked on every element. */
export const MEMBER_FIELD_CHECKS: readonly FieldCheck[] = [
  {
    field: 'componentMember',
    valid: isComponentMember,
    rule: `{ instanceId, elementId }, each 1 to ${COMPONENT_KEY_MAX} characters`,
  },
];
