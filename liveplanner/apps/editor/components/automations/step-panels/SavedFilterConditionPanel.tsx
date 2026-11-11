'use client';

// The Matches a Saved Filter condition (docs/specs/026-plan/automations.md "Conditions"): one of a board's saved
// filters, applied as the person who made the change would see it.

import type { AutomationCondition } from '@liveplanner/items';
import type { AutomationOutline } from '../automation-outline';
import { PanelField, PanelNote, PanelSelect } from './panel-parts';

type SavedFilterCondition = AutomationCondition & { kind: 'saved_filter' };

/** One of the boards' saved filters, by board (the condition's and a branch's pick). */
export function SavedFilterSelect({
  tab,
  filter,
  outline,
  hint,
  onPick,
}: {
  tab: string;
  filter: string;
  outline: AutomationOutline;
  hint: string;
  onPick: (tab: string, filter: string) => void;
}) {
  const boards = outline.boards.filter((b) => b.filters.length > 0);
  if (boards.length === 0)
    return (
      <PanelNote>
        No board in this plan has a saved filter yet. Save one from a board’s Filter.
      </PanelNote>
    );
  return (
    <PanelField label="Saved Filter" hint={hint}>
      {(id) => (
        <PanelSelect
          id={id}
          value={`${tab}\u0000${filter}`}
          onChange={(e) => {
            const [nextTab = '', nextFilter = ''] = e.target.value.split('\u0000');
            onPick(nextTab, nextFilter);
          }}
        >
          {filter && !boards.some((b) => b.filters.some((f) => f.id === filter)) ? (
            <option value={`${tab}\u0000${filter}`}>A filter no longer here</option>
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

export function SavedFilterConditionPanel({
  condition,
  onChange,
  outline,
}: {
  condition: SavedFilterCondition;
  onChange: (next: AutomationCondition) => void;
  outline: AutomationOutline;
}) {
  return (
    <SavedFilterSelect
      tab={condition.tab}
      filter={condition.filter}
      outline={outline}
      hint="Applied as the person who made the change would see it."
      onPick={(tab, filter) => onChange({ kind: 'saved_filter', tab, filter })}
    />
  );
}
