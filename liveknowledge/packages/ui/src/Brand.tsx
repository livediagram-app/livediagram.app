'use client';

import {
  Brand as SharedBrand,
  BrandGlyph,
  BrandMark as SharedBrandMark,
  type BrandProps,
} from '@liveworkspace/brand';
import type { ComponentProps } from 'react';
import { BRAND_APP } from './brand-app';

// This app's logo and prism, as @liveworkspace/brand draws every app's.
export function Brand(props: Omit<BrandProps, 'app'>) {
  return <SharedBrand app={BRAND_APP} {...props} />;
}

export function BrandMark(props: Omit<ComponentProps<typeof SharedBrandMark>, 'app'>) {
  return <SharedBrandMark app={BRAND_APP} {...props} />;
}

/** liveworkspace's own mark, one colour (Connect File: a file from another liveworkspace app). */
export function WorkspaceMark(props: { className?: string }) {
  return <BrandGlyph {...props} />;
}

/** Another app's logo mark (a connected file's row: links-and-embeds.md "Connected files in the sidebar"). */
export function AppMark(props: ComponentProps<typeof SharedBrandMark>) {
  return <SharedBrandMark {...props} />;
}
