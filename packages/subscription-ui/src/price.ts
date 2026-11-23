// How a price reads beside its amount (subscription.md "Price"): monthly only, and Pro for Teams by the member from
// its smallest team. The amounts come from the service, formatted for the browser's locale by the contract.
import {
  formatPrice,
  seatsFor,
  TEAM_SEATS_MIN,
  type PaidTier,
  type PriceList,
  type SubscriptionSummary,
} from '@liveworkspace/subscription';

/** "a month" for Pro; "a member a month, 3 or more" for Pro for Teams. */
export function pricePeriod(tier: PaidTier): string {
  return tier === 'team' ? `a member a month, ${TEAM_SEATS_MIN} or more` : 'a month';
}

/** A paid tier's amount in the visitor's currency: "£8". */
export function tierPrice(prices: PriceList, tier: PaidTier, locale?: string): string {
  return formatPrice(prices[tier], prices.currency, locale);
}

/** "£8 a month", "£6 a member a month, 3 or more". */
export function tierPriceLine(prices: PriceList, tier: PaidTier, locale?: string): string {
  return `${tierPrice(prices, tier, locale)} ${pricePeriod(tier)}`;
}

/** What a team of `members` pays a month in all: its seats (never fewer than the minimum) times the member price. */
export function teamTotal(prices: PriceList, members: number, locale?: string): string {
  return formatPrice(prices.team * seatsFor(members), prices.currency, locale);
}

/** A day as the reader's locale writes it in full: "27 November 2026". */
export function formatDay(ms: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(ms),
  );
}

/** A day as the reader's locale writes it without the year, for something lately: "21 November". */
export function formatShortDay(ms: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(ms),
  );
}

/** What a subscription costs a month in all, in its own currency: "£8 a month". Null on Free. */
export function monthlyCost(summary: SubscriptionSummary, locale?: string): string | null {
  if (summary.amount === null || summary.currency === null) return null;
  return `${formatPrice(summary.amount, summary.currency, locale)} a month`;
}

/** Where a paid subscription stands: "Renews 20 December 2026", "Ends 20 December 2026", or the day grace runs out.
 *  Null on Free, and where the service named no day. */
export function standing(summary: SubscriptionSummary, locale?: string): string | null {
  if (summary.state === 'past_due' && summary.graceEnds !== null)
    return `Payment failed, on until ${formatDay(summary.graceEnds, locale)}`;
  if (summary.periodEnd === null) return null;
  if (summary.state === 'cancelling') return `Ends ${formatDay(summary.periodEnd, locale)}`;
  if (summary.state === 'active') return `Renews ${formatDay(summary.periodEnd, locale)}`;
  return null;
}
