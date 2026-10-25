'use client';

import { SiteSwitcher as SharedSwitcher } from '@liveworkspace/ui';
import type { ComponentProps } from 'react';
import { BRAND_APP } from './brand-app';

// The site switcher (liveworkspace/docs/site-switcher.md), @liveworkspace/ui's, drawn in this app's prism.
export function SiteSwitcher(props: Omit<ComponentProps<typeof SharedSwitcher>, 'app'>) {
  return <SharedSwitcher app={BRAND_APP} {...props} />;
}
