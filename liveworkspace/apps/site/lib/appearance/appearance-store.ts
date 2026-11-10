import { createAppearanceStore } from '@liveworkspace/ui/appearance-store';
import { PLATFORM_APPEARANCE_KEY, appearanceKeyForHost } from './appearance-keys';

// The site's one Appearance store (liveworkspace/docs/specs/010-site/site.md "Behaviour"), under the key of the
// address the page is on (appearance-keys.ts), read once when the module loads: in the browser that is the page's
// own address, which never changes under it; on the server, the platform's key, which only renders the default.
// Deliberately NOT a `'use client'` module, like each product's store.
export const SITE_APPEARANCE_STORE = createAppearanceStore(
  typeof window === 'undefined'
    ? PLATFORM_APPEARANCE_KEY
    : appearanceKeyForHost(window.location?.host ?? ''),
);

export const { getResolvedAppearance } = SITE_APPEARANCE_STORE;
