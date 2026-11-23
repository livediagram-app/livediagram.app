'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { seatsFor, TIER_NAMES, type PaidTier, type PriceList } from '@liveworkspace/subscription';
import {
  Button,
  buttonClassName,
  ButtonContent,
  CloseIcon,
  Dialog,
  SegmentedToggle,
  Select,
  Spinner,
  Tooltip,
  type SegmentedOption,
} from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { ComparisonGrid } from '../comparison/ComparisonGrid';
import { ON_INK_ICON_BUTTON } from '../on-ink';
import { pricePeriod, teamTotal, tierPrice } from '../price';
import { ProBadge } from '../ProBadge';
import type { UpgradeTarget } from '../provider/context';
import { usePrices, useSubscriptionHost } from '../provider/hooks';
import { billingErrorMessage } from './billing-errors';
import {
  initialSubscribeFor,
  initialTeam,
  offeredTier,
  upgradeAction,
  usageSource,
  type SubscribeFor,
} from './upgrade-model';

const FOR_OPTIONS: readonly SegmentedOption<SubscribeFor>[] = [
  {
    value: 'me',
    label: 'Just Me',
    description: 'Pro, for everything in your personal library',
  },
  {
    value: 'team',
    label: 'A Team',
    description: 'Pro for Teams, for everything in a team’s library',
  },
];

// Wider than the Dialog's widest rung (the comparison has five columns), one steady height so switching between
// Just Me and A Team never resizes the frame, and the whole screen on a phone.
const FRAME =
  'max-h-[calc(100dvh-2rem)] overflow-hidden sm:h-[min(54rem,calc(100dvh-4rem))] sm:w-[68rem]';

/**
 * The upgrade dialog (subscription.md "What people see"): Subscribe For Just Me or A Team, every limit by tier
 * beside the usage now, the price in the visitor's currency, and the one button that starts the checkout. Mounted by
 * the SubscriptionProvider, and opened from anywhere under it with `useUpgrade().openUpgrade`.
 */
