'use client';

// The Rules tab's filters (docs/specs/026-plan/automations.md "The Automations screen"): Find a Rule, All Triggers and
// On and Off. A wide screen keeps one row of compact fields; a phone lays them out for a thumb, the search across the
// full width and under it the trigger select beside an All / On / Off segmented control, all 40 px tall with the same
// radius, border and focus ring.

import {
  AUTOMATION_TRIGGER_KINDS,
  AUTOMATION_TRIGGER_NAMES,
  type AutomationTriggerKind,
} from '@liveplanner/items';
import { Select } from '@liveplanner/ui';
import { SearchInput } from '@liveworkspace/workbench/components/primitives/SearchInput';
import { SegmentedRadio } from '@liveworkspace/workbench/components/primitives/SegmentedRadio';

export type OnFilter = 'all' | 'on' | 'off';
export type TriggerFilter = AutomationTriggerKind | 'all';

const ON_FILTERS: readonly { value: OnFilter; label: string }[] = [
  { value: 'all', label: 'On and Off' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];
// A phone's segments: short words, so three sit side by side.
const ON_SEGMENTS: readonly { id: OnFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'on', label: 'On' },
  { id: 'off', label: 'Off' },
];

const FILTER_SELECT = 'h-8 rounded-lg pl-3 pr-7 text-[13px]';
// A phone's select: the search's 40 px, radius and type, the chevron's room at the right.
const PHONE_SELECT = 'h-10 rounded-lg pl-3 pr-8 text-[14px]';

export function RuleFilters({
  phone,
  query,
  onQuery,
  trigger,
  onTrigger,
  on,
  onOn,
}: {
  phone: boolean;
  query: string;
  onQuery: (next: string) => void;
  trigger: TriggerFilter;
  onTrigger: (next: TriggerFilter) => void;
  on: OnFilter;
  onOn: (next: OnFilter) => void;
}) {
  const search = (
    <SearchInput
      value={query}
      onChange={onQuery}
      placeholder="Find a rule"
      ariaLabel="Find a rule"
      clearAriaLabel="Clear Search"
      clearDescription="Show every rule again."
      size={phone ? 'lg' : 'md'}
    />
  );
  const triggers = (
    <Select
      aria-label="Trigger"
      value={trigger}
      onChange={(e) => onTrigger(e.target.value as TriggerFilter)}
      className={phone ? 'min-w-0 flex-1' : undefined}
      selectClassName={phone ? PHONE_SELECT : FILTER_SELECT}
    >
      <option value="all">All Triggers</option>
      {AUTOMATION_TRIGGER_KINDS.map((k) => (
        <option key={k} value={k}>
          {AUTOMATION_TRIGGER_NAMES[k]}
        </option>
      ))}
    </Select>
  );
  if (phone)
    return (
      <div data-rule-filters="phone" className="flex flex-col gap-2 px-4 pb-2 pt-3">
        <div className="flex">{search}</div>
        <div className="flex items-center gap-2">
          {triggers}
          <SegmentedRadio
            label="On or off"
            options={ON_SEGMENTS}
            value={on}
            onChange={onOn}
            size="lg"
            className="shrink-0"
          />
        </div>
      </div>
    );
  return (
    <div data-rule-filters="row" className="flex flex-wrap items-center gap-2 px-5 pb-1 pt-3">
      <div className="w-[260px]">{search}</div>
      {triggers}
      <Select
        aria-label="On or off"
        value={on}
        onChange={(e) => onOn(e.target.value as OnFilter)}
        selectClassName={FILTER_SELECT}
      >
        {ON_FILTERS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
