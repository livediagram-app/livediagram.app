// Automations: the reading primitives the rule check is built from. They are @liveworkspace/automations'
// (liveworkspace/docs/specs/018-automations/blueprints/engine.md "The check"); here they are bound to what a plan's
// rule may hold: a text's values checked against the card value names (values.ts), and a day as a card's date field
// takes one (repeat-dates.ts). Pure.

import { day as readDay, text as readText, type AutomationDay } from '@liveworkspace/automations';
import { isDay } from '../repeat-dates';
import { unknownValueIn, type ValuePlace } from './values';

export {
  AUTOMATION_LIST_MAX,
  ID_MAX,
  Refused,
  clock,
  id,
  ids,
  isObj,
  not,
  obj,
  optionalIds,
  refuse,
  unsupported,
  whole,
  type Obj,
  type RuleRefusal,
} from '@liveworkspace/automations';

// Text a rule writes: within its bound, every value one the builder knows (a branch's knows the triggering card's).
export const text = (
  v: unknown,
  path: string,
  max: number,
  opts: { empty?: boolean } & ValuePlace = {},
): string =>
  readText(v, path, max, {
    ...(opts.empty ? { empty: true } : {}),
    unknownValue: (t) => unknownValueIn(t, opts),
  });

export const day = (v: unknown, path: string): AutomationDay => readDay(v, path, isDay);
