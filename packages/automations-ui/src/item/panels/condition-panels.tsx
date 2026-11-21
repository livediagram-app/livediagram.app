'use client';

// The shared conditions' panels (blueprint item-ui.md "Panels"; automations.md "Conditions every app has"): Tab, Who
// Did It, Day of Week and Text. Chips for what is picked from the item (a tab or a person no longer here stays as a
// pressed chip until unpicked), selects for a single choice.

import {
  TEXT_CONDITION_MAX,
  itemValueOptions,
  type ItemKinds,
  type ItemPart,
  type ItemTabCondition,
  type ItemTextCondition,
  type ItemWeekdayCondition,
  type ItemWho,
  type ItemWhoCondition,
  type ItemWhoRole,
} from '@liveworkspace/automations/item';
import { WEBHOOK_VALUE_PREFIX } from '@liveworkspace/automations';
import type { ComponentType } from 'react';
import { TextInput } from '@liveworkspace/ui';
import type { ConditionPanelProps } from '../../kit';
import { useAutomationsKit } from '../../kit-context';
import { useRuleContext } from '../../rule-context';
import { ChipToggles, IsNotPicker, PanelField, PanelSelect } from '../../step-panels/panel-parts';
import type { ItemUiOutline } from '../types';

type Props<Condition> = ConditionPanelProps<Condition, ItemUiOutline>;

/** A condition with Is Not set, or taken off. */
export function withNot<T extends { not?: true }>(condition: T, not: boolean): T {
  const { not: _not, ...rest } = condition;
  return (not ? { ...rest, not: true } : rest) as T;
}

export function TabConditionPanel({ condition, onChange, outline }: Props<ItemTabCondition>) {
  const { item } = useAutomationsKit().plumbing.words;
  return (
    <div className="flex flex-col gap-4">
      <IsNotPicker not={!!condition.not} onChange={(not) => onChange(withNot(condition, not))} />
      <ChipToggles
        label="Tabs"
        options={outline.item.tabs.map((t) => ({ value: t.id, label: t.name }))}
        value={condition.tabs}
        hint="Pick at least one tab."
        empty={`This ${item} has no tabs yet.`}
        gone="No Longer Here"
        onChange={(tabs) => onChange({ ...condition, tabs })}
      />
    </div>
  );
}

const ROLES: readonly { value: string; label: string }[] = [
  { value: 'role:editor', label: 'An Editor' },
  { value: 'role:participant', label: 'A Participant' },
  { value: 'role:agent', label: 'An Agent' },
];

export const whoKey = (w: ItemWho): string =>
  'person' in w ? `person:${w.person}` : `role:${w.role}`;
export const whoOf = (key: string): ItemWho =>
  key.startsWith('role:')
    ? { role: key.slice('role:'.length) as ItemWhoRole }
    : { person: key.slice('person:'.length) };

export function WhoConditionPanel({ condition, onChange, outline }: Props<ItemWhoCondition>) {
  const { item } = useAutomationsKit().plumbing.words;
  // Each group shows its own picks: the roles, and the people.
  const keys = condition.who.map(whoKey);
  const roles = keys.filter((k) => k.startsWith('role:'));
  const people = keys.filter((k) => k.startsWith('person:'));
  return (
    <div className="flex flex-col gap-4">
      <IsNotPicker not={!!condition.not} onChange={(not) => onChange(withNot(condition, not))} />
      <ChipToggles
        label="Roles"
        options={ROLES}
        value={roles}
        onChange={(next) => onChange({ ...condition, who: [...next, ...people].map(whoOf) })}
      />
      <ChipToggles
        label="People"
        options={outline.item.people.map((p) => ({ value: `person:${p.id}`, label: p.name }))}
        value={people}
        hint={roles.length === 0 ? 'Pick at least one role or person.' : undefined}
        empty={`No one in this ${item} yet.`}
        gone="Someone No Longer Here"
        onChange={(next) => onChange({ ...condition, who: [...roles, ...next].map(whoOf) })}
      />
    </div>
  );
}

