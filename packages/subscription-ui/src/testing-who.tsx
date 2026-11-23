// Pro on for a component test in any package or app (liveworkspace/docs/specs/019-subscription/subscription.md "Who
// pays for an item"): the provider over a `fetch` that answers as the subscription service does, for each person who
// may be looking at an item's limits. The item's owner is whoever the api named (`owner` on a list or a link read):
// `ownerOf(who)`. Tests only: it imports vitest.
import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach } from 'vitest';
import type { OwnerScope, OwnerView, Tier, Usage } from '@liveworkspace/subscription';
import { preloadUpgradeDialog, SubscriptionProvider } from './provider';
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
} from './testing';

/** Who is looking: the item's owner (on Free, or already on Pro), a member or an admin of the team that owns it, or a
 *  collaborator on someone else's item. */
export type Who = 'owner' | 'owner-pro' | 'member' | 'admin' | 'collaborator';

const SOMEONE: OwnerScope = 'p:user_bob';

/** The owner scope the api would name for the item `who` is looking at. */
export const ownerOf = (who: Who): OwnerScope =>
  who === 'owner' || who === 'owner-pro' ? ME : who === 'collaborator' ? SOMEONE : GARDEN;

/** The service as `who` meets it. `usage` is the item's owner's, which only the owner and the owning team read. */
export function proService(who: Who, usage: Usage = {}) {
  const owner = ownerOf(who);
  const tier: Tier = who === 'owner-pro' ? 'pro' : 'free';
  // Someone outside the owner is told neither its tier nor its limits.
  const view: OwnerView =
    who === 'collaborator'
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
  const mine = owner === ME ? usage : {};
  return serviceFetch({
    me: meResponse({
      personal: summary(ME, tier, { usage: mine }),
      teams:
        owner === GARDEN
          ? [team(GARDEN, 'Garden', who === 'admin' ? 'admin' : 'member', 'free', { usage })]
          : [],
    }),
    owners: { [owner]: view },
  });
}

/** `node` under the provider, signed in, asking `fetcher`. */
export function withPro(node: ReactNode, fetcher: typeof fetch) {
  return (
    <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher} navigate={() => {}}>
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
