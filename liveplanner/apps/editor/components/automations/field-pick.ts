// Set Field's fixed values (docs/specs/026-plan/automations.md "Actions"): a field of fixed values is set to one of
// them, picked: Priority and a Choice field to a value, the Assignee and a Person field to one of the plan's people
// (kept by id, shown by name), a Checkbox to Yes or No. The panel offers them and a new step starts on the first.
// Pure.

import { PRIORITIES, PRIORITY_LABELS } from '@liveplanner/items';
import type { AutomationOutline, OutlineField } from './automation-outline';

export type Choice = { value: string; label: string };

// A field of fixed values: its values, the Set To option and the select's label, and what text it holds that is no
// value reads as (a value filled in, an old option or name as it is; a person picked who has left in words).
export type FieldPick = {
  choices: Choice[];
  option: string;
  label: string;
  empty: string;
  kept: (text: string) => string;
};

const asIs = (text: string) => text;

// The built-in fields Set Field leaves to their own actions (Flag and Unflag, Add a Checklist).
export const OWN_ACTION_FIELDS: ReadonlySet<string> = new Set(['flagged', 'checklist']);

const pickOf = (choices: Choice[]): FieldPick => ({
  choices,
  option: 'A Choice',
  label: 'Choice',
  empty: 'Pick a choice',
  kept: asIs,
});

/** A field's fixed values, as Set Field offers them: Priority's four, a Choice field's options, the plan's people
 *  for a Person field, Yes and No for a Checkbox; null for the rest. */
export function fieldPick(
  field: OutlineField | undefined,
  outline: Pick<AutomationOutline, 'types' | 'people'>,
): FieldPick | null {
  if (!field) return null;
  if (field.id === 'priority')
    return pickOf(PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] })));
  if (field.kind === 'person')
    return {
      choices: outline.people.map((p) => ({ value: p.id, label: p.name })),
      option: 'A Person',
      label: 'Person',
      empty: 'Pick a person',
      // A name an agent wrote stays as it is; any other picked text is someone who has left.
      kept: (text) =>
        text.includes('{{') ||
        outline.people.some((p) => p.name.toLowerCase() === text.toLowerCase())
          ? text
          : 'Someone No Longer Here',
    };
  if (field.kind === 'checkbox')
    return {
      choices: [
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' },
      ],
      option: 'Yes or No',
      label: 'Value',
      empty: 'Pick Yes or No',
      kept: asIs,
    };
  if (field.kind !== 'choice') return null;
  for (const t of outline.types) {
    const def = t.custom?.find((f) => f.id === field.id);
    if (def?.options?.length) return pickOf(def.options.map((o) => ({ value: o, label: o })));
  }
  return null;
}
