// What a new subscription changed, for the notice that greets it (subscription.md "Back from the checkout"). Every
// figure is the contract's, so the notice can never promise a number the service does not enforce.
import { formatAmount, limitRow, TIER_LIMITS, type PaidTier } from '@liveworkspace/subscription';

/** One thing gained: the words that lead, in bold, and the rest of the sentence. */
export type Gain = { key: string; lead: string; rest: string };

const amount = (tier: PaidTier | 'free', key: Parameters<typeof limitRow>[0]): string => {
  const value = TIER_LIMITS[tier][key];
  return typeof value === 'number' ? formatAmount(limitRow(key), value) : '';
};

/** The three gains said on the way back from a checkout: more runs, more rules, and room for AI, images and
 *  history. Each is counted across everything the owner has, in every app. */
export function subscribedGains(tier: PaidTier): readonly Gain[] {
  // A team's figures are for each member, pooled.
  const perMember = tier === 'team';
  return [
    {
      key: 'runs',
      lead: `${amount(tier, 'automationRunsPerMonth')} automation runs a month${perMember ? ' for each member' : ''}`,
      rest: ` across ${perMember ? 'the team’s' : 'all your'} items, up from ${amount('free', 'automationRunsPerMonth')}. A message to Slack, Teams or a webhook is one run.`,
    },
    {
      key: 'rules',
      lead: `${amount(tier, 'automationRules')} automation rules${perMember ? ' for each member' : ''}`,
      rest: `, up from ${amount('free', 'automationRules')}.`,
    },
    {
      key: 'room',
      lead: `${amount(tier, 'aiCreditsPerMonth')} AI credits ${perMember ? 'a member' : 'a month'}, ${amount(tier, 'imageStorageBytes')} of images`,
      rest: ', and every version and snapshot kept.',
    },
  ];
}
