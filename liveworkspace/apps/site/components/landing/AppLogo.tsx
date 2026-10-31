import { Brand, BrandMark, BRAND_APPS, type BrandApp } from '@liveworkspace/brand';
import type { CSSProperties } from 'react';
import type { ListedApp } from '@/lib/apps';

// The brand package's name for a listed app ('livediagram' for livediagram.app), or null for one it
// has no logo for yet.
export function brandAppOf(id: string): BrandApp | null {
  const app = id.replace(/\.app$/, '');
  return app in BRAND_APPS ? (app as BrandApp) : null;
}

// An app's logo as its own header draws it: the prism, the hover shimmer and "live" in its accent.
// The logo colours "live" with brand-700 (light) and the app's 400 (dark); this site's scales are
// not the apps', so the wrapper points those at the app's deep shade and its own 400. Its 500
// accent is too dim for "live" on a dark card (liveplanner's violet is 4.1:1 there).
export function appLogoInks(app: ListedApp, brand: BrandApp): CSSProperties {
  const dark = BRAND_APPS[brand].ramp[400];
  return {
    '--color-brand-700': app.deep,
    '--color-sky-400': dark,
    '--color-violet-400': dark,
    '--color-amber-400': dark,
    '--color-rose-400': dark,
  } as CSSProperties;
}

export function AppLogo({ app, size = 'lg' }: { app: ListedApp; size?: 'sm' | 'md' | 'lg' }) {
  const brand = brandAppOf(app.id);
  if (!brand) return <span className="font-semibold">{app.name}</span>;
  return (
    <span className="inline-flex" style={appLogoInks(app, brand)}>
      <Brand app={brand} size={size} />
    </span>
  );
}

// An app's prism alone, for places too small for the wordmark: its own, or for an app the brand
// package has no logo for yet, livediagram's prism tinted with its accent.
export function AppMark({ app, className }: { app: ListedApp; className: string }) {
  const brand = brandAppOf(app.id);
  return brand ? (
    <BrandMark app={brand} className={className} />
  ) : (
    <BrandMark app="livediagram" accentColor={app.accent} className={className} />
  );
}
