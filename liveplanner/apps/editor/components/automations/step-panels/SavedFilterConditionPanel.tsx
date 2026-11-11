'use client';

// The Matches a Saved Filter condition (docs/specs/026-plan/automations.md "Conditions"): one of a board's saved
// filters, applied as the person who made the change would see it.

import type { AutomationCondition } from '@liveplanner/items';
import type { AutomationOutline } from '../automation-outline';
import { PanelField, PanelNote, PanelSelect } from './panel-parts';

type SavedFilterCondition = AutomationCondition & { kind: 'saved_filter' };

export function SavedFilterConditionPanel({
  condition,
  onChange,
  outline,
}: {
  condition: SavedFilterCondition;
  onChange: (next: AutomationCondition) => void;
  outline: AutomationOutline;
}) {
  const boards = outline.boards.filter((b) => b.filters.length > 0);
  if (boards.length === 0)
    return (
      <PanelNote>
        No board in this plan has a saved filter yet. Save one from a board’s Filter.
      </PanelNote>
    );
  return (
    <PanelField label="Saved Filter" hint="Applied as the person who made the change would see it.">
      {(id) => (
        <PanelSelect
          id={id}
          value={`${condition.tab}\u0000${condition.filter}`}
          onChange={(e) => {
            const [tab = '', filter = ''] = e.target.value.split('\u0000');
            onChange({ kind: 'saved_filter', tab, filter });
          }}
        >
          {condition.filter &&
          !boards.some((b) => b.filters.some((f) => f.id === condition.filter)) ? (
            <option value={`${condition.tab}\u0000${condition.filter}`}>
              A filter no longer here
            </option>
          ) : null}
          {boards.map((b) => (
            <optgroup key={`${b.tabId}-${b.title}`} label={`${b.title} (${b.tabName})`}>
              {b.filters.map((f) => (
                <option key={f.id} value={`${b.tabId}\u0000${f.id}`}>
                  {f.name}
                </option>
              ))}
            </optgroup>
          ))}
        </PanelSelect>
      )}
    </PanelField>
  );
}
