// Ask AI on AI credits, with Pro on (liveworkspace/docs/specs/020-ask/ask.md "AI credits"; 019 "What an AI operation
// costs"): who pays for a built-in question, and the one spend before the model is called. The item's owner (its team
// for a team's item) pays for an Editor or a Participant, by the one rule every app follows (`itemPayer`); a Viewer
// is lent nothing and pays themself, as does anyone the index will not name the item for; a guest's item is nobody's.
// With Pro off the app hands no door, so nothing here runs: no grant is read and the service is never asked.
import {
  AI_CREDIT_COSTS,
  itemPayer,
  personScope,
  refusedByService,
  subscriptionClientOf,
  type OwnerScope,
  type SubscriptionApp,
  type SubscriptionClient,
  type SubscriptionEnv,
} from '@liveworkspace/subscription';
import type { AskRefusalCode } from '../wire';
import { spendAskByOthers, type AskCountNamespace } from './daily-count';

export const ASK_CREDITS_WORDS = {
  used: "This month's AI credits are used. Your own AI key still answers.",
  unchecked: 'AI credits could not be checked. Try again in a moment.',
  byOthers:
    'Built-in AI here has had its fill for today. Try again tomorrow, or use your own AI key.',
  countFailed: "The built-in AI couldn't answer just now. Try again in a moment.",
} as const;

/** The index's grant on the item for the asker, as far as paying needs it. */
export type AskGrant = { level: string; owner?: string | null; team?: string | null };

export type AskCreditsDoor = {
  client: Pick<SubscriptionClient, 'spend'>;
  /** The teams the asker has joined. */
  teams: readonly string[];
  /** The asker's grant on the item, or null where the index names none (a Response or a fault reads as none). */
  grant: (itemId: string) => Promise<AskGrant | null>;
  /** Counts one question charged to the item's owner by someone else today (`spendAskByOthers`). */
  byOthers: (itemId: string, now: number) => Promise<boolean | 'unavailable'>;
};

/** Who pays: the scope, whether the asker may see its numbers (the owner, or the owning team's member), and the
 *  item whose by-others count it takes when the asker is someone else. */
export type AskPayer = { scope: OwnerScope; theirs: boolean; others: string | null };

/** Who pays for `accountId`'s built-in question about `itemId`; null for nobody (a guest's item). */
export async function askPayer(
  door: Pick<AskCreditsDoor, 'grant' | 'teams'>,
  accountId: string,
  itemId: string | null,
): Promise<AskPayer | null> {
  const own: AskPayer = { scope: personScope(accountId), theirs: true, others: null };
  if (!itemId) return own;
  const grant = await door.grant(itemId).catch(() => null);
  // A Viewer is lent nothing: their questions are their own month's.
  if (!grant || (grant.level !== 'edit' && grant.level !== 'participate')) return own;
  const payer = itemPayer(grant);
  if (payer.kind === 'guest') return null;
  if (payer.kind === 'nobody') return own;
  const team = grant.team;
  const theirs = team ? door.teams.includes(team) : grant.owner === accountId;
  return { scope: payer.scope, theirs, others: theirs ? null : itemId };
}

export type AskCreditRefusal = {
  status: number;
  error: AskRefusalCode;
  message: string;
  more?: { limit: 'aiCreditsPerMonth'; owner: OwnerScope; used?: number; max?: number };
};

/** Spend the question's credit (`AI_CREDIT_COSTS.ask`, or `cost` for another built-in operation paid as Ask's are,
 *  such as Send to Knowledge Base's summary) from whoever pays: null to go ahead, else the refusal. */
export async function chargeAsk(
  door: AskCreditsDoor,
  accountId: string,
  itemId: string | null,
  now: number,
  cost: number = AI_CREDIT_COSTS.ask,
): Promise<AskCreditRefusal | null> {
  const payer = await askPayer(door, accountId, itemId);
  if (!payer) return null;
  // Someone else's month: the item takes only so many such questions a day.
  if (payer.others !== null) {
    const taken = await door.byOthers(payer.others, now);
    if (taken === 'unavailable')
      return { status: 503, error: 'ask_unavailable', message: ASK_CREDITS_WORDS.countFailed };
    if (!taken)
      return { status: 429, error: 'ask_by_others_limit', message: ASK_CREDITS_WORDS.byOthers };
  }
  const spent = await door.client.spend(payer.scope, 'aiCredits', cost);
  if (spent.ok) return null;
  // The service refused this api's request (its key, never the month): not asked, and no offer.
  if (refusedByService(spent)) {
    console.error('[ask] credits not checked: the subscription service refused the request');
    return { status: 503, error: 'ask_unavailable', message: ASK_CREDITS_WORDS.unchecked };
  }
  console.info('[ask] credits used');
  return {
    status: 429,
    error: 'ai_credits_used',
    message: ASK_CREDITS_WORDS.used,
    // The owner's scope to a signed-in asker, for the action they may take; the numbers to the owner's side alone.
    more: {
      limit: 'aiCreditsPerMonth',
      owner: payer.scope,
      ...(payer.theirs ? { used: spent.used, max: spent.limit ?? 0 } : {}),
    },
  };
}

/** The door an app's route hands `serveAsk`, or null with Pro off, where nothing is read or asked. */
export function askCreditsOf(opts: {
  env: SubscriptionEnv;
  app: SubscriptionApp;
  rooms: AskCountNamespace | undefined | null;
  teams: readonly { id: string }[] | null | undefined;
  grant: (itemId: string) => Promise<AskGrant | Response | null>;
}): AskCreditsDoor | null {
  const client = subscriptionClientOf(opts.env, opts.app);
  if (!client.enabled) return null;
  return {
    client,
    teams: (opts.teams ?? []).map((team) => team.id),
    grant: async (itemId) => {
      const grant = await opts.grant(itemId);
      return grant instanceof Response ? null : grant;
    },
    byOthers: (itemId, now) => spendAskByOthers(opts.rooms, itemId, now),
  };
}
