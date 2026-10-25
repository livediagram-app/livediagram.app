'use client';

import { explorerHomeHref } from '@liveworkspace/sites/workspace-proxy';
import { ctaHref, type CtaSurface } from '@livedocuments/api-schema';
import {
  HeaderPrimaryCta as SharedCta,
  type HeaderPrimaryCtaProps,
} from '@liveworkspace/ui/header-primary-cta';
import { createSignedInHint } from '@liveworkspace/ui/signed-in-hint';
import { signedInFromCookie } from './browser-repair/identity';

// The site header's primary (docs/specs/019-marketing/marketing-site.md "Header"): @liveworkspace/ui's,
// Choose Template for a visitor and Open Explorer for someone signed in, as the api's readable
// `ldoc_signed_in` hint cookie says, with the page's funnel slot on its /new link.

// The Explorer is liveworkspace's, served under livedocuments' own address while its switch is on
// (@liveworkspace/sites/workspace-proxy), so its Home is this site's /explorer/home.
export const EXPLORER_HOME_HREF = explorerHomeHref('livedocuments');

// Whether the hint cookie says someone is signed in: false in the static HTML, read after hydration.
export const useSignedInHint = /* @__PURE__ */ createSignedInHint(signedInFromCookie);

export function HeaderPrimaryCta({
  ctaSurface,
  ...props
}: HeaderPrimaryCtaProps & { ctaSurface?: CtaSurface }) {
  return (
    <SharedCta
      newHref={ctaSurface ? ctaHref('/new', `${ctaSurface}.Header`) : '/new'}
      explorerHref={EXPLORER_HOME_HREF}
      signedIn={useSignedInHint()}
      {...props}
    />
  );
}
