'use client';

import { createSiteAccount } from '@liveworkspace/account-menu/site-account';
import { useSignedInHint } from './HeaderPrimaryCta';

// The site header's account menu (docs/specs/019-marketing/marketing-site.md "Header"), at the bar's right end:
// @liveworkspace/account-menu's, read from this product's hint cookie. The menu's code is its own chunk
// (SiteAccountMenu): loaded at once when the hint says signed in, and for a visitor only when the pointer or
// focus reaches the Guest button, so a visitor's page carries none of it and makes no request.
export const SiteAccount = /* @__PURE__ */ createSiteAccount({
  load: () => import('./SiteAccountMenu'),
  useSignedInHint,
});
