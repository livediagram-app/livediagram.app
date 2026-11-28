'use client';

import {
  Brand as SharedBrand,
  BrandMark as SharedBrandMark,
  type BrandProps,
} from '@liveworkspace/brand';
// liveworkspace's own logo (the platform's prism and wordmark): an idle Screen shows it (screen-and-room-sign.md).
export { WorkspaceMark, WorkspaceWordmark } from '@liveworkspace/brand';
import type { ComponentProps } from 'react';
import { BRAND_APP } from './brand-app';

// This app's logo and prism, as @liveworkspace/brand draws every app's.
export function Brand(props: Omit<BrandProps, 'app'>) {
  return <SharedBrand app={BRAND_APP} {...props} />;
}

export function BrandMark(props: Omit<ComponentProps<typeof SharedBrandMark>, 'app'>) {
  return <SharedBrandMark app={BRAND_APP} {...props} />;
}

// Another app's logo, as @liveworkspace/brand draws it: a file from that app (a Screen's file, Work Tracker 1427).
export function AppBrandMark(props: ComponentProps<typeof SharedBrandMark>) {
  return <SharedBrandMark {...props} />;
}
