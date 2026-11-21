'use client';

// A condition's panel (docs/specs/026-plan/automations.md "Conditions"): its kind (changing it starts that kind
// afresh), then the kind's own fields.

import type { AutomationCondition } from '@liveplanner/items';
import type { AutomationOutline } from '../automation-outline';
import { FieldConditionPanel } from './FieldConditionPanel';
import { NamesConditionPanel } from './NamesConditionPanel';
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
  // The Condition row above these fields, which changes its kind, is the platform's (StepPanel).
  return body;
}
