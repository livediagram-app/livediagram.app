'use client';

import { Brand, type BrandApp } from '@liveworkspace/brand';
import { SITES, type AppSiteId } from '@liveworkspace/sites';
import type { CSSProperties } from 'react';

// An app's logo in the site's header, on the sign-in pages under that app's address (HeaderLogo). Its own module, so
// only those pages load the logo's code: liveworkspace.app's pages never draw it.
export default function HeaderAppBrand({ app }: { app: AppSiteId }) {
  // The logo's "live" is the host's brand-700, and this site's is liveworkspace's: give it the app's own deep shade,
  // as the switcher's rows do. No box of its own, so the logo stays the flex item.
  const deep = SITES.find((site) => site.id === app)?.deep;
  return (
    <span style={{ display: 'contents', '--color-brand-700': deep } as CSSProperties}>
      <Brand
        app={app.replace(/\.app$/, '') as BrandApp}
        href="/"
        size="md"
        className="relative touch-target-y"
      />
    </span>
  );
}
