// The Subscription category's sentences (liveworkspace/docs/specs/019-subscription/subscription.md "States",
// "Billing states"). Amounts are the subscription's own, in the currency it was taken in; days are written for the
// reader's locale.
import {
  formatAmount,
  limitRow,
  TIER_LIMITS,
  TIER_NAMES,
  type LimitKey,
  type PaidTier,
  type SubscriptionSummary,
  type TeamSubscription,
} from '@liveworkspace/subscription';
import { formatDay, formatShortDay, monthlyCost, standing } from '@liveworkspace/subscription-ui';

/** The tier card's line under a paid tier's name: "£8 a month. Renews 20 December 2026." */
export function paidLine(summary: SubscriptionSummary): string {
  return [monthlyCost(summary), standing(summary)].filter(Boolean).join('. ') + '.';
}

export const FREE_LINE = 'Every app, with everyday limits. Pro raises them all.';

/** Past due: Pro stays on until the day the service names, which is never before the month paid for ends. */
export function pastDueBody(summary: SubscriptionSummary): string {
  const name = TIER_NAMES[summary.tier];
  const until = summary.graceEnds !== null ? `until ${formatDay(summary.graceEnds)}` : 'for now';
  return `${name} stays on ${until} while you sort it out. Nothing changes before then.`;
}

/** Cancelling: the heading names the day the tier ends. */
export function cancellingTitle(summary: SubscriptionSummary): string {
  const name = TIER_NAMES[summary.tier];
  return summary.periodEnd !== null
    ? `${name} Ends on ${formatDay(summary.periodEnd)}`
    : `${name} Is Ending`;
}

export function cancellingBody(summary: SubscriptionSummary): string {
  return `You keep every ${TIER_NAMES[summary.tier]} limit until then, and you won’t be charged again.`;
}

/** A team's line: "You’re an admin · 12 seats · £72 a month · Renews 20 December 2026". A team on Free counts its
 *  members; a subscribed team counts the seats it pays for, which is what the service knows of it and never fewer
 *  than the smallest team. */
export function teamLine(team: TeamSubscription): string {
  const role = team.role === 'admin' ? 'You’re an admin' : 'You’re a member';
  if (team.tier === 'free') {
    const members = `${team.members} ${team.members === 1 ? 'member' : 'members'}`;
    return [role, members, TIER_NAMES.free].join(' · ');
  }
  const seats = `${team.seats} ${team.seats === 1 ? 'seat' : 'seats'}`;
  // What a team pays is its admins' business; a member sees the tier.
  const paid =
    team.role === 'admin' ? [monthlyCost(team), standing(team)] : [TIER_NAMES[team.tier]];
  return [role, seats, ...paid].filter(Boolean).join(' · ');
}

/** A Free team's word to its admins that members asked for Pro for Teams: "Bea Lee asked for Pro for Teams" or
 *  "3 members have asked for Pro for Teams". Null when nobody has, and always for a member. */
export function requestsLine(team: TeamSubscription): string | null {
  const requests = team.role === 'admin' && team.tier === 'free' ? team.requests : undefined;
  if (!requests || requests.count === 0) return null;
  const only = requests.count === 1 ? requests.latest[0] : undefined;
  if (only) return `${only.name ?? 'A member'} asked for ${TIER_NAMES.team}`;
  return `${requests.count} members have asked for ${TIER_NAMES.team}`;
}

/** One request, as an admin reads it under the team: who, why and when. "Bea Lee · Automation Rules · 21 November". */
export function requestLine(
  request: NonNullable<TeamSubscription['requests']>['latest'][number],
): string {
  return [
    request.name ?? 'A member',
    request.limit ? limitRow(request.limit).label : null,
    formatShortDay(request.at),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** A member's own word that they asked today: "You asked on 21 November". */
export function askedLine(team: TeamSubscription): string | null {
  return team.role === 'member' && team.tier === 'free' && team.askedAt !== undefined
    ? `You asked on ${formatShortDay(team.askedAt)}`
    : null;
}

/** One thing that works differently now Pro has ended: its name, what changed, and where it stands. `waiting` marks
 *  what is held until something is done (amber); the rest are only smaller. */
export type LapsedChange = {
  key: string;
  name: string;
  what: string;
  state: 'Lower Limit' | 'Waiting' | 'Uploads Paused';
  waiting: boolean;
};

/**
 * What changed when `had` ended (subscription.md "You're Back on Free"): the limits people meet first, each from
 * the figure the service enforces now and the contract's figure for the tier that ended. Nothing in it is deleted,
 * and the list says so by what it calls each state.
 */
export function lapsedChanges(summary: SubscriptionSummary, had: PaidTier): LapsedChange[] {
  const now = (key: LimitKey): string => {
    const value = summary.limits[key];
    return typeof value === 'number' ? formatAmount(limitRow(key), value) : '';
  };
  const before = (key: LimitKey): string => {
    const value = TIER_LIMITS[had][key];
    return typeof value === 'number' ? formatAmount(limitRow(key), value) : '';
  };
  const stored = summary.usage.imageStorageBytes?.used ?? 0;
  const room = summary.limits.imageStorageBytes;
  const over = room !== null && stored >= room && stored > 0;
  return [
    {
      key: 'runs',
      name: 'Automation Runs',
      what: `${now('automationRunsPerMonth')} a month across all your items again, down from ${before('automationRunsPerMonth')}. Rules that send to Slack, Teams or a webhook stay on.`,
      state: 'Lower Limit',
      waiting: false,
    },
    {
      key: 'rules',
      name: 'Automation Rules',
      what: `${now('automationRules')} across all your items, down from ${before('automationRules')}. Every rule stays; new ones wait until you are under.`,
      state: 'Lower Limit',
      waiting: false,
    },
    over
      ? {
          key: 'images',
          name: 'Image Storage',
          what: `${formatAmount(limitRow('imageStorageBytes'), stored)} of ${now('imageStorageBytes')}. Every image stays; uploads pause until you are under.`,
          state: 'Uploads Paused',
          waiting: true,
        }
      : {
          key: 'images',
          name: 'Image Storage',
          what: `${now('imageStorageBytes')} again, down from ${before('imageStorageBytes')}. Every image stays.`,
          state: 'Lower Limit',
          waiting: false,
        },
    {
      key: 'history',
      name: 'Version History and Snapshots',
      what: `New versions and snapshots are kept for ${now('historyDays')}.`,
      state: 'Lower Limit',
      waiting: false,
    },
  ];
}
