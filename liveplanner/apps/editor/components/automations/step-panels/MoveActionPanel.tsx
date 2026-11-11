'use client';

// Move to Column (docs/specs/026-plan/automations.md "Actions"): one of the plan's columns, by status.

import type { AutomationAction } from '@liveplanner/items';
import type { AutomationOutline } from '../automation-outline';
import { PanelField, PanelSelect } from './panel-parts';

export function MoveActionPanel({
  action,
  onChange,
  outline,
}: {
  action: AutomationAction & { kind: 'move' };
  onChange: (next: AutomationAction) => void;
  outline: AutomationOutline;
}) {
  const known = outline.columns.some((c) => c.status === action.status);
  return (
    <PanelField label="Column">
      {(id) => (
        <PanelSelect
          id={id}
          value={action.status}
          onChange={(e) => onChange({ kind: 'move', status: e.target.value })}
        >
          {known ? null : <option value={action.status}>A column no longer here</option>}
          {outline.columns.map((c) => (
            <option key={c.status} value={c.status}>
              {c.name}
            </option>
          ))}
        </PanelSelect>
      )}
    </PanelField>
  );
}
