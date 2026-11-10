'use client';

import type { ComponentProps } from 'react';
import { SiteAppearanceToggle as SharedToggle, useAppearanceStore } from '@liveworkspace/ui';
import { SITE_APPEARANCE_STORE } from './appearance-store';

// The site's Appearance hook and switch, on its one store (appearance-store.ts): the address's app's setting on an
// app's address, the platform's on liveworkspace.app (liveworkspace/docs/specs/010-site/site.md "Behaviour").
export function useSiteAppearance() {
  return useAppearanceStore(SITE_APPEARANCE_STORE);
}

export function SiteAppearanceToggle(props: Omit<ComponentProps<typeof SharedToggle>, 'store'>) {
  return <SharedToggle store={SITE_APPEARANCE_STORE} {...props} />;
}
