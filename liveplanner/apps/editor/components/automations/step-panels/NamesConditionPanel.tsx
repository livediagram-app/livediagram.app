'use client';

// The Card Type and Column conditions (docs/specs/026-plan/automations.md "Conditions"): is or is not one of the
// plan's card types, or one of its columns by status.

import type { AutomationCondition } from '@liveplanner/items';
import type { AutomationOutline } from '../automation-outline';
import { ChipToggles, IsNotPicker } from './panel-parts';

type NamesCondition = AutomationCondition & { kind: 'type' | 'column' };

export function NamesConditionPanel({
  condition,
  onChange,
  outline,
}: {
  condition: NamesCondition;
  onChange: (next: AutomationCondition) => void;
  outline: AutomationOutline;
}) {
  const setNot = (not: boolean) => {
    const { not: _, ...rest } = condition;
    onChange(not ? { ...rest, not: true } : rest);
  };
  return (
    <div className="flex flex-col gap-4">
      <IsNotPicker not={!!condition.not} onChange={setNot} />
      {condition.kind === 'type' ? (
        <ChipToggles
          label="Card Types"
          options={outline.types.map((t) => ({ value: t.id, label: t.label }))}
          value={condition.types}
          onChange={(types) => onChange({ ...condition, types })}
        />
      ) : (
        <ChipToggles
          label="Columns"
          options={outline.columns.map((c) => ({ value: c.status, label: c.name }))}
          value={condition.statuses}
          onChange={(statuses) => onChange({ ...condition, statuses })}
        />
      )}
    </div>
  );
}
