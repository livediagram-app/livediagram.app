// How pages and the apps' Workers talk to liveworkspace's subscription service (subscription.md "The subscription
// Worker"): where it lives, the headers it reads, and the shapes it takes and gives.

import type { OwnerScope } from './owner';
import type { Currency, PaidTier, PriceList } from './prices';
import { TIER_LIMITS, type LimitKey, type Limits, type Tier } from './tiers';

export const SUBSCRIPTION_API_PATH = '/api/subscription';
export const SUBSCRIPTION_API_URL = `https://www.liveworkspace.app${SUBSCRIPTION_API_PATH}`;

/** An app's Worker names itself here and carries its key as `Authorization: Bearer <key>`. */
export const SUBSCRIPTION_APP_HEADER = 'X-Subscription-App';

export const SUBSCRIPTION_APPS = [
  'livediagram.app',
  'liveplanner.app',
  'livedocuments.app',
  'livedesign.app',
  'livehuddle.app',
  'liveknowledge.app',
  'liveworkspace.app',
] as const;
export type SubscriptionApp = (typeof SUBSCRIPTION_APPS)[number];

export function isSubscriptionApp(value: unknown): value is SubscriptionApp {
  return SUBSCRIPTION_APPS.some((app) => app === value);
}

// --- States ---

export const SUBSCRIPTION_STATES = ['active', 'cancelling', 'past_due', 'ended'] as const;
export type SubscriptionState = (typeof SUBSCRIPTION_STATES)[number];

/** How long Pro lasts after a renewal fails. */
export const GRACE_DAYS = 7;
export const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000;

/**
 * How far either side of its period's end a renewal is taken. A provider's word on a renewal (paid, or failed)
 * lands within hours of the period ending, so an `active` subscription stays live this long past its period's end
 * while that word is on its way, and a renewal reported earlier than this before the end is refused: months never
 * stack.
 */
export const RENEWAL_TOLERANCE_DAYS = 3;
export const RENEWAL_TOLERANCE_MS = RENEWAL_TOLERANCE_DAYS * 24 * 60 * 60 * 1000;

// --- Meters ---

/** Counted by the service per owner and month; an app spends before it does the work. */
export const SPEND_METERS = [
  'automationRuns',
  'emailToBoard',
  'formResponses',
  'aiCredits',
  'callMinutes',
] as const;
export type SpendMeter = (typeof SPEND_METERS)[number];

export function isSpendMeter(value: unknown): value is SpendMeter {
  return SPEND_METERS.some((meter) => meter === value);
}

export const SPEND_METER_LIMIT = {
  automationRuns: 'automationRunsPerMonth',
  emailToBoard: 'emailToBoardPerMonth',
  formResponses: 'formResponsesPerMonth',
  aiCredits: 'aiCreditsPerMonth',
  callMinutes: 'callMinutesPerMonth',
} as const satisfies Record<SpendMeter, keyof Limits>;

/** Counts the service holds per owner, one entry per thing held (a published roadmap, a knowledgebase published to
 *  the web). */
export const GAUGES = ['publicRoadmaps', 'publicKnowledgebases'] as const;
export type Gauge = (typeof GAUGES)[number];

export function isGauge(value: unknown): value is Gauge {
  return GAUGES.some((gauge) => gauge === value);
}

export const GAUGE_LIMIT = {
  publicRoadmaps: 'publicRoadmaps',
  publicKnowledgebases: 'publicKnowledgebases',
} as const satisfies Record<Gauge, keyof Limits>;

/**
 * What media holds for an owner (a person's or a team's gallery, a person's walkthroughs). Media counts them live,
 * where it enforces them; the service keeps no copy, and asks media when it shows an owner their usage, so the
 * figure shown can never drift from the one enforced.
 */
export const MEDIA_COUNTS = ['imageStorageBytes', 'walkthroughsStored'] as const;
export type MediaCount = (typeof MEDIA_COUNTS)[number];

/** What the subscription service names itself to media, in media's own caller header, with the key the two share. */
export const MEDIA_USAGE_CALLER = 'subscription';
export const MEDIA_USAGE_CALLER_HEADER = 'X-Media-App';
/** `POST <media>/app/usage/owners`: several owners' counts in one call. */
export const MEDIA_USAGE_OWNERS_MAX = 60;
export type MediaUsageRequest = { owners: OwnerScope[] };
/** An owner media holds nothing for is absent. */
export type MediaUsageResponse = { usage: Partial<Record<OwnerScope, Record<MediaCount, number>>> };

/**
 * Standing counts an owner holds over every item they own (their automation rules, their knowledgebases' pages):
 * each item tells the service its own count, and the service sums them. A count that grows is refused, atomically,
 * when it would take the owner's total past the limit; one that does not grow is always recorded.
 */
export const ITEM_METERS = ['rules', 'pages'] as const;
export type ItemMeter = (typeof ITEM_METERS)[number];

