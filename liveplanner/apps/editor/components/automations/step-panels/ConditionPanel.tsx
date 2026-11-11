'use client';

// A condition's panel (docs/specs/026-plan/automations.md "Conditions"): its kind (changing it starts that kind
// afresh), then the kind's own fields.

import { AUTOMATION_CONDITION_NAMES, type AutomationCondition } from '@liveplanner/items';
import type { AutomationOutline } from '../automation-outline';
import { CONDITION_KINDS, defaultCondition } from '../step-defaults';
import { FieldConditionPanel } from './FieldConditionPanel';
import { NamesConditionPanel } from './NamesConditionPanel';
import { PanelField, PanelSelect } from './panel-parts';
import { SavedFilterConditionPanel } from './SavedFilterConditionPanel';
import { WhoConditionPanel } from './WhoConditionPanel';

export function ConditionPanel({
  condition,
  onChange,
  outline,
}: {
  condition: AutomationCondition;
  onChange: (next: AutomationCondition) => void;
  outline: AutomationOutline;
}) {
  const body = (() => {
    switch (condition.kind) {
      case 'type':
      case 'column':
        return <NamesConditionPanel condition={condition} onChange={onChange} outline={outline} />;
      case 'field':
        return <FieldConditionPanel condition={condition} onChange={onChange} outline={outline} />;
      case 'who':
        return <WhoConditionPanel condition={condition} onChange={onChange} outline={outline} />;
      case 'saved_filter':
        return (
          <SavedFilterConditionPanel condition={condition} onChange={onChange} outline={outline} />
        );
    }
  })();
  return (
    <div className="flex flex-col gap-4">
      <PanelField label="Condition">
        {(id) => (
          <PanelSelect
            id={id}
            value={condition.kind}
            onChange={(e) =>
              onChange(defaultCondition(e.target.value as AutomationCondition['kind'], outline))
            }
          >
            {CONDITION_KINDS.map((k) => (
              <option key={k} value={k}>
                {AUTOMATION_CONDITION_NAMES[k]}
              </option>
            ))}
          </PanelSelect>
        )}
      </PanelField>
      {body}
    </div>
  );
}
