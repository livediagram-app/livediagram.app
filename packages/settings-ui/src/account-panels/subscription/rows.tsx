'use client';

import { lazy, Suspense, type ReactNode } from 'react';
import type { SettingsRow, SettingsSectionNote } from '../../model';

// The Subscription category's rows (liveworkspace/docs/specs/019-subscription/subscription.md "What people see",
// "Settings, Subscription"): your tier, your teams and your usage, each a section with its own card. Their code is
// one chunk, fetched the first time the category is shown, never with the panel: this module is only the three rows
// and their placeholders.
const load = () => import('./SubscriptionPanel');
const TierCell = lazy(() => load().then((m) => ({ default: m.SubscriptionTierCell })));
const TeamsCell = lazy(() => load().then((m) => ({ default: m.SubscriptionTeamsCell })));
const UsageCell = lazy(() => load().then((m) => ({ default: m.SubscriptionUsageCell })));

/** Fetches the category's code ahead of time (a test warming its imports). */
export async function preloadSubscriptionPanel(): Promise<void> {
  await load();
}

export const TEAMS_SECTION = 'Your Teams';
export const USAGE_SECTION = 'Your Usage';

export const SUBSCRIPTION_SECTION_NOTES: Readonly<Record<string, SettingsSectionNote>> = {
  [TEAMS_SECTION]: {
    note: 'Pro for Teams has its own price and limits, and covers everything in the team’s library.',
  },
  [USAGE_SECTION]: {
    note: 'Items in your personal library use your subscription; items in a team’s library use the team’s. Nothing is deleted at a limit.',
  },
};

function Cell({ cell, height, children }: { cell: string; height: string; children: ReactNode }) {
  return (
    <div data-settings-cell={cell}>
      <Suspense
        fallback={
          <div className="px-4 py-4">
            <div
              aria-busy
              className={`animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-700/60 ${height}`}
            />
          </div>
        }
      >
        {children}
      </Suspense>
    </div>
  );
}

const renderTier = () => (
  <Cell cell="subscription-tier" height="h-20">
    <TierCell />
  </Cell>
);
const renderTeams = () => (
  <Cell cell="subscription-teams" height="h-24">
    <TeamsCell />
  </Cell>
);
const renderUsage = () => (
  <Cell cell="subscription-usage" height="h-64">
    <UsageCell />
  </Cell>
);

/** The category's three rows. One list for every host, so the rows keep their identity across renders. */
const ROWS: readonly SettingsRow[] = [
  {
    kind: 'custom',
    key: 'subscriptionTier',
    label: 'Your Subscription',
    description: 'Your tier, what it costs, when it renews, and where to manage billing.',
    keywords: 'pro free tier price billing payment renew cancel upgrade invoice subscribe',
    render: renderTier,
  },
  {
    kind: 'custom',
    key: 'subscriptionTeams',
    label: TEAMS_SECTION,
    description: 'Each team’s tier, and upgrading a team you run.',
    keywords: 'team pro for teams members seats admin upgrade billing',
    section: TEAMS_SECTION,
    render: renderTeams,
  },
  {
    kind: 'custom',
    key: 'subscriptionUsage',
    label: USAGE_SECTION,
    description: 'What you have used of every limit, and what your tier allows.',
    keywords:
      'usage limits automation runs rules webhooks ai credits images storage history walkthroughs call minutes',
    section: USAGE_SECTION,
    render: renderUsage,
  },
];

export function subscriptionRows(): readonly SettingsRow[] {
  return ROWS;
}
