'use client';

// Add Label and Remove Label (docs/specs/026-plan/automations.md "Actions"): a label the plan's cards use, or a new
// one typed in (the list offers the plan's labels).

import { useId } from 'react';
import type { AutomationAction } from '@liveplanner/items';
import { TextInput } from '@liveplanner/ui';
import type { AutomationOutline } from '../automation-outline';
import { PanelField } from './panel-parts';

export function LabelActionPanel({
  action,
  onChange,
  outline,
  invalid,
}: {
  action: AutomationAction & { kind: 'add_label' | 'remove_label' };
  onChange: (next: AutomationAction) => void;
  outline: AutomationOutline;
  invalid: boolean;
}) {
  const list = useId();
  return (
    <PanelField label="Label" hint="One of the plan’s labels, or a new one.">
      {(id) => (
        <>
          <TextInput
            compact
            id={id}
            list={list}
            value={action.label}
            maxLength={40}
            invalid={invalid}
            onChange={(e) => onChange({ ...action, label: e.target.value })}
          />
          <datalist id={list}>
            {outline.labels.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </>
      )}
    </PanelField>
  );
}
