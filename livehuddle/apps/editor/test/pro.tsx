// Pro on for a component test (liveworkspace/docs/specs/019-subscription/subscription.md "Who pays for an item"): the
// kit's provider over a `fetch` that answers as the subscription service does, for each person who may be looking at
// a Space's Call Minutes. The Space's owner is whoever the api named: `ownerOf(who)`.
import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach } from 'vitest';
import type { OwnerScope, OwnerView, Tier, Usage } from '@liveworkspace/subscription';
import {
  preloadUpgradeDialog,
  SubscriptionProvider,
} from '@liveworkspace/subscription-ui/provider';
import {
  GARDEN,
  ME,
  meResponse,
  ownerView,
  serviceFetch,
  setProForTests,
  summary,
  team,
  tokenOf,
} from '@liveworkspace/subscription-ui/testing';

/** Who is looking: the Space's owner (on Free, or already on Pro), an admin or a member of the team that owns it, a
 *  collaborator on someone else's Space, or a guest who is not signed in. */
export type Who = 'owner' | 'owner-pro' | 'admin' | 'member' | 'collaborator' | 'guest';

const SOMEONE: OwnerScope = 'p:user_bob';

/** The owner scope the api would name for the Space `who` is in. */
export const ownerOf = (who: Who): OwnerScope =>
  who === 'owner' || who === 'owner-pro'
    ? ME
    : who === 'collaborator' || who === 'guest'
      ? SOMEONE
      : GARDEN;

/** The service as `who` meets it. `usage` is the Space's owner's, which only the owner and the owning team read. */
export function proService(who: Who, usage: Usage = {}) {
  const owner = ownerOf(who);
  const tier: Tier = who === 'owner-pro' ? 'pro' : 'free';
  // Someone outside the owner is told neither its tier nor its limits.
  const view: OwnerView =
    who === 'collaborator' || who === 'guest'
      ? { owner, tier: null, limits: null, action: 'none' }
      : ownerView(
          owner,
          who === 'owner' || who === 'admin'
            ? 'upgrade'
            : who === 'owner-pro'
              ? 'manage'
              : 'ask_admin',
          tier,
        );
  return serviceFetch({
    me: meResponse({
      personal: summary(ME, tier, { usage: owner === ME ? usage : {} }),
      teams:
        owner === GARDEN
          ? [team(GARDEN, 'Garden', who === 'admin' ? 'admin' : 'member', 'free', { usage })]
          : [],
    }),
    owners: { [owner]: view },
  });
}

/** `node` under the provider as `who`: signed in, or a guest with no account. */
export function withPro(node: ReactNode, fetcher: typeof fetch, who: Who = 'owner') {
  return (
    <SubscriptionProvider
      getToken={tokenOf(who === 'guest' ? null : 'tok')}
      account={who === 'guest' ? 'out' : 'in'}
      fetch={fetcher}
      navigate={() => {}}
    >
      {node}
    </SubscriptionProvider>
  );
}

/** Turns Pro on for every test of a file (and off again after each), with the provider's working half loaded. */
export function proOnForTests(): void {
  beforeAll(async () => {
    await preloadUpgradeDialog();
  }, 60_000);
  beforeEach(() => {
    setProForTests(true);
  });
  afterEach(() => {
    setProForTests(null);
    try {
      localStorage.clear();
    } catch {
      // jsdom always has storage.
    }
  });
}
