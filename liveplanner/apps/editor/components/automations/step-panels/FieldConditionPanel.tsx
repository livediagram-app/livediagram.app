'use client';

// The Field condition (docs/specs/026-plan/automations.md "Conditions"): a field of the card, how it compares (by
// what the field holds), and what with: text, a number, a day (a fixed day or today shifted), or nothing for empty.

import {
  AUTOMATION_FIELD_OP_WORDS,
  type AutomationCondition,
  type AutomationDay,
} from '@liveplanner/items';
import { TextInput } from '@liveplanner/ui';
import { outlineFields, type AutomationOutline } from '../automation-outline';
import { FLAG_OP_WORDS, fieldClass, isDateOp, opTakesValue, opsFor } from '../field-kinds';
import { PanelField, PanelSelect, TodayShift } from './panel-parts';

type FieldCondition = AutomationCondition & { kind: 'field' };

const isDay = (v: unknown): v is AutomationDay =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && ('today' in v || 'day' in v);

export function FieldConditionPanel({
  condition,
  onChange,
  outline,
}: {
  condition: FieldCondition;
  onChange: (next: AutomationCondition) => void;
  outline: AutomationOutline;
}) {
  const fields = outlineFields(outline.types);
  const field = fields.find((f) => f.id === condition.field);
  const cls = fieldClass(field?.kind ?? 'text');
  const ops = opsFor(cls);
  const words = (op: (typeof ops)[number]) =>
    (cls === 'flag' ? FLAG_OP_WORDS[op] : undefined) ?? AUTOMATION_FIELD_OP_WORDS[op];
  const value = condition.value;
  const day = isDay(value) ? value : { today: 0 };
  return (
    <div className="flex flex-col gap-4">
      <PanelField label="Field">
        {(id) => (
          <PanelSelect
            id={id}
            value={condition.field}
            onChange={(e) => {
              const next = fields.find((f) => f.id === e.target.value);
              const op = opsFor(fieldClass(next?.kind ?? 'text')).includes(condition.op)
                ? condition.op
                : 'not_empty';
              onChange({ kind: 'field', field: e.target.value, op });
            }}
          >
            {field ? null : <option value={condition.field}>A field no longer here</option>}
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </PanelSelect>
        )}
      </PanelField>
      <PanelField label="Compare">
        {(id) => (
          <PanelSelect
            id={id}
            value={condition.op}
            onChange={(e) => {
              const op = e.target.value as FieldCondition['op'];
              const base = { kind: 'field' as const, field: condition.field, op };
              if (!opTakesValue(op)) onChange(base);
              else if (isDateOp(op))
                onChange({ ...base, value: isDay(value) ? value : { today: 0 } });
              else
                onChange({
                  ...base,
                  value: typeof value === 'string' || typeof value === 'number' ? value : '',
                });
            }}
          >
            {ops.map((op) => (
              <option key={op} value={op}>
                {words(op)}
              </option>
            ))}
          </PanelSelect>
        )}
      </PanelField>
      {!opTakesValue(condition.op) ? null : isDateOp(condition.op) ? (
        'day' in day ? (
          <PanelField label="Day">
            {(id) => (
              <TextInput
                compact
                id={id}
                type="date"
                value={day.day}
                onChange={(e) => onChange({ ...condition, value: { day: e.target.value } })}
              />
            )}
          </PanelField>
        ) : (
          <TodayShift
            label="Today, shifted by"
            days={day.today}
            onChange={(today) => onChange({ ...condition, value: { today } })}
          />
        )
      ) : (
        <PanelField label="Value">
          {(id) => (
            <TextInput
              compact
              id={id}
              type={cls === 'number' ? 'number' : 'text'}
              value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
              onChange={(e) =>
                onChange({
                  ...condition,
                  value: cls === 'number' ? Number(e.target.value) || 0 : e.target.value,
                })
              }
            />
          )}
        </PanelField>
      )}
    </div>
  );
}
