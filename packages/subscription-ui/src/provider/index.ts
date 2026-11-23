// The light half of the package (`@liveworkspace/subscription-ui/provider`): the provider's shell, its hooks and
// their types, and nothing that draws. A page's first load imports from here (a header, an editor's root), so it
// carries none of the badge, the meters or the dialogs until something shows them.
export {
  preloadUpgradeDialog,
  SubscriptionProvider,
  SUBSCRIPTION_STALE_MS,
  type SubscriptionProviderProps,
} from './SubscriptionProvider';
export type { AccountKnown, SubscriptionHost, UpgradeTarget } from './context';
export {
  useBilling,
  useOwnerView,
  usePrices,
  usePricingHref,
  useRefreshSubscription,
  useSubscription,
  useSubscriptionHost,
  useUpgrade,
  type Billing,
  type Upgrade,
} from './hooks';
export { SUBSCRIBED_PARAM } from './return-marker';
