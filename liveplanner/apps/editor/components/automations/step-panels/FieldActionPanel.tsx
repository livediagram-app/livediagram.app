'use client';

// Set Field and Clear Field (docs/specs/026-plan/automations.md "Actions"): a field of the card, and for Set Field
// what it is set to: text with values, a number, a day (Today shifted), or another field's value. A field of fixed
// values is set to one of them, picked, or to another field's value: Priority and a Choice field to a value, the
// Assignee and a Person field to one of the plan's people (kept by id, shown by name, as Assign's pick is), a
// Checkbox to Yes or No. Set Field leaves out Flagged and Checklist, which Flag, Unflag and Add a Checklist set, and
// both leave out the fields no write changes.

import { type AutomationAction, type AutomationSetValue } from '@liveplanner/items';
import { TextInput } from '@liveplanner/ui';
import { fieldChangeFields, outlineFields, type AutomationOutline } from '../automation-outline';
import { fieldPick, OWN_ACTION_FIELDS, startText, type Choice } from '../field-pick';
import { fieldClass } from '../field-kinds';
import { ValueTextField } from '../ValueInsert';
import { PanelField, PanelSelect, TodayShift } from './panel-parts';

type FieldAction = AutomationAction & { kind: 'set_field' | 'clear_field' };
type SetFrom = 'text' | 'number' | 'date' | 'from';

// A text value a choice field keeps: the one it holds when it is a choice, else its first choice.
const choiceText = (text: string, choices: readonly Choice[]): string =>
  choices.some((c) => c.value === text) ? text : (choices[0]?.value ?? '');

const fromOf = (v: AutomationSetValue): SetFrom =>
  'number' in v ? 'number' : 'date' in v ? 'date' : 'from' in v ? 'from' : 'text';

type Field = Parameters<typeof startText>[0];
type PickOutline = Parameters<typeof startText>[1];

/** What Set Field on `field` starts on afresh: a date on Today, a number on 0, any other as startText says. */
export function startValue(field: Field, outline: PickOutline): AutomationSetValue {
  if (!fieldPick(field, outline)) {
    const cls = fieldClass(field?.kind ?? 'text');
    if (cls === 'date') return { date: { today: 0 } };
    if (cls === 'number') return { number: 0 };
  }
  return { text: startText(field, outline) };
}

/** Whether `value` already suits `field`: the form startValue would give it (a day for a date, a number for a
 *  number), or text for a text field, or one of a field of fixed values' own. */
export function fitsField(value: AutomationSetValue, field: Field, outline: PickOutline): boolean {
  if (!field) return false;
  const pick = fieldPick(field, outline);
  if (pick) return 'text' in value && pick.choices.some((c) => c.value === value.text);
  const start = startValue(field, outline);
  return fromOf(value) === fromOf(start);
}

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
  // The fields a write changes (never Time Spent, a Votes tally, a Comments field or a Calculated value), less, for
  // Set Field, those with their own actions; the field a step holds stays listed.
  const writable = new Set(fieldChangeFields(outline.types).map((f) => f.id));
  const held = (id: string) =>
    id === action.field ||
    (action.kind === 'set_field' && 'from' in action.value && id === action.value.from);
  const fields = outlineFields(outline.types).filter(
    (f) =>
      held(f.id) ||
      (writable.has(f.id) && !(action.kind === 'set_field' && OWN_ACTION_FIELDS.has(f.id))),
  );
  const field = fields.find((f) => f.id === action.field);
  const cls = fieldClass(field?.kind ?? 'text');
  const fixed = fieldPick(field, outline);
  const choices = fixed?.choices ?? null;
  const fieldPicker = (
    <PanelField label="Field">
      {(id) => (
        <PanelSelect
          id={id}
          value={action.field}
          onChange={(e) => {
            const id = e.target.value;
            if (action.kind === 'clear_field') return onChange({ kind: 'clear_field', field: id });
            // A field of another kind starts afresh, as a new step's does (Priority's "low" never carries to Labels);
            // one of the same kind keeps its value, a field of fixed values only one of its own. Another field's
            // value is kept either way.
            const nextField = fields.find((f) => f.id === id);
            const next = fieldPick(nextField, outline);
            // No field held yet (a template's, left for you): a value that fits the one picked stays (Today on a date).
            const kept = !field && fitsField(action.value, nextField, outline);
            const value: AutomationSetValue =
              'from' in action.value || kept
                ? action.value
                : nextField?.kind !== field?.kind
                  ? startValue(nextField, outline)
                  : next && 'text' in action.value
                    ? { text: choiceText(action.value.text, next.choices) }
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
            {fixed ? (
              <option value="text">{fixed.option}</option>
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
      {'text' in value && fixed ? (
        <PanelField label={fixed.label}>
          {(id) => (
            <PanelSelect
              id={id}
              value={value.text}
              onChange={(e) => onChange({ ...action, value: { text: e.target.value } })}
            >
              {/* Text a step holds that is no choice (a value, an old option) stays shown as it is. */}
              {fixed.choices.some((c) => c.value === value.text) ? null : (
                <option value={value.text}>
                  {value.text ? fixed.kept(value.text) : fixed.empty}
                </option>
              )}
              {fixed.choices.map((c) => (
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
