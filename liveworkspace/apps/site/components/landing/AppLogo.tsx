import { Brand as LivediagramBrand, BrandMark } from '@livediagram/ui';
import { BrandMark as LivedesignMark } from '@livedesign/ui';
import { BrandMark as LivedocumentsMark } from '@livedocuments/ui';
import { Brand as LiveplannerBrand, BrandMark as LiveplannerMark } from '@liveplanner/ui';
import type { CSSProperties } from 'react';
import type { ListedApp } from '@/lib/apps';

const BRANDS: Record<string, typeof LivediagramBrand> = {
  'livediagram.app': LivediagramBrand,
  'liveplanner.app': LiveplannerBrand,
};

// An app's logo as its own header draws it. livediagram's and liveplanner's are their UI packages'
// Brand. livedocuments' and livedesign's Brand colour "live" with their own brand scale, which this
// site doesn't have, so theirs is their own prism with the wordmark drawn here, "live" in the app's
// accent.
const SIZES = {
  sm: { text: 'gap-2 text-base', mark: 'size-5' },
  md: { text: 'gap-2.5 text-lg', mark: 'size-7' },
  lg: { text: 'gap-3 text-2xl', mark: 'size-10' },
} as const;

export function AppLogo({ app, size = 'lg' }: { app: ListedApp; size?: keyof typeof SIZES }) {
  const Brand = BRANDS[app.id];
  if (Brand) return <Brand size={size} />;
  const Mark = MARKS[app.id];
  return (
    <span
      className={`inline-flex items-center ${SIZES[size].text} font-semibold tracking-tight text-slate-900 dark:text-slate-100`}
      style={{ '--lw-ink': app.deep, '--lw-ink-dark': app.accent } as CSSProperties}
    >
      {Mark ? (
        <Mark className={`${SIZES[size].mark} shrink-0`} />
      ) : (
        <BrandMark accentColor={app.accent} className={`${SIZES[size].mark} shrink-0`} />
      )}
      <span data-logotype="">
        <span className="text-[var(--lw-ink)] dark:text-[var(--lw-ink-dark)]">live</span>
        {app.name.replace(/^live/, '')}
      </span>
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
