import { Brand as LivediagramBrand, BrandMark } from '@livediagram/ui';
import { Brand as LivedesignBrand, BrandMark as LivedesignMark } from '@livedesign/ui';
import { Brand as LivedocumentsBrand, BrandMark as LivedocumentsMark } from '@livedocuments/ui';
import { Brand as LiveplannerBrand, BrandMark as LiveplannerMark } from '@liveplanner/ui';
import type { CSSProperties } from 'react';
import type { ListedApp } from '@/lib/apps';

const BRANDS: Record<string, typeof LivediagramBrand> = {
  'livediagram.app': LivediagramBrand,
  'liveplanner.app': LiveplannerBrand,
  'livedocuments.app': LivedocumentsBrand,
  'livedesign.app': LivedesignBrand,
};

// An app's logo as its own header draws it: its UI package's Brand, with the prism, the hover
// shimmer and "live" in its accent. Each Brand colours "live" with its own brand-700 (light) and
// its accent's 400 (dark); this site's scales are not the apps', so the wrapper points those at
// the app's deep and accent colours.
export function AppLogo({ app, size = 'lg' }: { app: ListedApp; size?: 'sm' | 'md' | 'lg' }) {
  const Brand = BRANDS[app.id] ?? LivediagramBrand;
  return (
    <span
      className="inline-flex"
      style={
        {
          '--color-brand-700': app.deep,
          '--color-sky-400': app.accent,
          '--color-violet-400': app.accent,
          '--color-amber-400': app.accent,
          '--color-rose-400': app.accent,
        } as CSSProperties
      }
    >
      <Brand size={size} />
    </span>
  );
}

const MARKS: Record<string, typeof BrandMark> = {
  'livediagram.app': BrandMark,
  'liveplanner.app': LiveplannerMark,
  'livedocuments.app': LivedocumentsMark,
  'livedesign.app': LivedesignMark,
};

// An app's prism alone, for places too small for the wordmark: its own, or for an app with no UI
// package here, the shared prism tinted with its accent.
export function AppMark({ app, className }: { app: ListedApp; className: string }) {
  const Mark = MARKS[app.id];
  return Mark ? (
    <Mark className={className} />
  ) : (
    <BrandMark accentColor={app.accent} className={className} />
  );
}
