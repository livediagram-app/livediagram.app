// Send Email to typed-in addresses (docs/specs/026-plan/automations.md "Typed-in addresses"; blueprint automations.md
// "Send Email to typed-in addresses"). Before a run's email goes out the room claims it, synchronously on its own
// SQLite (no await between the day's count read and its write, so runs at once never pass the limit between them):
// an address that unsubscribed is passed over, the rest are counted against the plan's AUTOMATION_ADDRESS_EMAILS_PER_DAY
// for the UTC day, as many as fit, and each gets its unguessable unsubscribe token (made the first time it is
// emailed). A count that cannot be read throws, and the caller sends nothing: a fault never lifts the limit. The
// unsubscribe door (routes/email-optout-route.ts) marks a token's address unsubscribed, for good.
import {
  AUTOMATION_ADDRESS_EMAILS_PER_DAY,
  type AutomationRule,
  type Item,
} from '@liveplanner/items';
import { appBaseUrl, sendEmail } from '../../email/client';
import { automationAddressEmail } from '../../email/templates';
import type { PlanEnv } from '../../types';
import type { Sql } from './automation-store';

const DAY_MS = 24 * 60 * 60 * 1000;
const midnight = (now: number) => Math.floor(now / DAY_MS) * DAY_MS;

// A token: 32 random bytes, base64url (43 characters), so nobody guesses another address's link.
export const OPTOUT_TOKEN = /^[A-Za-z0-9_-]{43}$/;

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export type AddressClaim = {
  // The addresses to email now, each with its unsubscribe token: counted against the day already.
  send: { address: string; token: string }[];
  // Passed over: they unsubscribed.
  unsubscribed: string[];
  // How many the day's limit left out.
  capped: number;
};

// The emails this plan sent to typed-in addresses today (UTC). Throws when the count does not read as a number.
export function addressEmailsToday(sql: Sql, now: number): number {
  const row = sql
    .exec('SELECT sent FROM automation_email_days WHERE day = ?', midnight(now))
    .toArray()[0];
  const sent = row === undefined ? 0 : Number(row['sent']);
  if (!Number.isInteger(sent) || sent < 0) throw new Error('the day’s email count is unreadable');
  return sent;
}

/** One step's addresses claimed: the unsubscribed passed over, the rest counted against today's limit as far as it
 *  goes, each one to send given its token. Synchronous; throws when the day's count cannot be read or written, and
 *  then nothing is claimed. */
export function claimAddresses(
  sql: Sql,
  addresses: readonly string[],
  now: number,
  cap = AUTOMATION_ADDRESS_EMAILS_PER_DAY,
): AddressClaim {
  const unsubscribed: string[] = [];
  const wanted: { address: string; token: string | null }[] = [];
  for (const address of addresses) {
    const row = sql
      .exec(
        'SELECT token, unsubscribed_at FROM automation_email_addresses WHERE address = ?',
        address,
      )
      .toArray()[0];
    if (row && row['unsubscribed_at'] !== null) unsubscribed.push(address);
    else wanted.push({ address, token: row ? (row['token'] as string) : null });
  }
  const left = Math.max(0, cap - addressEmailsToday(sql, now));
  const taken = wanted.slice(0, left);
  if (taken.length) {
    const day = midnight(now);
    sql.exec(
      `INSERT INTO automation_email_days (day, sent) VALUES (?, ?)
       ON CONFLICT (day) DO UPDATE SET sent = sent + excluded.sent`,
      day,
      taken.length,
    );
    sql.exec('DELETE FROM automation_email_days WHERE day < ?', day - DAY_MS);
  }
  const send = taken.map(({ address, token }) => {
    if (token) return { address, token };
    const made = newToken();
    sql.exec(
      'INSERT INTO automation_email_addresses (address, token, unsubscribed_at) VALUES (?, ?, NULL)',
      address,
      made,
    );
    return { address, token: made };
  });
  return { send, unsubscribed, capped: wanted.length - taken.length };
}

/** The unsubscribe door's write: the token's address stops getting this plan's rule emails. False for a token the
 *  plan never made. Unsubscribing twice keeps the first moment. */
export function optOutAddress(sql: Sql, token: string, now: number): boolean {
  if (!OPTOUT_TOKEN.test(token)) return false;
  const found = sql
    .exec('SELECT address FROM automation_email_addresses WHERE token = ?', token)
    .toArray();
  if (found.length === 0) return false;
  sql.exec(
    'UPDATE automation_email_addresses SET unsubscribed_at = ? WHERE token = ? AND unsubscribed_at IS NULL',
    now,
    token,
  );
  return true;
}

// The one-click door a mail client POSTs to (List-Unsubscribe), and the page the email's link opens.
export const optOutDoor = (env: PlanEnv, planId: string, token: string): string =>
  `${appBaseUrl(env)}/api/email-optout/${encodeURIComponent(planId)}/${token}`;
export const optOutPage = (env: PlanEnv, planId: string, token: string): string =>
  `${appBaseUrl(env)}/email-optout?p=${encodeURIComponent(planId)}&t=${token}`;

/** The claimed addresses emailed, one at a time, from liveplanner's own sender with the fixed words and each one's
 *  unsubscribe link. Never throws for one address: sendEmail answers a refusal. */
export async function sendToAddresses(
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
): Promise<void> {
  for (const { address, token } of send)
    await sendEmail(env, {
      to: address,
      ...automationAddressEmail(env, {
        subject: input.subject,
        body: input.body,
        rule: input.rule.name,
        planName: input.planName,
        cardUrl: input.cardUrl,
        unsubscribeUrl: optOutDoor(env, planId, token),
        unsubscribePage: optOutPage(env, planId, token),
      }),
    });
}
