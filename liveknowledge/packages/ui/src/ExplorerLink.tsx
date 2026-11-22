'use client';

import { ExplorerLink as SharedLink } from '@liveworkspace/ui';
import type { ComponentProps } from 'react';
import { explorerHomeHref } from '@liveworkspace/sites/workspace-proxy';
import { createSignedInHint } from '@liveworkspace/ui/signed-in-hint';
import { signedInFromCookie } from './browser-repair/identity';

// The site header's Explorer link (docs/specs/019-marketing/marketing-site.md "Header"): @liveworkspace/ui's,
// to this site's Explorer Home, the filled Open Explorer when the `lkb_signed_in` hint cookie says
// someone is signed in.

// The Explorer is liveworkspace's, served under liveknowledge' own address while its switch is on
// (@liveworkspace/sites/workspace-proxy), so its Home is this site's /explorer/home.
export const EXPLORER_HOME_HREF = explorerHomeHref('liveknowledge');

// Whether the hint cookie says someone is signed in: false in the static HTML, read after hydration.
export const useSignedInHint = /* @__PURE__ */ createSignedInHint(signedInFromCookie);

export function ExplorerLink(props: Omit<ComponentProps<typeof SharedLink>, 'href' | 'signedIn'>) {
  return <SharedLink href={EXPLORER_HOME_HREF} signedIn={useSignedInHint()} {...props} />;
}
