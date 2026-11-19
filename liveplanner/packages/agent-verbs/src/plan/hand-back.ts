// Handing a card back (docs/specs/026-plan/plan-agents.md "Cards handed to an assistant"): an Assignee given as "me",
// and the words a hand-back of a card the calling assistant does not hold is refused with.
import {
  cardRefOrKey,
  itemAssignee,
  type Item,
  type ItemAssistant,
  type ItemTypeDef,
} from '@liveplanner/items';

// "me", case and spacing aside: the calling assistant.
export const isMe = (v: unknown): boolean =>
  typeof v === 'string' && v.trim().toLowerCase() === 'me';

// Who holds a card, as its refusal names them: a person's name, an assistant's, or no one.
export function handBackRefusal(
  card: Item,
  caller: ItemAssistant,
  types: readonly ItemTypeDef[],
): { code: 'not_handed_to_you'; message: string } {
  const holder = itemAssignee(card);
  const whose = holder ? `${holder.name}'s` : 'handed to no one';
  return {
    code: 'not_handed_to_you',
    message:
      `${cardRefOrKey(card, types)} is ${whose}, not ${caller.name}'s: only the assistant a card is handed to hands it back. ` +
      'To take it, set its assignee to "me".',
  };
}
