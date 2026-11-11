'use client';

// The Rules tab (docs/specs/026-plan/automations.md "The Automations screen"): Find a rule, the All Triggers and On
// and Off filters, the column heads, then one row per rule in the plan's order. A search or filter matching nothing
// says so with Clear. The rows' changes are the dialog's (it holds the list); this narrows and lays them out.

import { useMemo, useState } from 'react';
import {
  AUTOMATION_TRIGGER_KINDS,
  AUTOMATION_TRIGGER_NAMES,
  type AutomationTriggerKind,
  type RuleSentenceOutline,
} from '@liveplanner/items';
import type { AutomationListedRule } from '@liveplanner/api-schema';
import { NoMatches, Select } from '@liveplanner/ui';
import { SearchInput } from '@liveworkspace/workbench/components/primitives/SearchInput';
import { RULE_GRID, RuleRow, type RuleRowActions } from './RuleRow';

export type OnFilter = 'all' | 'on' | 'off';

const ON_FILTERS: readonly { value: OnFilter; label: string }[] = [
  { value: 'all', label: 'On and Off' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];

/** The rules a search and the two filters leave, in order. */
export function filterRules(
  rules: readonly AutomationListedRule[],
  query: string,
  trigger: AutomationTriggerKind | 'all',
  on: OnFilter,
): AutomationListedRule[] {
  const q = query.trim().toLowerCase();
  return rules.filter(
    (r) =>
      (!q || r.name.toLowerCase().includes(q)) &&
      (trigger === 'all' || r.trigger.kind === trigger) &&
      (on === 'all' || (on === 'on') === r.enabled),
  );
}

const FILTER_SELECT = 'h-8 rounded-lg pl-3 pr-7 text-[13px]';

export function RulesList({
  rules,
  outline,
  now,
  phone,
  busyIds,
  actionsFor,
}: {
  rules: readonly AutomationListedRule[];
  outline: RuleSentenceOutline;
  now: number;
  phone: boolean;
  // Rules whose switch is on its way to the api.
  busyIds: ReadonlySet<string>;
  actionsFor: (rule: AutomationListedRule) => RuleRowActions;
}) {
  const [query, setQuery] = useState('');
  const [trigger, setTrigger] = useState<AutomationTriggerKind | 'all'>('all');
  const [on, setOn] = useState<OnFilter>('all');
  const shown = useMemo(() => filterRules(rules, query, trigger, on), [rules, query, trigger, on]);
  const filters = (trigger === 'all' ? 0 : 1) + (on === 'all' ? 0 : 1);
  const clear = () => {
    setQuery('');
    setTrigger('all');
    setOn('all');
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={`flex flex-wrap items-center gap-2 ${phone ? 'px-4 pb-1 pt-3' : 'px-5 pb-1 pt-3'}`}
      >
        <div className={phone ? 'w-full' : 'w-[260px]'}>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Find a rule"
            ariaLabel="Find a rule"
            clearAriaLabel="Clear Search"
            clearDescription="Show every rule again."
          />
        </div>
        <Select
          aria-label="Trigger"
          value={trigger}
          onChange={(e) => setTrigger(e.target.value as AutomationTriggerKind | 'all')}
          selectClassName={FILTER_SELECT}
        >
          <option value="all">All Triggers</option>
          {AUTOMATION_TRIGGER_KINDS.map((k) => (
            <option key={k} value={k}>
              {AUTOMATION_TRIGGER_NAMES[k]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="On or off"
          value={on}
          onChange={(e) => setOn(e.target.value as OnFilter)}
          selectClassName={FILTER_SELECT}
        >
          {ON_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto ${phone ? 'pb-2' : 'px-5 pb-5 pt-2'}`}>
        {shown.length === 0 ? (
          <NoMatches things="rules" query={query} filters={filters} onClear={clear} clearsBoth />
        ) : (
          <>
            {phone ? null : (
              <div
                aria-hidden
                className={`${RULE_GRID} border-b border-slate-100 px-1 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400`}
              >
                <span className="text-center">On</span>
                <span>Rule</span>
                <span>Last Run</span>
                <span>This Week</span>
                <span />
              </div>
            )}
            <ul aria-label="Rules" className="flex flex-col">
              {shown.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  outline={outline}
                  now={now}
                  busy={busyIds.has(rule.id)}
                  phone={phone}
                  actions={actionsFor(rule)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
