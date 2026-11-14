'use client';

// The When panel (docs/specs/026-plan/automations.md "Triggers"): which trigger starts the rule, a card's or a
// time's (picked in the Pick a Trigger picker, ChangeTriggerField), then what narrows it: Card Created's column, Form Response's Form tab, Card Moved's Card Types and its From and To
// columns (only those the picked types use, card-moved-columns.ts),
// Field Changed's fields (at least one), nothing for Comment Added and Run from a Card, and a time trigger's
// schedule (TimeTriggerPanel), an Incoming Webhook's address and secret (IncomingWebhookPanel), and a GitHub trigger's
// result and connection (GithubTriggerFields).

import {
  BUILT_IN_FIELD_NAMES,
  isGithubTrigger,
  isTimeTrigger,
  type AutomationTrigger,
} from '@liveplanner/items';
import { GithubTriggerFields } from '../github/GithubTriggerFields';
import {
  RULE_BUILT_IN_FIELDS,
  fieldChangeFields,
  outlineFields,
  type AutomationOutline,
} from '../automation-outline';
import { ChipToggles, PanelField, PanelNote, PanelSelect } from './panel-parts';
import { IncomingWebhookPanel } from './IncomingWebhookPanel';
import { TimeTriggerPanel } from './TimeTriggerPanel';
import { ChangeTriggerField } from './ChangeTriggerField';
import { freshTrigger } from '../trigger-groups';
import {
  cardMovedColumns,
  unusedPicks,
  unusedPicksNote,
  withCardMovedTypes,
} from '../card-moved-columns';

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

const GONE_COLUMN = 'A column no longer here';

// A single pick the plan no longer has (a deleted column or Form tab) stays listed, so the select shows what the rule
// holds rather than its first choice: above the plan's own, as every panel's gone pick sits.
const goneOption = (value: string | undefined, known: readonly string[], label: string) =>
  value && !known.includes(value) ? <option value={value}>{label}</option> : null;

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
  // Only the fields a write changes: Field Changed never hears Time Spent, a tally or a worked-out value.
  const fields = fieldChangeFields(outline.types);
  const columns = outline.columns.map((c) => ({ value: c.status, label: c.name }));
  const statuses = columns.map((c) => c.value);
  // Card Moved's From and To: the columns its picked card types use, every column when none is picked, then a picked
  // one the plan has that no picked type uses any more, by its name with a note (only a deleted column is gone).
  const moved = (chosen: readonly string[] | undefined) => {
    if (trigger.kind !== 'card_moved') return { options: columns, note: null };
    const unused = unusedPicks(outline.types, trigger.types, outline.columns, chosen);
    return {
      options: [...cardMovedColumns(outline.types, trigger.types, outline.columns), ...unused].map(
        (c) => ({ value: c.status, label: c.name }),
      ),
      note: unusedPicksNote(unused.map((c) => c.name)),
    };
  };
  const movedFrom = moved(trigger.kind === 'card_moved' ? trigger.from : undefined);
  const movedTo = moved(trigger.kind === 'card_moved' ? trigger.to : undefined);
  // Field Changed's chips: the plan's fields, and one the rule names that is not offered by its name: a field it never
  // hears (Needs Attention names it too) or a built-in one no card type lists. Only one the plan lacks reads as gone.
  const fieldOptions = fields.map((f) => ({ value: f.id, label: f.name }));
  if (trigger.kind === 'field_changed') {
    const held = trigger.fields.filter((id) => !fields.some((f) => f.id === id));
    const all = held.length ? outlineFields(outline.types) : [];
    for (const id of held) {
      const label =
        all.find((f) => f.id === id)?.name ??
        (RULE_BUILT_IN_FIELDS.has(id) && id in BUILT_IN_FIELD_NAMES
          ? BUILT_IN_FIELD_NAMES[id as keyof typeof BUILT_IN_FIELD_NAMES]
          : null);
      if (label) fieldOptions.push({ value: id, label });
    }
  }
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
              trigger,
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
              {goneOption(trigger.status, statuses, GONE_COLUMN)}
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
              {goneOption(
                trigger.formTab,
                outline.forms.map((f) => f.id),
                'A form no longer here',
              )}
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
            label="Card Types"
            options={outline.types.map((t) => ({ value: t.id, label: t.label }))}
            value={trigger.types ?? []}
            hint="None picked: any card type."
            gone="A card type no longer here"
            onChange={(types) => onChange(withCardMovedTypes(trigger, types, outline))}
          />
          <ChipToggles
            label="From"
            options={movedFrom.options}
            value={trigger.from ?? []}
            hint="None picked: from any column."
            gone={GONE_COLUMN}
            note={movedFrom.note}
            onChange={(from) => onChange({ ...trigger, from })}
          />
          <ChipToggles
            label="To"
            options={movedTo.options}
            value={trigger.to ?? []}
            hint="None picked: to any column."
            gone={GONE_COLUMN}
            note={movedTo.note}
            onChange={(to) => onChange({ ...trigger, to })}
          />
        </>
      ) : null}
      {trigger.kind === 'field_changed' ? (
        <ChipToggles
          label="Fields"
          options={fieldOptions}
          value={trigger.fields}
          hint="Pick at least one."
          gone="A field no longer here"
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
      {isGithubTrigger(trigger) ? (
        <GithubTriggerFields trigger={trigger} onChange={onChange} />
      ) : null}
      {trigger.kind === 'mentioned' ? (
        <ChipToggles
          label="Mentioning"
          options={outline.people.map((p) => ({ value: p.id, label: p.name }))}
          value={trigger.people ?? []}
          hint="None picked: anyone mentioned."
          gone="Someone No Longer Here"
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
                {goneOption(trigger.status, statuses, GONE_COLUMN)}
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
