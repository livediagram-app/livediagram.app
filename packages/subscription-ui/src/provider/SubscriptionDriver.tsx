'use client';

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createSubscriptionBrowserClient,
  type LimitKey,
  type OwnerScope,
  type PaidTier,
  type PriceList,
  type SubscriptionSummary,
} from '@liveworkspace/subscription';
import {
  OWNER_ERROR,
  OWNER_SIGNED_OUT,
  SUBSCRIPTION_ERROR,
  SUBSCRIPTION_LOADING,
  SUBSCRIPTION_SIGNED_OUT,
  type OwnerViewLoad,
  type SubscriptionLoad,
} from '../state';
import {
  pricingHrefOn,
  SUBSCRIPTION_STALE_MS,
  type SubscriptionHost,
  type UpgradeTarget,
} from './context';
import type { SubscriptionProviderProps } from './SubscriptionProvider';
import {
  arrivedSubscribed,
  clearLeaving,
  markLeaving,
  readLeaving,
  returnAddress,
  stripSubscribedParam,
  type Leaving,
} from './return-marker';
import { SubscribedNotice } from './SubscribedNotice';

// The dialogs are their own chunks, fetched the first time one opens: a page that only shows a badge or a meter
// carries none of the comparison.
const UpgradeDialog = lazy(() =>
  import('../upgrade/UpgradeDialog').then((m) => ({ default: m.UpgradeDialog })),
);
const AskAdminDialog = lazy(() =>
  import('../upgrade/AskAdminDialog').then((m) => ({ default: m.AskAdminDialog })),
);

/** Fetches the dialogs' code ahead of the press. */
export async function loadUpgradeDialogs(): Promise<void> {
  await Promise.all([import('../upgrade/UpgradeDialog'), import('../upgrade/AskAdminDialog')]);
}

/** The dialogs the provider's shell holds open, and how they close. */
export type DriverDialogs = {
  upgrade: UpgradeTarget | null;
  askAdmin: UpgradeTarget | null;
  openUpgrade: (target?: UpgradeTarget) => void;
  openAskAdmin: (target?: UpgradeTarget) => void;
  closeUpgrade: () => void;
  closeAskAdmin: () => void;
};

/**
 * The working half of the SubscriptionProvider (SubscriptionProvider.tsx is the light half every page carries): it
 * reads the person's subscription, the owners the page asks about and the prices, follows the return from the
 * checkout and the portal, and draws the dialogs and the "You're on Pro" notice. Its own chunk, fetched once the page
 * is interactive, never with it. It hands the host it works out to the shell, which shares it.
 */
