'use client';

// The When panel (docs/specs/026-plan/automations.md "Triggers"): which trigger starts the rule, a card's or a
// time's, then what narrows it: Card Created's column, Form Response's Form tab, Card Moved's From and To columns,
// Field Changed's fields (at least one), nothing for Comment Added and Run from a Card, and a time trigger's
// schedule (TimeTriggerPanel), and an Incoming Webhook's address and secret (IncomingWebhookPanel).

import {
  AUTOMATION_TRIGGER_KINDS,
  AUTOMATION_TRIGGER_NAMES,
  isTimeTrigger,
  type AutomationTrigger,
  type AutomationTriggerKind,
} from '@liveplanner/items';
import { outlineFields, type AutomationOutline } from '../automation-outline';
import { ChipToggles, PanelField, PanelNote, PanelSelect } from './panel-parts';
import { IncomingWebhookPanel } from './IncomingWebhookPanel';
import { TimeTriggerPanel, freshTimeTrigger } from './TimeTriggerPanel';

const TIME_KINDS: readonly AutomationTriggerKind[] = ['scheduled', 'due_in', 'overdue'];
const TOOL_KINDS: readonly AutomationTriggerKind[] = ['incoming_webhook'];
const CARD_KINDS = AUTOMATION_TRIGGER_KINDS.filter(
  (k) => !TIME_KINDS.includes(k) && !TOOL_KINDS.includes(k),
);

const DESCRIPTIONS: Readonly<Record<AutomationTriggerKind, string>> = {
  card_created: 'A card is added: by a person, Duplicate, an import, a Repeat or an agent.',
  form_response: 'A Form response makes a card.',
  card_moved: 'A card’s column changes.',
  field_changed: 'Any of the chosen fields changes value.',
  comment_added: 'Someone starts a thread on a card or replies on one.',
  manual: 'An Editor picks this rule under Run Rule in a card’s ⋯ menu.',
  scheduled: 'A time comes round. The rule runs once on each card its conditions match.',
  due_in: 'A card’s due date is the chosen number of days away. Once for each due date it has.',
  overdue:
    'A card’s due date has passed and it is not in a done column. Once for each due date it has.',
  incoming_webhook:
    'Another tool, such as CI or a form, sends this rule’s address JSON, proved with its secret.',
};

function fresh(kind: AutomationTriggerKind, fields: readonly string[]): AutomationTrigger {
  switch (kind) {
    case 'field_changed':
      return { kind, fields: fields.slice(0, 1) };
    case 'card_created':
    case 'form_response':
    case 'card_moved':
    case 'comment_added':
    case 'manual':
    case 'incoming_webhook':
      return { kind };
    case 'scheduled':
    case 'due_in':
    case 'overdue':
      return freshTimeTrigger(kind);
  }
}

export function TriggerPanel({
  trigger,
  onChange,
  outline,
  timeZone,
  conditions,
}: {
  trigger: AutomationTrigger;
  onChange: (next: AutomationTrigger) => void;
  outline: AutomationOutline;
  // The zone the rule is saved in (this browser's), which a time trigger names.
  timeZone: string;
  // How many conditions the rule has: a time rule with none is warned about.
  conditions: number;
}) {
  const fields = outlineFields(outline.types);
  const columns = outline.columns.map((c) => ({ value: c.status, label: c.name }));
  return (
    <div className="flex flex-col gap-4">
      <PanelField label="Trigger" hint={DESCRIPTIONS[trigger.kind]}>
        {(id) => (
          <PanelSelect
            id={id}
            value={trigger.kind}
            onChange={(e) =>
              onChange(
                fresh(
                  e.target.value as AutomationTriggerKind,
                  fields.map((f) => f.id),
                ),
              )
            }
          >
            <optgroup label="Something Happens to a Card">
              {CARD_KINDS.map((k) => (
                <option key={k} value={k}>
                  {AUTOMATION_TRIGGER_NAMES[k]}
                </option>
              ))}
            </optgroup>
            <optgroup label="A Time Comes Round">
              {TIME_KINDS.map((k) => (
                <option key={k} value={k}>
                  {AUTOMATION_TRIGGER_NAMES[k]}
                </option>
              ))}
            </optgroup>
            <optgroup label="Another Tool Sends It">
              {TOOL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {AUTOMATION_TRIGGER_NAMES[k]}
                </option>
              ))}
            </optgroup>
          </PanelSelect>
        )}
      </PanelField>
      {trigger.kind === 'card_created' ? (
        <PanelField label="In Column">
          {(id) => (
            <PanelSelect
              id={id}
              value={trigger.status ?? ''}
              onChange={(e) =>
                onChange(
                  e.target.value
                    ? { kind: 'card_created', status: e.target.value }
                    : { kind: 'card_created' },
                )
              }
            >
              <option value="">Any Column</option>
              {columns.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </PanelSelect>
          )}
        </PanelField>
      ) : null}
      {trigger.kind === 'form_response' ? (
        <PanelField label="Form">
          {(id) => (
            <PanelSelect
              id={id}
              value={trigger.formTab ?? ''}
              onChange={(e) =>
                onChange(
                  e.target.value
                    ? { kind: 'form_response', formTab: e.target.value }
                    : { kind: 'form_response' },
                )
              }
            >
              <option value="">Any Form</option>
              {outline.forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </PanelSelect>
          )}
        </PanelField>
      ) : null}
      {trigger.kind === 'card_moved' ? (
        <>
          <ChipToggles
            label="From"
            options={columns}
            value={trigger.from ?? []}
            hint="None picked: from any column."
            onChange={(from) => onChange({ ...trigger, from })}
          />
          <ChipToggles
            label="To"
            options={columns}
            value={trigger.to ?? []}
            hint="None picked: to any column."
            onChange={(to) => onChange({ ...trigger, to })}
          />
        </>
      ) : null}
      {trigger.kind === 'field_changed' ? (
        <ChipToggles
          label="Fields"
          options={fields.map((f) => ({ value: f.id, label: f.name }))}
          value={trigger.fields}
          hint="Pick at least one."
          onChange={(next) => onChange({ kind: 'field_changed', fields: next })}
        />
      ) : null}
      {trigger.kind === 'comment_added' ? (
        <PanelNote>Automation’s own comments start nothing.</PanelNote>
      ) : null}
      {isTimeTrigger(trigger) ? (
        <TimeTriggerPanel
          trigger={trigger}
          onChange={onChange}
          timeZone={timeZone}
          conditions={conditions}
        />
      ) : null}
      {trigger.kind === 'incoming_webhook' ? <IncomingWebhookPanel /> : null}
      {trigger.kind === 'manual' ? (
        <PanelNote>
          While the rule is on, it is listed under Run Rule in every card’s ⋯ menu.
        </PanelNote>
      ) : null}
    </div>
  );
}
