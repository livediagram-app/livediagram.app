'use client';

// The actions that write text (docs/specs/026-plan/automations.md "Actions"): Add Comment (the comment, posted as
// Automation), @Mention Someone (who, and the message) and Send Email (To, Subject and Message, on the platform's
// EmailPanel). Every text field has Insert a Value.

import {
  AUTOMATION_TEXT_MAX,
  type AutomationAction,
  type AutomationEmailRecipient,
  type AutomationRecipient,
} from '@liveplanner/items';
import { ValueTextField } from '@liveworkspace/automations-ui/ValueInsert';
import { EmailPanel } from '@liveworkspace/automations-ui/step-panels/EmailPanel';
import type { AutomationOutline } from '../automation-outline';
import { PersonPicker } from './PeopleActionPanel';

type TextAction = AutomationAction & { kind: 'comment' | 'email' | 'mention' };

// Who beside a chosen person: the card's assignee, or whoever triggered the rule (no one, for a time rule).
const RECIPIENTS: readonly {
  key: 'assignee' | 'trigger';
  label: string;
  value: AutomationRecipient;
}[] = [
  { key: 'assignee', label: 'The Card’s Assignee', value: { assignee: true } },
  { key: 'trigger', label: 'The Person Who Triggered It', value: { trigger: true } },
];

// Send Email's own: addresses typed in, for people who are not in the plan.
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
  // The refusal's path within this action ('' for the action itself, 'subject' for an email's subject), or null.
  invalidPath: string | null;
  // Inside a For Related Cards branch: Insert a Value offers the triggering card's values too.
  branch?: boolean;
  // The rule's trigger has nobody behind it: "the person who triggered it" is not offered.
  timeRule?: boolean;
}) {
  const recipients = timeRule ? RECIPIENTS.filter((r) => r.key !== 'trigger') : RECIPIENTS;
  if (action.kind === 'comment')
    return (
      <ValueTextField
        label="Comment"
        maxLength={AUTOMATION_TEXT_MAX}
        value={action.text}
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
          invalid={invalidPath !== null}
          branch={branch}
          hint="Starts a thread on the card that @mentions them. It reaches their Inbox, and their email unless they turned mention emails off."
          onChange={(text) => onChange({ ...action, text })}
        />
      </div>
    );
  const to = action.to;
  return (
    <EmailPanel
      recipient={
        <PersonPicker<AutomationEmailRecipient>
          label="To"
          value={to}
          outline={outline}
          extra={[...recipients, ADDRESSES]}
          onChange={(next) => onChange({ ...action, to: next })}
        />
      }
      addresses={'addresses' in to ? to.addresses : null}
      onAddresses={(addresses) => onChange({ ...action, to: { addresses } })}
      subject={action.subject}
      onSubject={(subject) => onChange({ ...action, subject })}
      body={action.body}
      onBody={(body) => onChange({ ...action, body })}
      invalidPath={invalidPath}
      branch={branch}
      hint={
        'addresses' in to
          ? 'Sent from liveplanner with a link to the card.'
          : 'Sent from liveplanner with a link to the card. Only to people in this plan.'
      }
    />
  );
}
