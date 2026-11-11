'use client';

// Set Field and Clear Field (docs/specs/026-plan/automations.md "Actions"): a field of the card, and for Set Field
// what it is set to: text with values, a number, a day (Today shifted), or another field's value.

import type { AutomationAction, AutomationSetValue } from '@liveplanner/items';
import { TextInput } from '@liveplanner/ui';
import { outlineFields, type AutomationOutline } from '../automation-outline';
import { fieldClass } from '../field-kinds';
import { ValueTextField } from '../ValueInsert';
import { PanelField, PanelSelect, TodayShift } from './panel-parts';

type FieldAction = AutomationAction & { kind: 'set_field' | 'clear_field' };
type SetFrom = 'text' | 'number' | 'date' | 'from';

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
  const fields = outlineFields(outline.types);
  const field = fields.find((f) => f.id === action.field);
  const cls = fieldClass(field?.kind ?? 'text');
  const fieldPicker = (
    <PanelField label="Field">
      {(id) => (
        <PanelSelect
          id={id}
          value={action.field}
          onChange={(e) =>
            onChange(
              action.kind === 'clear_field'
                ? { kind: 'clear_field', field: e.target.value }
                : { ...action, field: e.target.value },
            )
          }
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
                value: freshValue(
                  e.target.value as SetFrom,
                  fields.map((f) => f.id),
                ),
              })
            }
          >
            <option value="text">Text</option>
            <option value="number">A Number</option>
            <option value="date">A Day</option>
            <option value="from">Another Field’s Value</option>
          </PanelSelect>
        )}
      </PanelField>
      {'text' in value ? (
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
