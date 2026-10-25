'use client';

import { ExplorerLink as SharedLink } from '@liveworkspace/ui';
import type { ComponentProps } from 'react';
import { EXPLORER_HOME_HREF, useSignedInHint } from './HeaderPrimaryCta';

// The site header's Explorer link (docs/specs/019-marketing/marketing-site.md "Header"): @liveworkspace/ui's,
// to this site's Explorer Home, stepping aside when this product's hint cookie says signed in.
export function ExplorerLink(props: Omit<ComponentProps<typeof SharedLink>, 'href' | 'signedIn'>) {
  return <SharedLink href={EXPLORER_HOME_HREF} signedIn={useSignedInHint()} {...props} />;
}
