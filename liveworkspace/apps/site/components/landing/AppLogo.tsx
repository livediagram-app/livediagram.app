import { Brand as LivediagramBrand, BrandMark } from '@livediagram/ui';
import { Brand as LiveplannerBrand, BrandMark as LiveplannerMark } from '@liveplanner/ui';
import type { CSSProperties } from 'react';
import type { ListedApp } from '@/lib/apps';

const BRANDS: Record<string, typeof LivediagramBrand> = {
  'livediagram.app': LivediagramBrand,
  'liveplanner.app': LiveplannerBrand,
};

// An app's logo as its own header draws it. livediagram's and liveplanner's come from their UI
// packages; livedocuments and livedesign have none in this repo yet, so theirs is drawn the same way:
// the shared prism tinted with the app's accent, and the wordmark with "live" in it.
const SIZES = {
  sm: { text: 'gap-2 text-base', mark: 'size-5' },
  md: { text: 'gap-2.5 text-lg', mark: 'size-7' },
  lg: { text: 'gap-3 text-2xl', mark: 'size-10' },
} as const;

export function AppLogo({ app, size = 'lg' }: { app: ListedApp; size?: keyof typeof SIZES }) {
  const Brand = BRANDS[app.id];
  if (Brand) return <Brand size={size} />;
  return (
    <span
      className={`inline-flex items-center ${SIZES[size].text} font-semibold tracking-tight text-slate-900 dark:text-slate-100`}
      style={{ '--lw-ink': app.deep, '--lw-ink-dark': app.accent } as CSSProperties}
    >
      <BrandMark accentColor={app.accent} className={`${SIZES[size].mark} shrink-0`} />
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
};

// An app's prism alone, for places too small for the wordmark: its own where its UI package is here,
// otherwise the shared prism tinted with its accent.
export function AppMark({ app, className }: { app: ListedApp; className: string }) {
  const Mark = MARKS[app.id];
  return Mark ? (
    <Mark className={className} />
  ) : (
    <BrandMark accentColor={app.accent} className={className} />
  );
}
