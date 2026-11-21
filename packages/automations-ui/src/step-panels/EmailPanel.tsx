'use client';

// Send Email's fields (liveworkspace/docs/specs/018-automations/automations.md "Steps every app has"): To (the app's
// own picker of who, handed in), the typed-in addresses when that is what To says, Subject and Message, each with
// Insert a Value. `hint`: what the app says under the message (where its link goes, who it may reach).

import { AUTOMATION_SUBJECT_MAX, AUTOMATION_TEXT_MAX } from '@liveworkspace/automations';
import type { ReactNode } from 'react';
import { ValueTextField } from '../ValueInsert';
import { EmailAddressesField } from './EmailAddressesField';

export function EmailPanel({
  recipient,
  addresses,
  onAddresses,
  subject,
  onSubject,
  body,
  onBody,
  invalidPath,
  branch = false,
  hint,
}: {
  // The app's To picker.
  recipient: ReactNode;
  // The typed-in addresses, when To is Email Addresses; null otherwise.
  addresses: readonly string[] | null;
  onAddresses: (next: string[]) => void;
  subject: string;
  onSubject: (next: string) => void;
  body: string;
  onBody: (next: string) => void;
  // Where a refusal points inside the step ('subject', 'body', 'to.addresses.0'), or null.
  invalidPath: string | null;
  // Inside the app's branch.
  branch?: boolean;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {recipient}
      {addresses ? (
        <EmailAddressesField
          addresses={addresses}
          invalid={invalidPath?.startsWith('to.addresses') ?? false}
          onChange={onAddresses}
        />
      ) : null}
      <ValueTextField
        label="Subject"
        multiline={false}
        maxLength={AUTOMATION_SUBJECT_MAX}
        value={subject}
        invalid={invalidPath === 'subject'}
        branch={branch}
        onChange={onSubject}
      />
      <ValueTextField
        label="Message"
        maxLength={AUTOMATION_TEXT_MAX}
        value={body}
        invalid={invalidPath === 'body' || invalidPath === 'text'}
        branch={branch}
        hint={hint}
        onChange={onBody}
      />
    </div>
  );
}
