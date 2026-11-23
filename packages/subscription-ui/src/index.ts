// @liveworkspace/subscription-ui: everything a page shows about Pro (liveworkspace/docs/specs/019-subscription/
// subscription.md "What people see"), built once for liveworkspace.app and every app. Limits, row wording, prices and
// the wire shapes all come from @liveworkspace/subscription; nothing here holds a number of its own.
//
// All of it draws nothing, and asks the service nothing, unless Pro is on in the build (flag.ts). See README.md for
// how an editor mounts the provider and drops in a meter, a notice and a gate.
export { proOn } from './flag';
export {
  ownerViewOf,
  type OwnerViewInput,
  type OwnerViewLoad,
  type SubscriptionLoad,
} from './state';
export * from './provider';
export { ProBadge, PRO_BADGE_LABEL, type ProBadgeForm, type ProBadgeProps } from './ProBadge';
export { UsageMeter, type UsageMeterProps } from './UsageMeter';
export {
  meterFraction,
  meterState,
  NEAR_LIMIT,
  numericLimit,
  periodWord,
  rowUsage,
  usageWords,
  type MeterState,
  type RowUsage,
} from './usage';
export { LimitNotice, type LimitNoticeProps } from './LimitNotice';
export {
  ASK_ADMIN_SENTENCE,
  limitReachedSentence,
  nearLimitSentence,
  offerSentence,
  upgradeLabel,
  upgradeTier,
} from './limit-copy';
export { ProGate, type ProGateProps } from './ProGate';
export { ProNote, type ProNoteProps } from './ProNote';
export { ImageLimitNotice, type ImageLimitNoticeProps } from './images/ImageLimitNotice';
export {
  IMAGE_UPLOAD_CEILING_BYTES,
  imageCeilingLabel,
  imageLimitRefusalOf,
  imageLimitSentence,
  imageSizeHint,
  imageStorageOf,
  imageUploadCeiling,
  imageUploadQuery,
  type ImageLimitRefusal,
  type ImageStorage,
} from './images/image-limits';
export { RowAppLogo, rowAppName } from './RowAppLogo';
export {
  ComparisonGrid,
  COMPARISON_PHONE_QUERY,
  rowAppLine,
  type ComparisonGridProps,
} from './comparison/ComparisonGrid';
export { InfoPopover } from './comparison/InfoPopover';
export { billingErrorMessage } from './upgrade/billing-errors';
export {
  formatDay,
  formatShortDay,
  monthlyCost,
  pricePeriod,
  standing,
  teamTotal,
  tierPrice,
  tierPriceLine,
} from './price';
