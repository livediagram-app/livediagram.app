'use client';

// Add a Comment, Send an Email and Mention Someone (docs/specs/026-plan/automations.md "Actions"): the text written
// with its values, and for an email or a mention who it goes to (and an email's subject). The Preview under it fills the values from a real card.

import {
  AUTOMATION_TEXT_MAX,
  type AutomationAction,
  type AutomationEmailRecipient,
  type AutomationRecipient,
} from '@liveplanner/items';
import { outlineFields, type AutomationOutline } from '../automation-outline';
import { ValueTextField } from '../ValueInsert';
import { EmailAddressesField } from './EmailAddressesField';
import { PersonPicker } from './PeopleActionPanel';

type TextAction = AutomationAction & { kind: 'comment' | 'email' | 'mention' };

const RECIPIENTS: readonly {
  key: 'assignee' | 'trigger';
  label: string;
  value: AutomationRecipient;
}[] = [
  { key: 'assignee', label: 'The Card’s Assignee', value: { assignee: true } },
  { key: 'trigger', label: 'The Person Who Triggered It', value: { trigger: true } },
];

// Send Email's last fixed choice: addresses typed in (spec "Typed-in addresses").
const ADDRESSES: { key: 'addresses'; label: string; value: AutomationEmailRecipient } = {
  key: 'addresses',
  label: 'Email Addresses',
  value: { addresses: [] },
};

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
  if (action.kind === 'mention')
    return (
      <div className="flex flex-col gap-4">
        <PersonPicker
          label="Mention"
          value={action.to}
          outline={outline}
          extra={recipients}
          onChange={(to) => onChange({ ...action, to })}
        />
        <ValueTextField
          label="Message"
          maxLength={AUTOMATION_TEXT_MAX}
          value={action.text}
          fields={fields}
          invalid={invalidPath !== null}
          branch={branch}
          hint="Starts a thread on the card that @mentions them. It reaches their Inbox, and their email unless they turned mention emails off."
          onChange={(text) => onChange({ ...action, text })}
        />
      </div>
    );
  const to = action.to;
  return (
    <div className="flex flex-col gap-4">
      <PersonPicker<AutomationEmailRecipient>
        label="To"
        value={to}
        outline={outline}
        extra={[...recipients, ADDRESSES]}
        onChange={(next) => onChange({ ...action, to: next })}
      />
      {'addresses' in to ? (
        <EmailAddressesField
          addresses={to.addresses}
          invalid={invalidPath?.startsWith('to.addresses') ?? false}
          onChange={(addresses) => onChange({ ...action, to: { addresses } })}
        />
      ) : null}
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
        hint={
          'addresses' in to
            ? 'Sent from LivePlanner with a link to the card.'
            : 'Sent from LivePlanner with a link to the card. Only to people in this plan.'
        }
        onChange={(body) => onChange({ ...action, body })}
      />
    </div>
  );
}
