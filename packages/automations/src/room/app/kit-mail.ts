// A rule's Send Email through the app's email (blueprint item-engine.md "The kit": mail; "An app's bindings"). A
// person of the item gets it only at the address the app answers for them (verified, and not opted out of mail about
// work on an item). A typed-in address gets the fixed words and its own unsubscribe link; the day's limit on those
// and the unsubscribes are the engine's, kept in the item's SQLite. Null without email set up, so the step says
// "Email isn't set up here".
import type { ItemMailer, ItemMessage } from '../item/kit';
import {
  itemAutomationAddressEmail,
  itemAutomationEmail,
  type ItemEmailLook,
  type ItemRenderedEmail,
} from './email';

/** The one-click door a mail client POSTs to (List-Unsubscribe), and the page the email's link opens. */
export const optOutDoorUrl = (baseUrl: string, itemId: string, token: string): string =>
  `${baseUrl}/api/email-optout/${encodeURIComponent(itemId)}/${token}`;
export const optOutPageUrl = (baseUrl: string, itemId: string, token: string): string =>
  `${baseUrl}/email-optout?d=${encodeURIComponent(itemId)}&t=${token}`;

/** The address another tool calls to start an Incoming Webhook rule. */
export const itemHookUrl = (baseUrl: string, itemId: string, ruleId: string): string =>
  `${baseUrl}/api/hooks/automations/${encodeURIComponent(itemId)}/${encodeURIComponent(ruleId)}`;

export interface KitMailInput {
  look: ItemEmailLook;
  // The app's own address, with no slash at its end.
  baseUrl: string;
  itemId: string;
  // The item's name now, and the link that opens it.
  itemName(): Promise<string>;
  itemUrl: string;
  // Where a person of the item gets mail: undefined for no verified address, or for someone who turned it off.
  addressOf(personId: string): Promise<string | undefined>;
  send(email: ItemRenderedEmail & { to: string; oneClick?: true }): Promise<unknown>;
}

export function kitMail(input: KitMailInput | null): ItemMailer | null {
  if (!input) return null;
  const { look, baseUrl, itemId } = input;
  const about = async (message: ItemMessage) => ({
    subject: message.subject,
    body: message.body,
    rule: message.rule,
    itemName: await input.itemName(),
    url: input.itemUrl,
  });
  return {
    optOutDoor: (token) => optOutDoorUrl(baseUrl, itemId, token),
    optOutPage: (token) => optOutPageUrl(baseUrl, itemId, token),
    sendToAddress: async (address, message, links) =>
      input.send({
        to: address,
        ...itemAutomationAddressEmail(look, { ...(await about(message)), ...links }),
      }),
    sendToPerson: async (personId, message) => {
      const to = await input.addressOf(personId);
      if (!to) return false;
      await input.send({ to, ...itemAutomationEmail(look, await about(message)) });
      return true;
    },
  };
}
