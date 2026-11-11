'use client';

// Assign (docs/specs/026-plan/automations.md "Actions", "Assign in turn"): a person of the plan, whoever triggered
// the rule (not on a time trigger, which has nobody behind it), nobody, or People in Turn: 2 to 10 of the plan's
// people, in the order picked, each run the next of them, round and round. The picked people show as numbered chips,
// each with its own remove; Add Person offers the rest.

import {
  AUTOMATION_ROTATE_MAX,
  AUTOMATION_ROTATE_MIN,
  type AutomationAction,
  type AutomationAssignee,
} from '@liveplanner/items';
import { CloseIcon, Tooltip } from '@liveplanner/ui';
import type { AutomationOutline } from '../automation-outline';
import { PanelField, PanelSelect } from './panel-parts';
import { PersonPicker } from './PeopleActionPanel';

type Assign = AutomationAction & { kind: 'assign' };

const TRIGGER = {
  key: 'trigger' as const,
  label: 'The Person Who Triggered It',
  value: { trigger: true } as AutomationAssignee,
};
const NOBODY = {
  key: 'nobody' as const,
  label: 'Nobody (Unassign)',
  value: { nobody: true } as AutomationAssignee,
};
const IN_TURN = {
  key: 'rotate' as const,
  label: 'People in Turn',
  value: { rotate: [] } as AutomationAssignee,
};

function InTurn({
  people,
  outline,
  onChange,
}: {
  people: readonly string[];
  outline: AutomationOutline;
  onChange: (next: string[]) => void;
}) {
  const rest = outline.people.filter((p) => !people.includes(p.id));
  const full = people.length >= AUTOMATION_ROTATE_MAX;
  const short = people.length < AUTOMATION_ROTATE_MIN;
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">In Turn</span>
      {people.length ? (
        <ol aria-label="People in turn" className="flex flex-wrap gap-1.5">
          {people.map((id, i) => {
            const name = outline.people.find((p) => p.id === id)?.name ?? 'Someone No Longer Here';
            return (
              <li
                key={id}
                data-in-turn={id}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 py-0.5 pl-1 pr-0.5 text-[12px] font-medium text-brand-800 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-500/40"
              >
                <span
                  aria-hidden
                  className="inline-flex size-4 items-center justify-center rounded bg-white text-[10px] font-semibold tabular-nums text-brand-700 dark:bg-slate-900 dark:text-brand-300"
                >
                  {i + 1}
                </span>
                {name}
                <Tooltip label={`Remove ${name}`}>
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => onChange(people.filter((p) => p !== id))}
                    className="touch-target relative inline-flex size-5 cursor-pointer items-center justify-center rounded text-brand-600 transition hover:bg-brand-100 hover:text-brand-900 motion-reduce:transition-none dark:text-brand-300 dark:hover:bg-brand-500/25 dark:hover:text-white"
                  >
                    <CloseIcon size={10} />
                  </button>
                </Tooltip>
              </li>
            );
          })}
        </ol>
      ) : null}
      {full ? null : (
        <PanelField label="Add Person">
          {(id) => (
            <PanelSelect
              id={id}
              value=""
              disabled={rest.length === 0}
              onChange={(e) => {
                if (e.target.value) onChange([...people, e.target.value]);
              }}
            >
              <option value="">
                {rest.length ? 'Pick someone to add' : 'Everyone in this plan is in turn'}
              </option>
              {rest.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </PanelSelect>
          )}
        </PanelField>
      )}
      <p
        className={`text-[12px] ${short ? 'text-amber-800 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}
      >
        {short
          ? `Pick at least ${AUTOMATION_ROTATE_MIN} people.`
          : 'Each run assigns the next person, in this order, then starts again.'}{' '}
        Up to {AUTOMATION_ROTATE_MAX}.
      </p>
    </div>
  );
}

export function AssignPanel({
  action,
  onChange,
  outline,
  timeRule,
}: {
  action: Assign;
  onChange: (next: AutomationAction) => void;
  outline: AutomationOutline;
  // A time trigger has nobody behind it, so whoever triggered it is not offered.
  timeRule: boolean;
}) {
  const extra = timeRule ? [NOBODY, IN_TURN] : [TRIGGER, NOBODY, IN_TURN];
  return (
    <div className="flex flex-col gap-4">
      <PersonPicker
        label="Assign To"
        value={action.to}
        outline={outline}
        extra={extra}
        onChange={(to) => onChange({ kind: 'assign', to })}
      />
      {'rotate' in action.to ? (
        <InTurn
          people={action.to.rotate}
          outline={outline}
          onChange={(rotate) => onChange({ kind: 'assign', to: { rotate } })}
        />
      ) : null}
    </div>
  );
}
