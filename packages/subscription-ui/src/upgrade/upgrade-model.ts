// What the upgrade dialog offers for the owner it is set to (subscription.md "Billing": only a team's admins may
// subscribe a team or manage its billing). Plain data from the person's own subscription, so the dialog only draws it.
import {
  parseOwnerScope,
  type MeResponse,
  type OwnerScope,
  type PaidTier,
  type SubscriptionSummary,
  type TeamSubscription,
} from '@liveworkspace/subscription';

export type SubscribeFor = 'me' | 'team';

/** Which side the dialog opens on: the one asked for, else A Team when it was opened for a team's item. */
export function initialSubscribeFor(target: {
  owner?: OwnerScope | null;
  subscribeFor?: SubscribeFor;
}): SubscribeFor {
  return target.subscribeFor ?? (parseOwnerScope(target.owner)?.kind === 'team' ? 'team' : 'me');
}

/** The team the picker starts on: the one the dialog was opened for, else the first the person runs that is still on
 *  Free, else the first they run, else their first. */
export function initialTeam(
  teams: readonly TeamSubscription[],
  owner: OwnerScope | null | undefined,
): TeamSubscription | null {
  return (
    teams.find((team) => team.owner === owner) ??
    teams.find((team) => team.role === 'admin' && team.tier === 'free') ??
    teams.find((team) => team.role === 'admin') ??
    teams[0] ??
    null
  );
}

export type UpgradeAction =
  /** Start a checkout for this owner. */
  | { kind: 'checkout'; owner: OwnerScope; label: string }
  /** Already subscribed, and this person may manage it. */
  | { kind: 'portal'; owner: OwnerScope; label: string }
  /** A team's member: only an admin may subscribe it. */
  | { kind: 'ask_admin'; owner: OwnerScope; label: string }
  /** Nobody is signed in. */
  | { kind: 'sign_in'; label: string }
  /** Nothing to press: the reason is said beside the button. */
  | { kind: 'none'; label: string; reason: string };

export function upgradeAction(
  me: MeResponse | null,
  signedOut: boolean,
  who: SubscribeFor,
  team: TeamSubscription | null,
  unread = false,
): UpgradeAction {
  const offer = who === 'team' ? 'Get Pro for Teams' : 'Upgrade to Pro';
  if (signedOut) return { kind: 'sign_in', label: 'Sign In to Upgrade' };
  if (!me)
    return {
      kind: 'none',
      label: offer,
      reason: unread ? 'Your subscription could not be loaded' : 'Checking your subscription',
    };
  if (who === 'me') {
    return me.personal.tier === 'free'
      ? { kind: 'checkout', owner: me.personal.owner, label: offer }
      : { kind: 'portal', owner: me.personal.owner, label: 'Manage Billing' };
  }
  if (!team)
    return {
      kind: 'none',
      label: offer,
      reason: 'Create a team in the Explorer first, then subscribe it here',
    };
  if (team.role !== 'admin') {
    return team.tier === 'free'
      ? { kind: 'ask_admin', owner: team.owner, label: 'Ask an Admin' }
      : { kind: 'none', label: offer, reason: `${team.name} already has Pro for Teams` };
  }
  return team.tier === 'free'
    ? { kind: 'checkout', owner: team.owner, label: offer }
    : { kind: 'portal', owner: team.owner, label: 'Manage Billing' };
}

/** The tier the chosen side offers. */
export const offeredTier = (who: SubscribeFor): PaidTier => (who === 'team' ? 'team' : 'pro');

/** Whose usage the comparison shows beside the tiers. */
export function usageSource(
  me: MeResponse | null,
  who: SubscribeFor,
  team: TeamSubscription | null,
): SubscriptionSummary | null {
  if (!me) return null;
  return who === 'team' ? team : me.personal;
}
