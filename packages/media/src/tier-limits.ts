// The most any tier allows of an upload (liveworkspace/docs/specs/006-media/media.md "With Pro on"). These are
// ceilings, never a person's limit: with Pro on an editor and an app's api let a file through up to them, and the
// server's entitlement decides what this person may send. Derived from the tiers, so a new tier's number is one edit.

import { TIER_LIMITS, TIERS } from '@liveworkspace/subscription';
import { MAX_IMAGE_BYTES } from './limits';
import { WALKTHROUGH_MAX_MS } from './walkthrough';

/** The largest image any tier takes: no upload over this is ever read. */
export const IMAGE_UPLOAD_CEILING_BYTES = Math.max(
  MAX_IMAGE_BYTES,
  ...TIERS.map((tier) => TIER_LIMITS[tier].imageMaxBytes),
);

/** The longest walkthrough any tier records. */
export const WALKTHROUGH_CEILING_MS = Math.max(
  WALKTHROUGH_MAX_MS,
  ...TIERS.map((tier) => TIER_LIMITS[tier].walkthroughMaxMs),
);
