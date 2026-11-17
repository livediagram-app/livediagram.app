'use client';

// Email Received's part of the When panel (docs/specs/026-plan/automations.md "Email Received"): which board's address
// (Any Board, or one Plan board, told apart by its tab when two share a title) and From, one address or a domain, as
// typed. A From that is neither is marked here and refused on save; the rule keeps it as written until then. The plan's
// addresses are read once as the panel first opens (email-addresses.tsx): a board without one is marked " · No
// Address", and the note under the picker offers Turn On Email to Board for the picked board (or every board, when
// none has one).

import { useEffect } from 'react';
import { emailSenderFilter, type AutomationTrigger } from '@liveplanner/items';
import { Button, TextInput } from '@liveplanner/ui';
import type { OutlineBoard } from '../automation-outline';
import { useEmailAddresses } from '../email-addresses';
import { PanelField, PanelNote, PanelSelect } from './panel-parts';

type EmailTrigger = Extract<AutomationTrigger, { kind: 'email_received' }>;

const FROM_HINT = 'An address, or a domain like @example.com. Empty: anyone.';
const FROM_INVALID = 'Not an email address or a domain.';

const NO_ADDRESS = 'No Address';
const NO_BOARDS: ReadonlySet<string> = new Set();

/** Each board's name in the picker: its title, with its tab when another board has the same title, and " · No
 *  Address" when it is one of `missing`. */
export function boardChoices(
  boards: readonly OutlineBoard[],
  missing: ReadonlySet<string> = NO_BOARDS,
): { value: string; label: string }[] {
  const titles = new Map<string, number>();
  for (const b of boards) titles.set(b.title, (titles.get(b.title) ?? 0) + 1);
  return boards.map((b) => {
    const name = (titles.get(b.title) ?? 0) > 1 ? `${b.title} · ${b.tabName}` : b.title;
    return { value: b.id, label: missing.has(b.id) ? `${name} · ${NO_ADDRESS}` : name };
  });
}

/** The note under the picker, over the boards as `boardChoices` names them unmarked: the picked board has no address
 *  (`turnOn` that board), Any Board and no board has one (`turnOn` every board), or null for the default note. */
export function emailBoardNote(
  picked: string | undefined,
  named: readonly { value: string; label: string }[],
  missing: ReadonlySet<string>,
): { text: string; turnOn: readonly string[] } | null {
  if (picked) {
    const choice = named.find((c) => c.value === picked);
    if (!choice || !missing.has(choice.value)) return null;
    return {
      text: `${choice.label} has no email address yet, so no email reaches this rule.`,
      turnOn: [picked],
    };
  }
  const ids = named.map((c) => c.value);
  if (ids.length === 0 || !ids.every((id) => missing.has(id))) return null;
  return { text: 'No board has an email address yet.', turnOn: ids };
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
  const addresses = useEmailAddresses();
  const load = addresses?.load;
  useEffect(() => load?.(), [load]);
  // The boards the api knows that have no address, once read on a server that takes mail.
  const missing =
    addresses?.status === 'ready' && addresses.available
      ? new Set(
          boards
            .map((b) => b.id)
            .filter((id) => addresses.known.has(id) && !addresses.addressed.has(id)),
        )
      : NO_BOARDS;
  const choices = boardChoices(boards, missing);
  const note = emailBoardNote(trigger.board, boardChoices(boards), missing);
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
        {note ? note.text : 'Only boards with Email to Board turned on get email.'} Use {'{{from}}'}{' '}
        in a step for the sender’s address.
        {note && addresses ? (
          <span className="mt-2.5 block">
            <Button variant="secondary" size="xs" onClick={() => addresses.turnOn(note.turnOn)}>
              Turn On Email to Board
            </Button>
          </span>
        ) : null}
      </PanelNote>
    </>
  );
}
