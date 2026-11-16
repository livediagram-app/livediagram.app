'use client';

// Email Received's part of the When panel (docs/specs/026-plan/automations.md "Email Received"): which board's address
// (Any Board, or one Plan board, told apart by its tab when two share a title) and From, one address or a domain, as
// typed. A From that is neither is marked here and refused on save; the rule keeps it as written until then.

import { emailSenderFilter, type AutomationTrigger } from '@liveplanner/items';
import { TextInput } from '@liveplanner/ui';
import type { OutlineBoard } from '../automation-outline';
import { PanelField, PanelNote, PanelSelect } from './panel-parts';

type EmailTrigger = Extract<AutomationTrigger, { kind: 'email_received' }>;

const FROM_HINT = 'An address, or a domain like @example.com. Empty: anyone.';
const FROM_INVALID = 'Not an email address or a domain.';

/** Each board's name in the picker: its title, with its tab when another board has the same title. */
export function boardChoices(boards: readonly OutlineBoard[]): { value: string; label: string }[] {
  const titles = new Map<string, number>();
  for (const b of boards) titles.set(b.title, (titles.get(b.title) ?? 0) + 1);
  return boards.map((b) => ({
    value: b.id,
    label: (titles.get(b.title) ?? 0) > 1 ? `${b.title} · ${b.tabName}` : b.title,
  }));
}

/** The trigger with `board` and `sender` set, each left out when empty. */
export function emailTrigger(board: string | undefined, sender: string | undefined): EmailTrigger {
  return {
    kind: 'email_received',
    ...(board ? { board } : {}),
    ...(sender?.trim() ? { sender } : {}),
  };
}

export function EmailTriggerFields({
  trigger,
  onChange,
  boards,
}: {
  trigger: EmailTrigger;
  onChange: (next: AutomationTrigger) => void;
  boards: readonly OutlineBoard[];
}) {
  const choices = boardChoices(boards);
  const sender = trigger.sender ?? '';
  const invalid = sender.trim() !== '' && emailSenderFilter(sender) === null;
  return (
    <>
      <PanelField label="Board">
        {(id) => (
          <PanelSelect
            id={id}
            value={trigger.board ?? ''}
            onChange={(e) => onChange(emailTrigger(e.target.value, trigger.sender))}
          >
            <option value="">Any Board</option>
            {trigger.board && !choices.some((c) => c.value === trigger.board) ? (
              <option value={trigger.board}>A board no longer here</option>
            ) : null}
            {choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </PanelSelect>
        )}
      </PanelField>
      <PanelField label="From" hint={invalid ? FROM_INVALID : FROM_HINT}>
        {(id) => (
          <TextInput
            compact
            id={id}
            type="text"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            placeholder="Anyone"
            value={sender}
            maxLength={254}
            invalid={invalid}
            onChange={(e) => onChange(emailTrigger(trigger.board, e.target.value))}
          />
        )}
      </PanelField>
      <PanelNote>
        Only boards with Email to Board turned on get email. Use {'{{from}}'} in a step for the
        sender’s address.
      </PanelNote>
    </>
  );
}
