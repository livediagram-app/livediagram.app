'use client';

// Set Field and Clear Field (docs/specs/026-plan/automations.md "Actions"): a field of the card, and for Set Field
// what it is set to: text with values, a number, a day (Today shifted), or another field's value. A field of fixed
// values (Priority, a Choice field) is set to one of them, picked, or to another field's value. Set Field leaves out
// Flagged and Checklist, which Flag, Unflag and Add a Checklist set.

import {
  PRIORITIES,
  PRIORITY_LABELS,
  type AutomationAction,
  type AutomationSetValue,
} from '@liveplanner/items';
import { TextInput } from '@liveplanner/ui';
import { outlineFields, type AutomationOutline, type OutlineField } from '../automation-outline';
import { fieldClass } from '../field-kinds';
import { ValueTextField } from '../ValueInsert';
import { PanelField, PanelSelect, TodayShift } from './panel-parts';

type FieldAction = AutomationAction & { kind: 'set_field' | 'clear_field' };
type SetFrom = 'text' | 'number' | 'date' | 'from';

type Choice = { value: string; label: string };

// The built-in fields Set Field leaves to their own actions (Flag and Unflag, Add a Checklist).
const OWN_ACTION_FIELDS: ReadonlySet<string> = new Set(['flagged', 'checklist']);

/** A field's fixed values, as Set Field offers them: Priority's four, a Choice field's options; null for the rest. */
export function fieldChoices(
  field: OutlineField | undefined,
  types: AutomationOutline['types'],
): Choice[] | null {
  if (!field) return null;
  if (field.id === 'priority')
    return PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }));
  if (field.kind !== 'choice') return null;
  for (const t of types) {
    const def = t.custom?.find((f) => f.id === field.id);
    if (def?.options?.length) return def.options.map((o) => ({ value: o, label: o }));
  }
  return null;
}

// A text value a choice field keeps: the one it holds when it is a choice, else its first choice.
const choiceText = (text: string, choices: readonly Choice[]): string =>
  choices.some((c) => c.value === text) ? text : (choices[0]?.value ?? '');

const fromOf = (v: AutomationSetValue): SetFrom =>
  'number' in v ? 'number' : 'date' in v ? 'date' : 'from' in v ? 'from' : 'text';

function freshValue(from: SetFrom, fieldIds: readonly string[]): AutomationSetValue {
  switch (from) {
    case 'number':
      return { number: 0 };
    case 'date':
      return { date: { today: 0 } };
    case 'from':
      return { from: fieldIds[0] ?? '' };
    case 'text':
      return { text: '' };
  }
}

export function FieldActionPanel({
  action,
  onChange,
  outline,
  invalid,
  branch = false,
}: {
  action: FieldAction;
  onChange: (next: AutomationAction) => void;
  outline: AutomationOutline;
  invalid: boolean;
  // Inside a branch: the triggering card's values join Insert a Value.
  branch?: boolean;
}) {
  const all = outlineFields(outline.types);
  // Set Field offers what it can set; the field a step holds stays listed.
  const fields =
    action.kind === 'set_field'
      ? all.filter((f) => !OWN_ACTION_FIELDS.has(f.id) || f.id === action.field)
      : all;
  const field = fields.find((f) => f.id === action.field);
  const cls = fieldClass(field?.kind ?? 'text');
  const choices = fieldChoices(field, outline.types);
  const fieldPicker = (
    <PanelField label="Field">
      {(id) => (
        <PanelSelect
          id={id}
          value={action.field}
          onChange={(e) => {
            const id = e.target.value;
            if (action.kind === 'clear_field') return onChange({ kind: 'clear_field', field: id });
            // A field of fixed values starts on one of them, never on text it cannot take.
            const next = fieldChoices(
              fields.find((f) => f.id === id),
              outline.types,
            );
            const value =
              next && 'text' in action.value
                ? { text: choiceText(action.value.text, next) }
                : action.value;
            onChange({ ...action, field: id, value });
          }}
        >
          {field ? null : (
            <option value={action.field}>
              {action.field ? 'A field no longer here' : 'Pick a field'}
            </option>
          )}
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </PanelSelect>
      )}
    </PanelField>
  );
  if (action.kind === 'clear_field')
    return <div className="flex flex-col gap-4">{fieldPicker}</div>;
  const value = action.value;
  const from = fromOf(value);
  return (
    <div className="flex flex-col gap-4">
      {fieldPicker}
      <PanelField label="Set To">
        {(id) => (
          <PanelSelect
            id={id}
            value={from}
            onChange={(e) =>
              onChange({
                ...action,
                value:
                  choices && e.target.value === 'text'
                    ? { text: choices[0]?.value ?? '' }
                    : freshValue(
                        e.target.value as SetFrom,
                        fields.map((f) => f.id),
                      ),
              })
            }
          >
            {choices ? (
              <option value="text">A Choice</option>
            ) : (
              <>
                <option value="text">Text</option>
                <option value="number">A Number</option>
                <option value="date">A Day</option>
              </>
            )}
            {/* A step saved with a number or a day on a field of choices still reads as what it holds. */}
            {choices && from === 'number' ? <option value="number">A Number</option> : null}
            {choices && from === 'date' ? <option value="date">A Day</option> : null}
            <option value="from">Another Field’s Value</option>
          </PanelSelect>
        )}
      </PanelField>
      {'text' in value && choices ? (
        <PanelField label="Choice">
          {(id) => (
            <PanelSelect
              id={id}
              value={value.text}
              onChange={(e) => onChange({ ...action, value: { text: e.target.value } })}
            >
              {/* Text a step holds that is no choice (a value, an old option) stays shown as it is. */}
              {choices.some((c) => c.value === value.text) ? null : (
                <option value={value.text}>{value.text || 'Pick a choice'}</option>
              )}
              {choices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </PanelSelect>
          )}
        </PanelField>
      ) : 'text' in value ? (
        <ValueTextField
          label="Text"
          multiline={false}
          value={value.text}
          fields={fields}
          invalid={invalid}
          branch={branch}
          hint={cls === 'list' ? 'Labels or values, separated by commas.' : undefined}
          onChange={(text) => onChange({ ...action, value: { text } })}
        />
      ) : null}
      {'number' in value ? (
        <PanelField label="Number">
          {(id) => (
            <TextInput
              compact
              id={id}
              type="number"
              value={String(value.number)}
              onChange={(e) =>
                onChange({ ...action, value: { number: Number(e.target.value) || 0 } })
              }
            />
          )}
        </PanelField>
      ) : null}
      {'date' in value ? (
        'today' in value.date ? (
          <TodayShift
            label="Today, shifted by"
            days={value.date.today}
            onChange={(today) => onChange({ ...action, value: { date: { today } } })}
          />
        ) : (
          <PanelField label="Day">
            {(id) => (
              <TextInput
                compact
                id={id}
                type="date"
                value={'day' in value.date ? value.date.day : ''}
                onChange={(e) => onChange({ ...action, value: { date: { day: e.target.value } } })}
              />
            )}
          </PanelField>
        )
      ) : null}
      {'from' in value ? (
        <PanelField label="From Field">
          {(id) => (
            <PanelSelect
              id={id}
              value={value.from}
              onChange={(e) => onChange({ ...action, value: { from: e.target.value } })}
            >
              {fields.some((f) => f.id === value.from) ? null : (
                <option value={value.from}>
                  {value.from ? 'A field no longer here' : 'Pick a field'}
                </option>
              )}
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </PanelSelect>
          )}
        </PanelField>
      ) : null}
    </div>
  );
}
