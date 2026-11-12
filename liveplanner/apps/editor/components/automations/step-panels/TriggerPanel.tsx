'use client';

// The When panel (docs/specs/026-plan/automations.md "Triggers"): which trigger starts the rule, a card's or a
// time's (picked in the Pick a Trigger picker, ChangeTriggerField), then what narrows it: Card Created's column, Form Response's Form tab, Card Moved's From and To columns,
// Field Changed's fields (at least one), nothing for Comment Added and Run from a Card, and a time trigger's
// schedule (TimeTriggerPanel), and an Incoming Webhook's address and secret (IncomingWebhookPanel).

import { isTimeTrigger, type AutomationTrigger } from '@liveplanner/items';
import { outlineFields, type AutomationOutline } from '../automation-outline';
import { ChipToggles, PanelField, PanelNote, PanelSelect } from './panel-parts';
import { IncomingWebhookPanel } from './IncomingWebhookPanel';
import { TimeTriggerPanel } from './TimeTriggerPanel';
import { ChangeTriggerField } from './ChangeTriggerField';
import { freshTrigger } from '../trigger-groups';

// Column Over Limit's choices: every limit to 20, then in steps.
const LIMITS = [
  ...Array.from({ length: 20 }, (_, i) => i + 1),
  25,
  30,
  40,
  50,
  75,
  100,
  150,
  200,
  300,
  500,
];

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
      <ChangeTriggerField
        kind={trigger.kind}
        onChange={(kind) =>
          onChange(
            freshTrigger(
              kind,
              fields.map((f) => f.id),
              outline.columns.map((c) => c.status),
            ),
          )
        }
      />
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
          columns={columns}
          timeZone={timeZone}
          conditions={conditions}
        />
      ) : null}
      {trigger.kind === 'incoming_webhook' ? <IncomingWebhookPanel /> : null}
      {trigger.kind === 'mentioned' ? (
        <ChipToggles
          label="Mentioning"
          options={outline.people.map((p) => ({ value: p.id, label: p.name }))}
          value={trigger.people ?? []}
          hint="None picked: anyone mentioned."
          onChange={(people) =>
            onChange(people.length ? { kind: 'mentioned', people } : { kind: 'mentioned' })
          }
        />
      ) : null}
      {trigger.kind === 'related_done' ? (
        <PanelField label="Related Cards">
          {(id) => (
            <PanelSelect
              id={id}
              value={trigger.related}
              onChange={(e) =>
                onChange({ kind: 'related_done', related: e.target.value as 'children' | 'linked' })
              }
            >
              <option value="children">Its Children</option>
              <option value="linked">The Cards Its Card Fields Point At</option>
            </PanelSelect>
          )}
        </PanelField>
      ) : null}
      {trigger.kind === 'column_limit' ? (
        <>
          <PanelField label="Column">
            {(id) => (
              <PanelSelect
                id={id}
                value={trigger.status}
                onChange={(e) => onChange({ ...trigger, status: e.target.value })}
              >
                {columns.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </PanelSelect>
            )}
          </PanelField>
          <PanelField label="Limit" hint="Runs on the card that takes the column past it.">
            {(id) => (
              <PanelSelect
                id={id}
                value={String(trigger.limit)}
                onChange={(e) => onChange({ ...trigger, limit: Number(e.target.value) })}
              >
                {LIMITS.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? '1 Card' : `${n} Cards`}
                  </option>
                ))}
              </PanelSelect>
            )}
          </PanelField>
        </>
      ) : null}
      {trigger.kind === 'card_unblocked' ? (
        <PanelNote>
          Runs on the blocked card once the last card blocking it is done or archived.
        </PanelNote>
      ) : null}
      {trigger.kind === 'threads_resolved' || trigger.kind === 'checklist_completed' ? (
        <PanelNote>Runs again only after something new is opened and finished.</PanelNote>
      ) : null}
      {trigger.kind === 'manual' ? (
        <PanelNote>
          While the rule is on, it is listed under Run Rule in every card’s ⋯ menu.
        </PanelNote>
      ) : null}
    </div>
  );
}
