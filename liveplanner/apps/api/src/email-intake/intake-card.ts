// The card a message makes (docs/specs/026-plan/email-to-board.md "What a message makes"; blueprint email-to-board.md
// "Behaviour and state"): the subject as its title, the text as its description with what was not attached listed at
// the end, the pictures as its Attachments and the sender in its From email field. Pure.
import {
  ATTACHMENTS_FIELD,
  FROM_EMAIL_FIELD,
  ITEM_DESCRIPTION_MAX,
  ITEM_TITLE_MAX,
  attachmentSizeText,
  attachmentsValue,
  readItemCreate,
  type ItemAttachment,
  type ItemCreate,
  type ItemPerson,
} from '@liveplanner/items';

/** Why an attachment was left off the card. */
export type DropReason = 'not_picture' | 'too_big' | 'too_many' | 'not_saved';
export type DroppedAttachment = { name: string; size: number; reason: DropReason };

const REASON_WORDS: Record<DropReason, string> = {
  not_picture: 'not a picture',
  too_big: 'over 10 MB',
  too_many: 'over 20 attachments',
  not_saved: "couldn't be saved",
};

const cut = (text: string, max: number): string => {
  const chars = Array.from(text);
  return chars.length <= max ? text : chars.slice(0, max).join('');
};

/** The card's title: the subject, collapsed and cut; "Email from <sender>" when it has none. */
export function cardTitleOf(subject: string, sender: string): string {
  const title = subject.split(/\s/).filter(Boolean).join(' ');
  return cut(title || `Email from ${sender}`, ITEM_TITLE_MAX);
}

/** The line that lists what was left off, or '' for nothing. */
export function droppedLine(dropped: readonly DroppedAttachment[]): string {
  if (dropped.length === 0) return '';
  const each = dropped.map(
    (d) => `${d.name} (${attachmentSizeText(d.size)}, ${REASON_WORDS[d.reason]})`,
  );
  return `Not attached: ${each.join(', ')}.`;
}

/** The description: the text, then the dropped line after a blank line, the text cut first so the line stays whole. */
export function descriptionOf(text: string, dropped: readonly DroppedAttachment[]): string {
  const line = cut(droppedLine(dropped), ITEM_DESCRIPTION_MAX);
  const body = text.trim();
  if (!line) return cut(body, ITEM_DESCRIPTION_MAX);
  if (!body) return line;
  const room = ITEM_DESCRIPTION_MAX - Array.from(line).length - 2;
  return room > 0 ? `${cut(body, room).trimEnd()}\n\n${line}` : line;
}

// The teal a sender's person is drawn in.
export const EMAIL_PERSON_COLOR = '#0f766e';
const PERSON_NAME_MAX = 80;

/** The person an email card names as its maker: the sender's address, by a short hash of it. */
export const emailPerson = (sender: string, hash: string): ItemPerson => ({
  id: `email:${hash.slice(0, 12)}`,
  name: cut(sender, PERSON_NAME_MAX),
  color: EMAIL_PERSON_COLOR,
});

export type EmailCardInput = {
  subject: string;
  text: string;
  sender: string;
  attached: readonly ItemAttachment[];
  dropped: readonly DroppedAttachment[];
  typeId: string;
  status: string;
};

/** The create the item store takes, or its rejection. */
export function emailCardCreate(input: EmailCardInput): Omit<ItemCreate, 'comments'> | string {
  const fields: Record<string, unknown> = {
    title: cardTitleOf(input.subject, input.sender),
    status: input.status,
    [FROM_EMAIL_FIELD]: input.sender,
  };
  const description = descriptionOf(input.text, input.dropped);
  if (description) fields['description'] = description;
  const attachments = attachmentsValue(input.attached);
  if (attachments !== undefined) fields[ATTACHMENTS_FIELD] = attachments;
  return readItemCreate({ type: input.typeId, fields, place: { status: input.status } });
}