// Monday first, as the Scheduled trigger's days read.
const WEEK: readonly { value: string; label: string }[] = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '0', label: 'Sun' },
];

export function WeekdayConditionPanel({ condition, onChange }: Props<ItemWeekdayCondition>) {
  return (
    <ChipToggles
      label="Days"
      options={WEEK}
      value={condition.days.map(String)}
      hint="Pick at least one day. Days are in the rule’s time zone."
      onChange={(next) => onChange({ ...condition, days: next.map(Number).sort((a, b) => a - b) })}
    />
  );
}

const WEBHOOK_FIELD = '\u0000webhook';

/** The Text condition's panel, over the app's registry: the values this rule's trigger gives. */
export function textConditionPanel(kinds: ItemKinds): ComponentType<Props<ItemTextCondition>> {
  return function TextConditionPanel({ condition, onChange }: Props<ItemTextCondition>) {
    // The trigger the condition stands under: its own values (the comment) come first.
    const trigger: ItemPart = useRuleContext().body?.trigger ?? { kind: '' };
    const incoming = trigger.kind === 'incoming_webhook';
    const options = itemValueOptions(kinds, { trigger, afterAi: false });
    const own = options.filter((o) => kinds.value(o.name)?.under);
    const rest = options.filter((o) => !kinds.value(o.name)?.under);
    const webhook = condition.value.startsWith(WEBHOOK_VALUE_PREFIX);
    const offered = options.some((o) => o.name === condition.value) || (incoming && webhook);
    return (
      <div className="flex flex-col gap-4">
        <PanelField
          label="Value"
          hint={offered ? undefined : 'This trigger does not give that value. Pick one it does.'}
        >
          {(id, hintId) => (
            <PanelSelect
              id={id}
              aria-describedby={hintId}
              aria-invalid={!offered || undefined}
              value={!offered ? '' : webhook ? WEBHOOK_FIELD : condition.value}
              onChange={(e) =>
                onChange({
                  ...condition,
                  value: e.target.value === WEBHOOK_FIELD ? WEBHOOK_VALUE_PREFIX : e.target.value,
                })
              }
            >
              {offered ? null : <option value="">Pick a value</option>}
              {[...own, ...rest].map((o) => (
                <option key={o.name} value={o.name}>
                  {o.label}
                </option>
              ))}
              {incoming ? <option value={WEBHOOK_FIELD}>Webhook Field</option> : null}
            </PanelSelect>
          )}
        </PanelField>
        {incoming && webhook ? (
          <PanelField
            label="Field"
            hint="A field of the call’s JSON body, by its path: status, or build.branch."
          >
            {(id, hintId) => (
              <TextInput
                compact
                id={id}
                hintId={hintId}
                value={condition.value.slice(WEBHOOK_VALUE_PREFIX.length)}
                placeholder="status"
                spellCheck={false}
                autoCapitalize="none"
                onChange={(e) =>
                  onChange({
                    ...condition,
                    value: `${WEBHOOK_VALUE_PREFIX}${e.target.value.trim()}`,
                  })
                }
              />
            )}
          </PanelField>
        ) : null}
        <PanelField label="Match">
          {(id) => (
            <PanelSelect
              id={id}
              value={condition.op}
              onChange={(e) =>
                onChange({ ...condition, op: e.target.value as ItemTextCondition['op'] })
              }
            >
              <option value="contains">Contains</option>
              <option value="not_contains">Does not contain</option>
            </PanelSelect>
          )}
        </PanelField>
        <PanelField label="Text" hint="Any case: “urgent” matches “Urgent”.">
          {(id, hintId) => (
            <TextInput
              compact
              id={id}
              hintId={hintId}
              value={condition.text}
              maxLength={TEXT_CONDITION_MAX}
              onChange={(e) => onChange({ ...condition, text: e.target.value })}
            />
          )}
        </PanelField>
      </div>
    );
  };
}
