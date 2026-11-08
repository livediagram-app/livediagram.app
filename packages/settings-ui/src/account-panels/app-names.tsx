import type { CSSProperties } from 'react';
import { Brand, BRAND_APPS, type BrandApp } from '@liveworkspace/brand';
import { APP_SITES, type Site } from '@liveworkspace/sites';

// The apps named by their logos in Settings (Webhooks, Your Data), as liveworkspace.app's home page draws them, never
// as plain text: the prism and wordmark, "live" in the app's deep shade on light and its 400 on dark (its 500 accent
// is too dim for "live" on a dark card).

// The apps the brand package draws, by its name ('livediagram' for livediagram.app).
const APPS = new Map(
  APP_SITES.flatMap((site) => {
    const brand = site.id.replace(/\.app$/, '');
    return brand in BRAND_APPS ? [[brand, { site, brand: brand as BrandApp }] as const] : [];
  }),
);

function AppLogo({ site, brand }: { site: Site; brand: BrandApp }) {
  const dark = BRAND_APPS[brand].ramp[400];
  const inks = {
    '--color-brand-700': site.deep,
    '--color-sky-400': dark,
    '--color-violet-400': dark,
    '--color-amber-400': dark,
    '--color-rose-400': dark,
  } as CSSProperties;
  return (
    <span className="inline-flex" style={inks}>
      <Brand app={brand} size="xs" />
    </span>
  );
}

/** An app named by its logo and wordmark, at the size of the words around it. */
export function AppName({ app }: { app: string }) {
  const listed = APPS.get(app);
  return listed ? <AppLogo {...listed} /> : <span>{app}</span>;
}

/** Every app, by their logos. */
export function EveryAppName() {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {[...APPS.values()].map((listed) => (
        <AppLogo key={listed.site.id} {...listed} />
      ))}
    </span>
  );
}
