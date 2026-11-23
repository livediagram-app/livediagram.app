// What liveplanner says where a tier's limit shows (email-to-board.md, public-roadmap.md and 030-forms/forms.md
// "Tiers"): its own sentences, beside the shared ones every app says (@liveworkspace/subscription-ui/item-tier:
// numbers, the day a month starts again, AI credits) and the Automations ones (@liveworkspace/automations-ui). The
// count and the limit in a sentence are always the ones the api answered. Pure.

import {
  monthResetDay,
  offerAbove,
  tierCount,
  tierPlural,
  type TierVoice,
  type TierWords,
} from '@liveworkspace/subscription-ui/item-tier';

export {
  AI_DRAFT_CREDIT,
  AI_STEP_CREDIT,
  creditsLeftLine,
  creditsUsedWords,
  monthResetDay,
  usedOf,
  type TierWords,
} from '@liveworkspace/subscription-ui/item-tier';

// Whose month a sentence is about: "your", "this team’s", or for anyone outside the owner "this plan’s owner’s".
const whoseMonth = (voice: TierVoice) =>
  voice.whose === 'yours' ? 'your' : voice.whose === 'team' ? 'this team’s' : null;

// --- Email to Board ---

/** The owner's month of emails to boards is used, over all their plans: "This month's 500 emails to your boards have
 *  become cards. More are turned away until 1 December, and the sender is told." and "Pro takes 10,000 a month."
 *  Anyone outside the owner is told no number. */
export function emailsSpentWords(
  max: number,
  voice: TierVoice,
  now: number,
  locale?: string,
): TierWords {
  const whose = whoseMonth(voice);
  const until = `More are turned away until ${monthResetDay(now, locale)}, and the sender is told.`;
  const above = offerAbove(voice, 'emailToBoardPerMonth');
  return {
    sentence:
      whose && voice.tier
        ? `This month’s ${tierCount(max)} emails to ${whose} boards have become cards. ${until}`
        : `This plan’s owner has used this month’s emails to boards. ${until}`,
    offer: above ? `${above.name} takes ${above.more} a month.` : '',
  };
}

// --- Form Responses ---

/** The owner's month of responses is used, over all their forms, for whoever edits a form: "Your forms have taken
 *  Free's 500 responses for the month. This form takes responses again on 1 December, or now with 10,000 a month on
 *  Pro."
 *  Anyone outside the owner is told no number or tier. */
export function formMonthFullWords(
  max: number,
  voice: TierVoice,
  now: number,
  locale?: string,
): string {
  const whose = whoseMonth(voice);
  const above = offerAbove(voice, 'formResponsesPerMonth');
  const or = above
    ? `, or now with ${above.more}${above.more.endsWith('a member') ? '' : ' a month'} on ${above.name}`
    : '';
  const again = `This form takes responses again on ${monthResetDay(now, locale)}${or}.`;
  if (!whose || !voice.tier)
    return `This plan’s owner has used this month’s form responses. ${again}`;
  const forms = whose === 'your' ? 'Your forms have' : 'This team’s forms have';
  return `${forms} taken ${voice.tier}’s ${tierCount(max)} responses for the month. ${again}`;
}

/** The status bar's Paused, as its tooltip. */
export const FORM_MONTH_PAUSED =
  'Paused until next month: this month’s form responses are all taken.';

// --- Public Roadmaps ---

export const ROADMAP_LIMIT_TITLE = 'Publish This Board as a Roadmap';
export const ROADMAP_NEVER_LIMITED = 'Visitors and votes on a published roadmap are never limited.';

/** Who holds the owner's places: one roadmap of this plan (named), several of this plan, or boards of other plans. */
export type RoadmapHolder =
  { where: 'here'; title: string } | { where: 'here-many' } | { where: 'elsewhere' };

/** Every roadmap the owner's tier allows is published: "Free publishes 1 roadmap, and "Product Roadmap" is using it.
 *  Pro publishes 10." */
export function roadmapsFullWords(max: number, holder: RoadmapHolder, voice: TierVoice): TierWords {
  const who = voice.tier ?? 'This plan’s owner';
  const using =
    max === 1
      ? holder.where === 'here'
        ? `“${holder.title}” is using it`
        : 'a board in another plan is using it'
      : holder.where === 'elsewhere'
        ? `all ${tierCount(max)} are published, some in other plans`
        : `all ${tierCount(max)} are published`;
  const sentence = `${who} publishes ${tierCount(max)} ${tierPlural(max, 'roadmap', 'roadmaps')}, and ${using}.`;
  // With no switch to offer, the way on is to unpublish one by hand.
  const byHand =
    holder.where === 'here'
      ? ''
      : max === 1
        ? ' Unpublish it there to publish this board.'
        : ' Unpublish one to publish this board.';
  if (!voice.offer) return { sentence: `${sentence}${byHand}`, offer: '' };
  const above = offerAbove(voice, 'publicRoadmaps');
  return {
    sentence: `${sentence}${byHand}`,
    offer: above
      ? `${above.name} publishes ${above.more}.`
      : `${voice.offer.name} publishes as many as you like.`,
  };
}

/** Publish This One Instead, before it unpublishes the other. */
export function roadmapSwapConfirm(title: string): { message: string; warning: string } {
  return {
    message: `Unpublish “${title}” and publish this board?`,
    warning: 'The other roadmap’s link stops working at once.',
  };
}
