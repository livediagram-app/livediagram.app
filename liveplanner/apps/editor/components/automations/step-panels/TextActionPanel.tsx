'use client';

// Add a Comment and Send an Email (docs/specs/026-plan/automations.md "Actions"): the text written with its values,
// and for an email who it goes to and its subject. The Preview under it fills the values from a real card.

import {
  AUTOMATION_TEXT_MAX,
  type AutomationAction,
  type AutomationRecipient,
} from '@liveplanner/items';
import { outlineFields, type AutomationOutline } from '../automation-outline';
import { ValueTextField } from '../ValueInsert';
import { PersonPicker } from './PeopleActionPanel';

type TextAction = AutomationAction & { kind: 'comment' | 'email' };

const RECIPIENTS: readonly {
  key: 'assignee' | 'trigger';
  label: string;
  value: AutomationRecipient;
}[] = [
  { key: 'assignee', label: 'The Card’s Assignee', value: { assignee: true } },
  { key: 'trigger', label: 'The Person Who Triggered It', value: { trigger: true } },
];

export function TextActionPanel({
  action,
  onChange,
  outline,
  invalidPath,
  branch = false,
  timeRule = false,
}: {
  action: TextAction;
  onChange: (next: AutomationAction) => void;
  outline: AutomationOutline;
  // The refusal's last segment within this step ('text', 'subject', 'body'), if any.
  invalidPath: string | null;
  // Inside a branch: the triggering card's values join Insert a Value.
  branch?: boolean;
  // A time trigger has nobody behind it, so an email never goes to whoever triggered it.
  timeRule?: boolean;
}) {
  const fields = outlineFields(outline.types);
  const recipients = timeRule ? RECIPIENTS.filter((r) => r.key !== 'trigger') : RECIPIENTS;
  if (action.kind === 'comment')
    return (
      <ValueTextField
        label="Comment"
        maxLength={AUTOMATION_TEXT_MAX}
        value={action.text}
        fields={fields}
        invalid={invalidPath !== null}
        branch={branch}
        hint="Posted as Automation, in violet, so everyone can tell it from a person’s."
        onChange={(text) => onChange({ kind: 'comment', text })}
      />
    );
  return (
    <div className="flex flex-col gap-4">
      <PersonPicker
        label="To"
        value={action.to}
        outline={outline}
        extra={recipients}
        onChange={(to) => onChange({ ...action, to })}
      />
      <ValueTextField
        label="Subject"
        multiline={false}
        maxLength={200}
        value={action.subject}
        fields={fields}
        invalid={invalidPath === 'subject'}
        branch={branch}
        onChange={(subject) => onChange({ ...action, subject })}
      />
      <ValueTextField
        label="Message"
        maxLength={AUTOMATION_TEXT_MAX}
        value={action.body}
        fields={fields}
        invalid={invalidPath === 'body' || invalidPath === 'text'}
        branch={branch}
        hint="Sent from LivePlanner with a link to the card. Only to people in this plan."
        onChange={(body) => onChange({ ...action, body })}
      />
    </div>
  );
}
