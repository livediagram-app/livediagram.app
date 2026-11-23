// What livehuddle says about Call Minutes (docs/specs/012-collaboration/call-minutes.md "What people see"): every
// sentence in one place. The numbers are always the ones the api answered; only what the tier above gives is read
// from the subscription contract, and only for someone who may move to it. Pure.
import { TIER_NAMES, type PaidTier } from '@liveworkspace/subscription';
import {
  monthResetDay,
  tierAbove,
  tierCount as count,
  usedOf,
} from '@liveworkspace/subscription-ui/item-tier';

/** The day the month's count starts again, as the reader's locale writes it: "1 December". Months are UTC months. */
export const callMinutesResetDay = monthResetDay;

/** What the tier above has: "Pro has 5,000." or "Pro for Teams has 2,500 a member." Empty with nobody to offer. */
export function callMinutesOffer(tier: PaidTier | null): string {
  if (!tier) return '';
  return `${TIER_NAMES[tier]} has ${tierAbove('callMinutesPerMonth', tier)}.`;
}

export const CALL_MINUTES_TITLE = 'Call Minutes';
export const CALL_MINUTES_ABOUT =
  'Counted while two or more people are in a call: each of them, every minute. Being here alone counts nothing.';

/** Beside the big number: "of 1,000 used". */
export function callMinutesOfUsed(limit: number): string {
  return `of ${count(limit)} used`;
}

/** The meter's words for a screen reader, and the used-up meter's own: "1,000 of 1,000". */
export const callMinutesUsedOf = usedOf;

export const callMinutesCount = count;

/** "Resets on 1 December." */
export function callMinutesResets(now: number, locale?: string): string {
  return `Resets on ${callMinutesResetDay(now, locale)}.`;
}

/** In a call, running low: "80 call minutes left this month." and, with no tier above to offer, when they start again. */
export function callMinutesLowWords(
  left: number,
  offer: PaidTier | null,
  now: number,
  locale?: string,
): string {
  const words = `${count(left)} call ${left === 1 ? 'minute' : 'minutes'} left this month.`;
  return offer
    ? `${words} ${callMinutesOffer(offer)}`
    : `${words} They start again on ${callMinutesResetDay(now, locale)}.`;
}

export const CALL_MINUTES_USED_TITLE = 'This Month’s Call Minutes Are Used';

/** For the owner and the owning team: "Calls start again on 1 December. The Space, its chat and everything on its
 *  walls still work." */
export function callMinutesUsedWords(now: number, locale?: string): string {
  return `Calls start again on ${callMinutesResetDay(now, locale)}. The Space, its chat and everything on its walls still work.`;
}

export const CALLS_PAUSED_TITLE = 'Calls Are Paused';

/** For everyone else, guests included: "Calls are paused in this Space until 1 December." Nothing about the owner. */
export function callsPausedWords(now: number, locale?: string): string {
  return `Calls are paused in this Space until ${callMinutesResetDay(now, locale)}.`;
}

/** In a guest's Space (its owner has no account): the same, and the way on, which is never an upgrade. */
export function callsPausedGuestWords(now: number, locale?: string): string {
  return `${callsPausedWords(now, locale)} Sign in to keep this Space as your own.`;
}

/** The dock's Calls Paused hover card. */
export function callsPausedHover(now: number, locale?: string): string {
  return `${callsPausedWords(now, locale)} Everything else in the Space carries on.`;
}