export function SubscriptionDriver({
  getToken,
  origin = '',
  account = 'in',
  signInHref,
  returnTo,
  navigate,
  fetch: fetcher,
  dialogs,
  onHost,
}: Omit<SubscriptionProviderProps, 'children'> & {
  dialogs: DriverDialogs;
  onHost: (host: SubscriptionHost | null) => void;
}) {
  // The newest of each, read when a request goes out, so a host that hands a new function each render asks nothing
  // again.
  const latestProps = useRef({ getToken, returnTo, navigate, account });
  useEffect(() => {
    latestProps.current = { getToken, returnTo, navigate, account };
  });

  const client = useMemo(
    () =>
      createSubscriptionBrowserClient({
        origin,
        getToken: () => latestProps.current.getToken(),
        ...(fetcher ? { fetch: fetcher } : {}),
      }),
    [origin, fetcher],
  );

  // ---- The person's own subscription -----------------------------------------------------------------------------
  const [fetched, setFetched] = useState<SubscriptionLoad>(SUBSCRIPTION_LOADING);
  // Bumped by each read and on unmount: an answer applies only while its read is still the newest.
  const newest = useRef(0);
  const readAt = useRef(0);
  const read = useCallback(async () => {
    const mine = ++newest.current;
    readAt.current = Date.now();
    try {
      const me = await client.me();
      if (mine !== newest.current) return;
      setFetched(me ? { status: 'ready', me } : SUBSCRIPTION_SIGNED_OUT);
    } catch {
      // What was last read stays on screen: a failed refresh never blanks a page that had its answer.
      if (mine === newest.current)
        setFetched((current) => (current.status === 'ready' ? current : SUBSCRIPTION_ERROR));
    }
  }, [client]);

  useEffect(() => {
    if (account !== 'in') return;
    void read();
    return () => {
      newest.current += 1;
    };
  }, [account, read]);

  const load: SubscriptionLoad =
    account === 'out'
      ? SUBSCRIPTION_SIGNED_OUT
      : account === 'checking'
        ? SUBSCRIPTION_LOADING
        : fetched;

  // ---- The owners of the items the page has open -----------------------------------------------------------------
  const [ownerViews, setOwnerViews] = useState<Record<string, OwnerViewLoad>>({});
  const asked = useRef(new Set<OwnerScope>());
  const readOwner = useCallback(
    async (owner: OwnerScope) => {
      try {
        const view = await client.ownerView(owner);
        setOwnerViews((current) => ({
          ...current,
          [owner]: view ? { status: 'ready', view } : OWNER_SIGNED_OUT,
        }));
      } catch {
        setOwnerViews((current) =>
          current[owner]?.status === 'ready' ? current : { ...current, [owner]: OWNER_ERROR },
        );
      }
    },
    [client],
  );
  const askOwnerView = useCallback(
    (owner: OwnerScope) => {
      if (latestProps.current.account !== 'in' || asked.current.has(owner)) return;
      asked.current.add(owner);
      void readOwner(owner);
    },
    [readOwner],
  );

  // One refresh at a time (each is a `/me` and a request per asked owner). The read on its way may have left before
  // what an asker just did (a credit spent, a checkout come back), so whoever asks meanwhile shares one more read
  // after it: a focus that wakes several askers costs two reads however many they are, and nobody is told old news.
  const refreshing = useRef<Promise<void> | null>(null);
  const following = useRef<Promise<void> | null>(null);
  const refresh = useCallback((): Promise<void> => {
    if (latestProps.current.account !== 'in') return Promise.resolve();
    if (refreshing.current) {
      following.current ??= refreshing.current.then(() => {
        following.current = null;
        return refreshRef.current();
      });
      return following.current;
    }
    refreshing.current = Promise.all([
      read(),
      ...[...asked.current].map((owner) => readOwner(owner)),
    ]).then(() => {
      refreshing.current = null;
    });
    return refreshing.current;
  }, [read, readOwner]);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // ---- Prices, for a visitor the service has not answered for ----------------------------------------------------
  const [askedPrices, setAskedPrices] = useState<PriceList | null>(null);
  const pricesAsked = useRef(false);
  const askPrices = useCallback(() => {
    if (pricesAsked.current) return;
    pricesAsked.current = true;
    client.prices().then(
      (answer) => setAskedPrices(answer.prices),
      () => {
        // Asked again the next time something wants them.
        pricesAsked.current = false;
      },
    );
  }, [client]);
  const prices = load.status === 'ready' ? load.me.prices : askedPrices;

  // ---- Coming back from the checkout or the portal ---------------------------------------------------------------
  // Read once as the page opens: whether the address says a checkout sent the person back, and for whom.
  const [arrival] = useState(() => ({
    subscribed: arrivedSubscribed(),
    leaving: typeof window === 'undefined' ? null : readLeaving(),
  }));
  const [welcomeSeen, setWelcomeSeen] = useState(false);
  // One function for the notice's life: a new one each render would start its timer again, and it would never leave.
  const dismissWelcome = useCallback(() => setWelcomeSeen(true), []);
  useEffect(() => {
    stripSubscribedParam();
    clearLeaving();
  }, []);

  // The same tab, shown again without a reload (the browser's back from the checkout, a portal opened in another
  // tab): read again if the person left for one of them, or what the page holds has gone stale.
  useEffect(() => {
    if (account !== 'in') return;
    const back = () => {
      if (document.visibilityState === 'hidden') return;
      const left = readLeaving();
      if (left) clearLeaving();
      if (left || Date.now() - readAt.current > SUBSCRIPTION_STALE_MS) void refresh();
    };
    window.addEventListener('focus', back);
    window.addEventListener('pageshow', back);
    document.addEventListener('visibilitychange', back);
    return () => {
      window.removeEventListener('focus', back);
      window.removeEventListener('pageshow', back);
      document.removeEventListener('visibilitychange', back);
    };
  }, [account, refresh]);

  const leave = useCallback(
    (url: string) => {
      const absolute = new URL(url, origin || window.location.origin).href;
      const go = latestProps.current.navigate ?? ((to: string) => window.location.assign(to));
      go(absolute);
    },
    [origin],
  );
  // Off to the checkout or the portal for `owner`. Only the checkout's way back says so in the address.
  const leaveFor = useCallback(
    async (kind: Leaving['kind'], owner: OwnerScope) => {
      const { url } = await client[kind](
        owner,
        returnAddress(
          latestProps.current.returnTo?.() ?? window.location.href,
          kind === 'checkout',
        ),
      );
      markLeaving({ owner, kind });
      leave(url);
    },
    [client, leave],
  );
  const checkout = useCallback((owner: OwnerScope) => leaveFor('checkout', owner), [leaveFor]);
  const portal = useCallback((owner: OwnerScope) => leaveFor('portal', owner), [leaveFor]);

  // What a write changed of the person's own read, kept on screen without reading it all again.
  const patchOwner = useCallback(
    (owner: OwnerScope, change: <T extends SubscriptionSummary>(summary: T) => T) =>
      setFetched((current) => {
        if (current.status !== 'ready') return current;
        const { me } = current;
        return {
          status: 'ready',
          me: {
            ...me,
            personal: me.personal.owner === owner ? change(me.personal) : me.personal,
            teams: me.teams.map((team) => (team.owner === owner ? change(team) : team)),
          },
        };
      }),
    [],
  );
  const askTeam = useCallback(
    async (owner: OwnerScope, limit: LimitKey | null, note: string | null) => {
      const answer = await client.askTeam(owner, limit, note);
      patchOwner(owner, (team) => ({ ...team, askedAt: answer.askedAt }));
      return answer;
    },
    [client, patchOwner],
  );
  const dismissEnded = useCallback(
    (owner: OwnerScope) => {
      patchOwner(owner, (summary) => {
        const next = { ...summary };
        delete next.endedAt;
        delete next.endedTier;
        return next;
      });
      // Gone here at once; another browser hears it from the service. A failed word comes back on the next read.
      client.dismissEnded(owner).catch(() => {});
    },
    [client, patchOwner],
  );

  const { upgrade, askAdmin, openUpgrade, openAskAdmin, closeUpgrade, closeAskAdmin } = dialogs;

  const host = useMemo<SubscriptionHost>(
    () => ({
      account,
      load,
      refresh,
      ownerViews,
      askOwnerView,
      prices,
      askPrices,
      openUpgrade,
      openAskAdmin,
      checkout,
      portal,
      askTeam,
      dismissEnded,
      pricingHref: pricingHrefOn(origin),
      signInHref: signInHref ?? null,
    }),
    [
      account,
      load,
      refresh,
      ownerViews,
      askOwnerView,
      prices,
      askPrices,
      openUpgrade,
      openAskAdmin,
      checkout,
      portal,
      askTeam,
      dismissEnded,
      origin,
      signInHref,
    ],
  );

  const welcomed =
    arrival.subscribed && !welcomeSeen && load.status === 'ready'
      ? subscribedSummary(load.me, arrival.leaving)
      : null;

  // The shell shares what this works out; when this goes, so does its host.
  useEffect(() => {
    onHost(host);
  }, [host, onHost]);
  useEffect(() => () => onHost(null), [onHost]);

  return (
    <>
      {upgrade || askAdmin ? (
        <Suspense fallback={null}>
          {upgrade ? <UpgradeDialog target={upgrade} onClose={closeUpgrade} /> : null}
          {askAdmin ? <AskAdminDialog target={askAdmin} onClose={closeAskAdmin} /> : null}
        </Suspense>
      ) : null}
      {welcomed ? (
        <SubscribedNotice
          tier={welcomed.tier}
          teamName={welcomed.name}
          pricingHref={host.pricingHref}
          onDismiss={dismissWelcome}
        />
      ) : null}
    </>
  );
}

/**
 * What a checkout gained, to announce: the subscription of the owner this browser left for a checkout of, once the
 * service says it is paid. A checkout only starts for an owner that is Free (the service refuses any other), so that
 * owner paid now is something gained since leaving. Nothing when the browser kept no word of leaving (storage
 * refused, an address with the marker opened cold) or left for the portal: what was gained cannot be known, and a
 * cancelled team checkout must never announce the person's own Pro.
 */
export function subscribedSummary(
  me: { personal: SubscriptionSummary; teams: (SubscriptionSummary & { name: string })[] },
  leaving: Leaving | null,
): { tier: PaidTier; name: string | null } | null {
  if (leaving?.kind !== 'checkout') return null;
  const team = me.teams.find((candidate) => candidate.owner === leaving.owner);
  const summary = team ?? (leaving.owner === me.personal.owner ? me.personal : null);
  if (!summary || summary.tier === 'free') return null;
  return { tier: summary.tier, name: team?.name ?? null };
}