export function UpgradeDialog({ target, onClose }: { target: UpgradeTarget; onClose: () => void }) {
  const host = useSubscriptionHost();
  const prices = usePrices();
  const titleId = useId();
  const teamFieldId = useId();
  const load = host?.load ?? { status: 'off' as const };
  const me = load.status === 'ready' ? load.me : null;
  const signedOut = load.status === 'signed_out';
  const unread = load.status === 'error';
  const teams = me?.teams ?? [];

  const [who, setWho] = useState<SubscribeFor>(() => initialSubscribeFor(target));
  const [pickedTeam, setPickedTeam] = useState<string | null>(null);
  const team =
    teams.find((candidate) => candidate.teamId === pickedTeam) ?? initialTeam(teams, target.owner);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tier = offeredTier(who);
  const action = upgradeAction(me, signedOut, who, team, unread);
  const source = usageSource(me, who, team);

  // Opened from a limit: its row is brought into view once the comparison is drawn.
  const body = useRef<HTMLDivElement>(null);
  const focusKey = target.limit ?? null;
  useEffect(() => {
    if (!focusKey) return;
    body.current
      ?.querySelector(`[data-limit-row="${focusKey}"]`)
      ?.scrollIntoView?.({ block: 'center' });
  }, [focusKey]);

  // The checkout is another page. Coming back to this one from the browser's back cache finds it as it was left,
  // spinner and all, and no code of its own ran: `pageshow` says the page is on screen again, so the button is let go.
  useEffect(() => {
    const shown = () => setBusy(false);
    window.addEventListener('pageshow', shown);
    return () => window.removeEventListener('pageshow', shown);
  }, []);

  if (!host) return null;

  const run = async () => {
    if (action.kind === 'ask_admin') {
      onClose();
      host.openAskAdmin({ owner: action.owner, limit: target.limit ?? null });
      return;
    }
    if (action.kind !== 'checkout' && action.kind !== 'portal') return;
    setBusy(true);
    setError(null);
    try {
      await (action.kind === 'checkout' ? host.checkout(action.owner) : host.portal(action.owner));
      // The browser is on its way to the checkout: the button stays busy until the page goes.
    } catch (failure) {
      setBusy(false);
      setError(billingErrorMessage(failure));
    }
  };

  const scopeNote =
    who === 'me'
      ? 'Covers everything in your personal library. Team libraries have their own subscription.'
      : 'Its own price and limits, for everything in the team’s library. Only team admins can subscribe.';
  // What this team would pay: its joined members, never fewer than the smallest team.
  const teamCost =
    who === 'team' && team && team.tier === 'free' && prices
      ? `${team.name} has ${team.members} ${team.members === 1 ? 'member' : 'members'}: ${seatsFor(team.members)} seats, ${teamTotal(prices, team.members)} a month.`
      : null;

  const priceNote = who === 'me' ? `${pricePeriod(tier)}, cancel any time` : pricePeriod(tier);

  return (
    <Dialog
      open
      onClose={onClose}
      titleId={titleId}
      size="3xl"
      className={FRAME}
      initialFocus="container"
      closeOnEscape={!busy}
    >
      {/* Badge, title and sentence read first at every width; the price sits at the header's right from `sm`, and on a
          phone beside the button that buys it, in the footer. */}
      <header className="flex shrink-0 items-start gap-x-4 bg-slate-900 py-5 pr-3 pl-5 text-white sm:py-7 sm:pr-4 sm:pl-8 dark:bg-slate-950">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <ProBadge form="solid" ground="ink" tooltip={false} label="Pro" />
          <h2 id={titleId} className="text-xl font-bold tracking-tight sm:text-[26px]">
            One Upgrade, Every App
          </h2>
          <p className="text-sm leading-normal text-slate-300">
            Pro for you, or Pro for Teams for a shared library. Each has its own price and limits.
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-4">
          <TierPrice
            tier={tier}
            prices={prices}
            note={priceNote}
            data-upgrade-price={tier}
            className="max-sm:hidden sm:items-end sm:text-right"
            tone="ink"
          />
          <Tooltip label="Close">
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className={`${ON_INK_ICON_BUTTON} size-9`}
            >
              <CloseIcon size={14} />
            </button>
          </Tooltip>
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 px-5 pt-5 pb-2 sm:px-8">
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
          Subscribe For
        </span>
        <SegmentedToggle
          label="Subscribe For"
          value={who}
          onChange={(next) => {
            setWho(next);
            setError(null);
          }}
          options={FOR_OPTIONS}
        />
        {who === 'team' && teams.length > 1 ? (
          <span className="inline-flex items-center gap-2 text-[13px] text-slate-600 dark:text-slate-300">
            <label htmlFor={teamFieldId}>Team</label>
            <Select
              id={teamFieldId}
              value={team?.teamId ?? ''}
              onChange={(event) => {
                setPickedTeam(event.target.value);
                setError(null);
              }}
              className="max-w-56"
            >
              {teams.map((candidate) => (
                <option key={candidate.teamId} value={candidate.teamId}>
                  {candidate.role === 'admin' ? candidate.name : `${candidate.name} (member)`}
                </option>
              ))}
            </Select>
          </span>
        ) : who === 'team' && team ? (
          <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100">
            {team.name}
          </span>
        ) : null}
        <p className="min-w-0 flex-[1_1_15rem] text-xs leading-normal text-slate-500 dark:text-slate-400">
          {scopeNote}
          {teamCost ? ` ${teamCost}` : ''}
        </p>
      </div>

      <div ref={body} className="min-h-0 flex-1 overflow-y-auto px-3 sm:px-8">
        <ComparisonGrid
          label="What each tier allows"
          // No usage column for a visitor, a failed read, or A Team with no team to count: a place kept for figures
          // that will never come would pulse for ever.
          usage={signedOut || unread ? null : me ? source : 'loading'}
          usageHeading={who === 'team' ? 'Team Usage Now' : 'Your Usage Now'}
          highlight={tier}
          focus={focusKey}
          // What You Get and the tiers stay at the top as the rows scroll, as Subscribe For does above them.
          stickyHead
        />
      </div>

      <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:px-8 sm:pb-6 dark:border-slate-800">
        {error ? (
          <Callout tone="error" role="alert" size="md">
            {error}
          </Callout>
        ) : unread ? (
          <Callout
            tone="error"
            role="alert"
            size="md"
            action={{ label: 'Try Again', onSelect: () => void host.refresh() }}
          >
            Couldn’t load your subscription. Check your connection and try again.
          </Callout>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <p className="min-w-0 flex-[1_1_17rem] text-xs leading-normal text-slate-500 dark:text-slate-400">
            {signedOut
              ? 'Pro belongs to an account, so it follows you to every device.'
              : action.kind === 'none'
                ? `${action.reason}.`
                : 'Everything on Free stays free. Nothing is deleted when you reach a limit, on any tier.'}
            {/* The phone's footer price has room for its period only: the header says this on wider screens. */}
            {!signedOut && action.kind !== 'none' && who === 'me' ? (
              <span data-upgrade-cancel-phone className="sm:hidden">
                {' '}
                Cancel any time.
              </span>
            ) : null}
          </p>
          <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-end">
            <TierPrice
              tier={tier}
              prices={prices}
              note={pricePeriod(tier)}
              data-upgrade-price-phone={tier}
              className="mr-auto min-w-0 whitespace-nowrap sm:hidden"
              tone="page"
            />
            <Button
              variant="ghost"
              size="md"
              className="min-h-11 shrink-0 whitespace-nowrap"
              onClick={onClose}
            >
              Not Now
            </Button>
            {action.kind === 'sign_in' ? (
              host.signInHref ? (
                <a
                  href={host.signInHref(typeof window === 'undefined' ? '/' : window.location.href)}
                  className={buttonClassName({
                    size: 'md',
                    className: 'min-h-11 shrink-0 whitespace-nowrap',
                  })}
                >
                  <ButtonContent>{action.label}</ButtonContent>
                </a>
              ) : null
            ) : (
              <Button
                size="md"
                className="min-h-11 shrink-0 whitespace-nowrap"
                busy={busy}
                disabled={action.kind === 'none'}
                onClick={() => void run()}
              >
                {busy ? <Spinner /> : null}
                {action.kind === 'checkout' && busy ? 'Opening Checkout…' : action.label}
              </Button>
            )}
          </div>
        </div>
        {/* What the main button is offering, read out when the side changes. */}
        <p role="status" className="sr-only">
          {TIER_NAMES[tier]}
          {prices ? `, ${tierPrice(prices, tier)} ${pricePeriod(tier)}` : ''}
        </p>
      </footer>
    </Dialog>
  );
}

/** The chosen tier's price and its period: on the header's ink, or on the page in the phone's footer. */
function TierPrice({
  tier,
  prices,
  note,
  className,
  tone,
  ...data
}: {
  tier: PaidTier;
  prices: PriceList | null;
  note: string;
  className: string;
  tone: 'ink' | 'page';
} & Record<`data-${string}`, string>) {
  const ink = tone === 'ink';
  return (
    <div {...data} className={`flex flex-col gap-0.5 ${className}`}>
      {prices ? (
        <span
          className={`leading-tight font-bold tabular-nums ${
            ink ? 'text-[22px]' : 'text-lg text-slate-900 dark:text-slate-100'
          }`}
        >
          {tierPrice(prices, tier)}
        </span>
      ) : (
        <span
          aria-hidden
          className={`h-7 w-12 animate-pulse rounded motion-reduce:animate-none ${
            ink ? 'bg-white/15' : 'bg-slate-200 dark:bg-slate-700'
          }`}
        />
      )}
      <span className={`text-xs ${ink ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
        {note}
      </span>
    </div>
  );
}
