// Share links (docs/specs/014-identity/auth-and-guest-access.md, docs/specs/015-api/api.md): a link's
// level and its lifetimes, every product's. The link's own row names the product's noun, so it stays there.

import type { AccessLevel } from './access-levels';

// A share link's access level (docs/specs/013-workspace/share-roles.md): Viewer, Participant or Editor.
export type ShareRole = AccessLevel;

// Lifetime chosen at link creation (docs/specs/013-workspace/share-link-expiry.md). 'never' is the default
// and the pre-expiry behaviour: the link works until revoked.
export type ShareLinkExpiry = 'never' | 'week' | 'month' | 'sixMonths';

// The fixed lifetimes in ms, shared by the api worker (computing
// `expiresAt` at create/extend time) and the live editor (rendering
// "6d left" countdowns) so the two sides can't disagree on what a
// "month" is. Calendar-ish approximations on purpose: share-link
// expiry is a security bound, not a billing period.
export const SHARE_LINK_EXPIRY_MS: Record<Exclude<ShareLinkExpiry, 'never'>, number> = {
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  sixMonths: 183 * 24 * 60 * 60 * 1000,
};
