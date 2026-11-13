'use client';

// Assign and Send an Email's recipient (docs/specs/026-plan/automations.md "Actions"): a person of the plan, the
// person who triggered the rule, the card's assignee (email), typed-in addresses (email), nobody or people in turn
// (assign).

import type { AutomationAssignee, AutomationEmailRecipient } from '@liveplanner/items';
import type { AutomationOutline } from '../automation-outline';
import { PanelField, PanelSelect } from './panel-parts';

type Who = AutomationAssignee | AutomationEmailRecipient;

const keyOf = (w: Who) =>
  'addresses' in w
    ? 'addresses'
    : 'person' in w
      ? `person:${w.person}`
      : 'trigger' in w
        ? 'trigger'
        : 'nobody' in w
          ? 'nobody'
          : 'rotate' in w
            ? 'rotate'
            : 'assignee';

export function PersonPicker<T extends Who>({
  label,
  value,
  onChange,
  outline,
  extra,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  outline: AutomationOutline;
  // The fixed choices above the plan's people.
  extra: readonly {
    key: 'trigger' | 'nobody' | 'assignee' | 'rotate' | 'addresses';
    label: string;
    value: T;
  }[];
}) {
  const key = keyOf(value);
  const known = !('person' in value) || outline.people.some((p) => p.id === value.person);
  // A choice no longer offered (whoever triggered it, on a rule now on a time) still reads as what it is.
  const offered = known && ('person' in value || extra.some((x) => x.key === key));
  return (
    <PanelField label={label}>
      {(id) => (
        <PanelSelect
          id={id}
          value={key}
          onChange={(e) => {
            const k = e.target.value;
            const fixed = extra.find((x) => x.key === k);
            onChange(fixed ? fixed.value : ({ person: k.slice(7) } as T));
          }}
        >
          {extra.map((x) => (
            <option key={x.key} value={x.key}>
              {x.label}
            </option>
          ))}
          {known ? null : <option value={key}>Someone No Longer Here</option>}
          {known && !offered ? <option value={key}>The Person Who Triggered It</option> : null}
          {outline.people.map((p) => (
            <option key={p.id} value={`person:${p.id}`}>
              {p.name}
            </option>
          ))}
        </PanelSelect>
      )}
    </PanelField>
  );
}
