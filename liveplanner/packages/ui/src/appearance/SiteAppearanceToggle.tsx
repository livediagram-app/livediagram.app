'use client';

import { SiteAppearanceToggle as SharedToggle } from '@liveworkspace/ui';
import type { ComponentProps } from 'react';
import { APPEARANCE_STORE } from './appearance-store';

// The public sites' Appearance control (docs/specs/004-interface-design/appearance.md), on this product's
// store: @liveworkspace/ui's SiteAppearanceToggle.
export function SiteAppearanceToggle(props: Omit<ComponentProps<typeof SharedToggle>, 'store'>) {
  return <SharedToggle store={APPEARANCE_STORE} {...props} />;
}
