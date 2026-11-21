// Send Email to typed-in addresses (docs/specs/026-plan/automations.md "Typed-in addresses"; blueprint automations.md
// "Send Email to typed-in addresses"). Before a run's email goes out the room claims it, synchronously on its own
// SQLite (no await between the day's count read and its write, so runs at once never pass the limit between them):
// an address that unsubscribed is passed over, the rest are counted against the plan's AUTOMATION_ADDRESS_EMAILS_PER_DAY
// for the UTC day, as many as fit, and each gets its unguessable unsubscribe token (made the first time it is
// emailed). A count that cannot be read throws, and the caller sends nothing: a fault never lifts the limit. The
// unsubscribe door (routes/email-optout-route.ts) marks a token's address unsubscribed, for good.
// The claim, the day's count and the unsubscribe write are @liveworkspace/automations/room's
// (liveworkspace/docs/specs/018-automations/blueprints/engine.md "The room entry"); liveplanner's sender, its email
// and its unsubscribe links are here.
import type { AutomationRule, Item } from '@liveplanner/items';
import {
  sendToAddresses as sendEach,
  type AddressClaim,
  type AddressSends,
} from '@liveworkspace/automations/room';
import { appBaseUrl, sendEmail } from '../../email/client';
import { automationAddressEmail } from '../../email/templates';
import type { PlanEnv } from '../../types';

export {
  OPTOUT_TOKEN,
  addressEmailsToday,
  claimAddresses,
  optOutAddress,
  type AddressClaim,
} from '@liveworkspace/automations/room';

// The one-click door a mail client POSTs to (List-Unsubscribe), and the page the email's link opens.
export const optOutDoor = (env: PlanEnv, planId: string, token: string): string =>
  `${appBaseUrl(env)}/api/email-optout/${encodeURIComponent(planId)}/${token}`;
export const optOutPage = (env: PlanEnv, planId: string, token: string): string =>
  `${appBaseUrl(env)}/email-optout?p=${encodeURIComponent(planId)}&t=${token}`;

/** The claimed addresses emailed, one at a time, from liveplanner's own sender with the fixed words and each one's
 *  unsubscribe link, answering which went and which did not. Never throws for one address. */
export function sendToAddresses(
  env: PlanEnv,
  planId: string,
  input: {
    rule: AutomationRule;
    card: Item;
    planName: string;
    subject: string;
    body: string;
    cardUrl: string;
  },
  send: AddressClaim['send'],
): Promise<AddressSends> {
  return sendEach(
    {
      optOutDoor: (token) => optOutDoor(env, planId, token),
      optOutPage: (token) => optOutPage(env, planId, token),
      compose: (links) =>
        automationAddressEmail(env, {
          subject: input.subject,
          body: input.body,
          rule: input.rule.name,
          planName: input.planName,
          cardUrl: input.cardUrl,
          ...links,
        }),
      send: (to, mail) => sendEmail(env, { to, ...mail }),
    },
    send,
  );
}
