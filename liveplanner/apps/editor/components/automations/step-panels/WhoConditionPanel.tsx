'use client';

// The Who Did It condition (docs/specs/026-plan/automations.md "Conditions"): is or is not one of a chosen person, an
// Editor, a Participant or an agent. A Run from a Card's person is whoever ran it.

import type { AutomationCondition, AutomationWho } from '@liveplanner/items';
import type { AutomationOutline } from '../automation-outline';
import { ChipToggles, IsNotPicker } from './panel-parts';

type WhoCondition = AutomationCondition & { kind: 'who' };

const ROLES = [
  { value: 'role:editor', label: 'An Editor' },
  { value: 'role:participant', label: 'A Participant' },
  { value: 'role:agent', label: 'An Agent' },
] as const;

const keyOf = (w: AutomationWho) => ('person' in w ? `person:${w.person}` : `role:${w.role}`);
const whoOf = (key: string): AutomationWho =>
  key.startsWith('role:')
    ? { role: key.slice(5) as 'editor' | 'participant' | 'agent' }
    : { person: key.slice(7) };

export function WhoConditionPanel({
  condition,
  onChange,
  outline,
}: {
  condition: WhoCondition;
  onChange: (next: AutomationCondition) => void;
  outline: AutomationOutline;
}) {
  const setNot = (not: boolean) => {
    const { not: _, ...rest } = condition;
    onChange(not ? { ...rest, not: true } : rest);
  };
  // Each group shows its own picks: the roles, and the people (one gone from the plan as Someone No Longer Here).
  const keys = condition.who.map(keyOf);
  const roles = keys.filter((k) => k.startsWith('role:'));
  const people = keys.filter((k) => k.startsWith('person:'));
  return (
    <div className="flex flex-col gap-4">
      <IsNotPicker not={!!condition.not} onChange={setNot} />
      <ChipToggles
        label="Roles"
        options={ROLES}
        value={roles}
        onChange={(next) =>
          onChange({
            ...condition,
            who: [...next.filter((k) => k.startsWith('role:')), ...people].map(whoOf),
          })
        }
      />
      <ChipToggles
        label="People"
        options={outline.people.map((p) => ({ value: `person:${p.id}`, label: p.name }))}
        value={people}
        empty="No one in this plan yet."
        gone="Someone No Longer Here"
        onChange={(next) =>
          onChange({
            ...condition,
            who: [...roles, ...next.filter((k) => k.startsWith('person:'))].map(whoOf),
          })
        }
      />
    </div>
  );
}
