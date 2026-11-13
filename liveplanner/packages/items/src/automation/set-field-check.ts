// Automations: a Set Field step checked against the plan's card types when a rule is saved (docs/specs/026-plan/
// automations.md "Actions"; blueprint automations.md "Files"). A Checkbox field (Flagged and Archived too) is set to
// Yes or No, or from a value filled in or another field: any other text, a number, a day or a list is refused,
// naming the field and the step, as readRuleBody refuses a part. The api reads the plan's types only for a rule that
// holds a Set Field. Pure.

import type { ItemTypeDef } from '../item-types';
import { typeFieldLabel } from '../built-in-field-labels';
import type { AutomationAction, AutomationRuleBody, AutomationStep } from './types';
import { checkboxOf, fieldKind } from './set-value';

type SetField = Extract<AutomationAction, { kind: 'set_field' }>;

// Each Set Field in the rule, with its path as a refusal names it ("steps.2.then.0").
function setFieldsOf(steps: readonly AutomationStep[]): { a: SetField; path: string }[] {
  const out: { a: SetField; path: string }[] = [];
  const add = (a: AutomationStep, path: string) => {
    if (a.kind === 'set_field') out.push({ a, path });
  };
  steps.forEach((s, i) => {
    if (s.kind === 'if') {
      s.then.forEach((a, j) => add(a, `steps.${i}.then.${j}`));
      s.else.forEach((a, j) => add(a, `steps.${i}.else.${j}`));
    } else if (s.kind === 'for') s.then.forEach((a, j) => add(a, `steps.${i}.then.${j}`));
    else add(s, `steps.${i}`);
  });
  return out;
}

/** Whether the rule holds a Set Field anywhere (so its save reads the plan's types). */
export const ruleSetsFields = (rule: AutomationRuleBody): boolean =>
  setFieldsOf(rule.steps).length > 0;

/** The first Set Field whose value its field can never hold, as a refusal; null when every one can. */
export function setFieldRefusal(
  rule: AutomationRuleBody,
  types: readonly Pick<ItemTypeDef, 'custom'>[],
): { path: string; message: string } | null {
  for (const { a, path } of setFieldsOf(rule.steps)) {
    const def = types.flatMap((t) => t.custom ?? []).find((f) => f.id === a.field);
    if (fieldKind(a.field, def) !== 'checkbox' || 'from' in a.value) continue;
    const text = 'text' in a.value ? a.value.text : null;
    if (text !== null && (text.includes('{{') || checkboxOf(text) !== undefined)) continue;
    return {
      path: `${path}.value`,
      message: `${def?.label ?? typeFieldLabel(undefined, a.field)} is a Checkbox: set it to Yes or No`,
    };
  }
  return null;
}