export function isItemMeter(value: unknown): value is ItemMeter {
  return ITEM_METERS.some((meter) => meter === value);
}

export const ITEM_METER_LIMIT = {
  rules: 'automationRules',
  pages: 'knowledgebasePages',
} as const satisfies Record<ItemMeter, keyof Limits>;

export type UsageKey = SpendMeter | Gauge | MediaCount | ItemMeter;

/** What an owner has used of one limit. */
export type UsageEntry = { used: number };
export type Usage = Partial<Record<UsageKey, UsageEntry>>;

// --- The apps' Workers ---

/** What an app's Worker enforces for an owner: the tier and its limits, a team's pooled ones already multiplied. */
export type Entitlement = {
  owner: OwnerScope;
  tier: Tier;
  seats: number;
  limits: Limits;
};

export type EntitlementRequest = { owner: OwnerScope };

export type SpendRequest = { owner: OwnerScope; meter: SpendMeter; amount: number };
/**
 * Why an answer is the client's own and not the service's: the service could not be reached (the spend is allowed
 * and nothing was counted), it answered but refused the request (a wrong key, a body it will not take: nothing is
 * allowed), or this Worker holds no key (allowed against Free's numbers, uncounted; refused where Free has none).
 */
export type UnmeteredReason = 'unreachable' | 'refused' | 'no_key';

/** `ok` false means nothing was spent: the limit was reached, or (`unmetered`) the service refused the request.
 *  `limit` null is unlimited. `unmetered` is absent on the service's own answer. */
export type SpendResult = {
  ok: boolean;
  used: number;
  limit: number | null;
  tier: Tier;
  unmetered?: UnmeteredReason;
};

export type GaugeRequest = { owner: OwnerScope; gauge: Gauge; op: 'add' | 'remove'; key: string };
/** `ok` false means an `add` would pass the limit and was not recorded, or (`unmetered`) the service refused the
 *  request. `unmetered` is absent on the service's own answer. */
export type GaugeResult = {
  ok: boolean;
  used: number;
  limit: number | null;
  tier: Tier;
  unmetered?: UnmeteredReason;
};

/** One item's standing count. `adding`: the count grows because someone is adding (a rule, a page), so it is refused
 *  past the owner's limit; without it the count is recorded whatever the total (a delete, an item that changed
 *  owner, a count told again). */
export type ItemCountRequest = {
  owner: OwnerScope;
  meter: ItemMeter;
  item: string;
  used: number;
  adding?: boolean;
};
/** `ok` false means the count was not recorded: it would take the owner past the limit, or (`unmetered`) the service
 *  refused the request. `used` is the owner's total over every item, with this item's count when it was recorded.
 *  `unmetered` is absent on the service's own answer. */
export type ItemCountResult = {
  ok: boolean;
  used: number;
  limit: number | null;
  tier: Tier;
  unmetered?: UnmeteredReason;
};

export const GAUGE_KEY_MAX = 200;
/** No single spend is larger than this: a call's minutes are spent as they pass, never in one lump. */
export const SPEND_AMOUNT_MAX = 1000;

// --- A person's browser ---

/** One owner's subscription as its owner, or a member of its team, sees it. */
export type SubscriptionSummary = {
  owner: OwnerScope;
  tier: Tier;
  /** Null on Free. */
  state: SubscriptionState | null;
  seats: number;
  /** The currency the subscription was taken in, and what it costs a month in all. Null on Free, and for a team's
   *  member who is not one of its admins: a team's billing is its admins' to see. */
  currency: Currency | null;
  amount: number | null;
  /** When the paid period renews, or while `cancelling` the day Pro ends, in ms. Null on Free, and for a team's
   *  member who is not one of its admins. */
  periodEnd: number | null;
  /** While `past_due`: the day Pro ends unless the payment is recovered (the later of the paid period's end and
   *  grace's). Null otherwise, and for a team's member who is not one of its admins. */
  graceEnds: number | null;
  limits: Limits;
  usage: Usage;
  /** Only on Free, for an owner whose paid tier ended within `ENDED_SHOWN_MS` and who has not dismissed the word
   *  of it: when it ended, in ms, and the tier it was. Never for a team's member who is not one of its admins. */
  endedAt?: number;
  endedTier?: PaidTier;
};

/** How long after a paid tier ended its owner is still told so ("You're Back on Free"). */
export const ENDED_SHOWN_DAYS = 30;
export const ENDED_SHOWN_MS = ENDED_SHOWN_DAYS * 24 * 60 * 60 * 1000;

/** One member's request for Pro for Teams, as the team's admins see it: who, the limit that prompted it, their note
 *  (at most `TEAM_REQUEST_NOTE_MAX` characters), when. */
