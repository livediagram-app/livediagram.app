// What livediagram says about a photo read's AI credits (docs/specs/021-event-storming/note-reader.md "What the
// editor shows"): every sentence in one place. The numbers are always the ones the api answered; only what the tier above
// gives is read from the subscription contract, and only for someone who may move to it. Pure.
import {
  aiCreditsWords,
  isPerMemberLimit,
  nextMonthStart,
  TIER_LIMITS,
  usesAiCredits,
  type PaidTier,
} from '@liveworkspace/subscription';

const count = (n: number) => n.toLocaleString('en-GB');

/** The day the month's credits come back, as the reader's locale writes it: "1 December". Months are UTC months. */
export function creditsResetDay(now: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(nextMonthStart(now)),
  );
}

/** The quiet line: "Uses 2 AI credits" while the photo is read, "Used 2 AI credits" once it has been. */
export function readCreditLine(reading: boolean, cost: number): string {
  return reading ? usesAiCredits(cost) : `Used ${aiCreditsWords(cost)}`;
}

// --- The choice before a charged read ---

/** The AI choice: "Read 30 Notes with AI". */
export function readWithAiLabel(notes: number): string {
  return `Read ${count(notes)} ${notes === 1 ? 'Note' : 'Notes'} with AI`;
}

/** The free choice. */
export const READ_ON_DEVICE_LABEL = 'Read on This Device';

/** What the free choice gives up, said once beside it. */
export const READ_ON_DEVICE_WORDS =
  'On this device: free, nothing is sent, fewer words read right.';

/** Too few left for the read: "Uses 2 AI credits, and 1 is left this month." */
export function creditsShortWords(cost: number, left: number): string {
  return `${usesAiCredits(cost)}, and ${count(left)} ${left === 1 ? 'is' : 'are'} left this month.`;
}

/** For someone who may know the count: "38 of 50 left this month". */
export function creditsLeftWords(used: number, max: number): string {
  return `${count(Math.max(0, max - used))} of ${count(max)} left this month`;
}

const ON_DEVICE = 'This photo is being read on this device instead.';

/** For the payer and the paying team: "This Month's 50 AI Credits Are Used". */
export function creditsUsedTitle(max: number): string {
  return `This Month’s ${count(max)} AI Credits Are Used`;
}

/** "They come back on 1 December. This photo is being read on this device instead." */
export function creditsUsedWords(now: number, locale?: string): string {
  return `They come back on ${creditsResetDay(now, locale)}. ${ON_DEVICE}`;
}

/** For everyone else: no number, and nothing about the owner. */
export const CREDITS_USED_PLAIN = `This month’s AI credits are used. ${ON_DEVICE}`;

/** What the tier above has: "Pro has 1,000 a month." or "Pro for Teams has 500 a member a month." */
export function creditsOffer(tier: PaidTier): string {
  const most = count(TIER_LIMITS[tier].aiCreditsPerMonth);
  return tier === 'team' && isPerMemberLimit('aiCreditsPerMonth')
    ? `Pro for Teams has ${most} a member a month.`
    : `Pro has ${most} a month.`;
}
