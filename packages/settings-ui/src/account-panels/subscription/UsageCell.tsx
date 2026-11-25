'use client';

import { useSubscription } from '@liveworkspace/subscription-ui';
import { UsageList } from '@liveworkspace/subscription-ui/usage-list';
import { SETTINGS_CARD_SLOT } from '../../SettingsGroup';
import { CellFallback, CellSkeleton } from './states';

/**
 * Your Usage (subscription.md "Settings, Subscription"): the shared usage list (UsageList) over the person's own
 * subscription, each group in the Settings card's slot.
 */
export function SubscriptionUsageCell() {
  const load = useSubscription();
  if (load.status !== 'ready')
    return <CellFallback load={load} skeleton={<CellSkeleton rows={5} />} />;
  return <UsageList summary={load.me.personal} sectionClassName={SETTINGS_CARD_SLOT} />;
}