export type TeamRequest = {
  name: string | null;
  limit: LimitKey | null;
  note: string | null;
  at: number;
};
/** The longest note a member may send with a request for Pro for Teams. */
export const TEAM_REQUEST_NOTE_MAX = 500;
/** How many members have asked lately, and the newest few of them. */
export type TeamRequests = { count: number; latest: TeamRequest[] };
/** A request is shown to the team's admins for this long, and then dropped. */
export const TEAM_REQUESTS_KEPT_DAYS = 30;
export const TEAM_REQUESTS_KEPT_MS = TEAM_REQUESTS_KEPT_DAYS * 24 * 60 * 60 * 1000;
/** No more requests than this are named to an admin; `count` covers the rest. */
export const TEAM_REQUESTS_SHOWN = 5;

export type TeamSubscription = SubscriptionSummary & {
  teamId: string;
  name: string;
  role: 'admin' | 'member';
  members: number;
  /** A Free team's members who asked for Pro for Teams lately. Only for its admins, and absent when nobody has. */
  requests?: TeamRequests;
  /** When the caller themself last asked this team's admins, in ms. Absent when they have not lately. */
  askedAt?: number;
};

export type MeResponse = {
  personal: SubscriptionSummary;
  teams: TeamSubscription[];
  prices: PriceList;
  /** `stripe`, `mock` (never in production), or `none` when no provider is set up. */
  provider: string;
};

/** What a page may know of the owner of the item it has open: enough to word a limit and offer the right action. */
export type OwnerView = {
  owner: OwnerScope;
  /** Null, with `limits`, for someone who is neither the owner nor on the owning team: whether another person or
   *  team subscribes is not theirs to learn. The item's own app tells them the limits they meet. */
  tier: Tier | null;
  limits: Limits | null;
  /** `upgrade` for the owner or a team admin, `ask_admin` for a team's other members, `none` for anyone else. */
  action: 'upgrade' | 'manage' | 'ask_admin' | 'none';
};

/** Whether `value` names one of the contract's limits. */
export function isLimitKey(value: unknown): value is LimitKey {
  return typeof value === 'string' && Object.hasOwn(TIER_LIMITS.free, value);
}

/** `POST /team-request`: a team's member asks its admins for Pro for Teams, naming the limit that prompted it. */
export type TeamRequestBody = { owner: OwnerScope; limit?: LimitKey | null; note?: string | null };
/** `sent` false means this member already asked this team today: nothing new was recorded, and `askedAt` is when
 *  they did. */
export type TeamRequestResponse = { sent: boolean; askedAt: number };

/** `POST /ended/dismiss`: the owner has read "You're Back on Free". */
export type DismissEndedRequest = { owner: OwnerScope };

export type CheckoutRequest = { owner: OwnerScope; returnTo: string };
export type PortalRequest = { owner: OwnerScope; returnTo: string };
/** Where to send the person: the checkout, or the billing portal. */
export type RedirectResponse = { url: string };

export type PricesResponse = { prices: PriceList };

/** The refusals the service answers with, as `{ error }`. */
export const SUBSCRIPTION_ERRORS = [
  'unauthorised',
  'bad_request',
  'not_found',
  'not_team_admin',
  /** A request for Pro for Teams from someone who is not a joined member of that team now. */
  'not_team_member',
  'already_subscribed',
  'not_subscribed',
  /** A billing change the subscription's state does not allow: resuming one that was never cancelled, say. */
  'invalid_state',
  'rate_limited',
  /** No billing provider is set up, so nothing can be bought or managed. */
  'billing_unavailable',
  /** A team's billing needs accounts to say the caller is one of its admins now, and accounts could not. Try again. */
  'accounts_unavailable',
] as const;
export type SubscriptionError = (typeof SUBSCRIPTION_ERRORS)[number];

// --- The mock billing provider's pages (subscription.md "Billing") ---

/** What the mock checkout page shows. Its id is an unguessable token, as a hosted checkout's link is. */
export type MockCheckout = {
  id: string;
  owner: OwnerScope;
  /** The person's or the team's name. */
  ownerName: string;
  tier: Exclude<Tier, 'free'>;
  seats: number;
  currency: Currency;
  /** One seat, and the whole month. */
  unitAmount: number;
  amount: number;
  returnTo: string;
};

export const MOCK_CHECKOUT_ACTIONS = ['pay', 'cancel'] as const;
export type MockCheckoutAction = (typeof MOCK_CHECKOUT_ACTIONS)[number];

/** What the mock billing portal shows. */
export type MockPortal = {
  id: string;
  ownerName: string;
  subscription: SubscriptionSummary;
  /** A team's joined members, which its seats follow. Null for a person. */
  members: number | null;
  returnTo: string;
};

/** Cancel and Resume are a subscriber's own. The rest stand in for what Stripe's webhooks will report. */
export const MOCK_PORTAL_ACTIONS = [
  'cancel',
  'resume',
  'fail_payment',
  'recover_payment',
  'end_grace',
  'end_period',
  'renew',
  'set_seats',
] as const;
export type MockPortalAction = (typeof MOCK_PORTAL_ACTIONS)[number];

export type MockPortalRequest = { action: MockPortalAction; seats?: number };
