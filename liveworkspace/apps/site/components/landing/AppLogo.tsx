import { Brand as LivediagramBrand, BrandMark } from '@livediagram/ui';
import { Brand as LiveplannerBrand } from '@liveplanner/ui';
import type { CSSProperties } from 'react';
import type { PageApp } from '@/lib/apps';

const BRANDS: Record<string, typeof LivediagramBrand> = {
  'livediagram.app': LivediagramBrand,
  'liveplanner.app': LiveplannerBrand,
};

// An app's logo as its own header draws it. The live apps' come from their UI packages; an app on
// its way has no package here yet, so it is drawn the same way: the shared prism tinted with its
// accent, and the wordmark with "live" in it.
export function AppLogo({ app }: { app: PageApp }) {
  const Brand = BRANDS[app.domain];
  if (Brand) return <Brand size="lg" />;
  return (
    <span
      className="inline-flex items-center gap-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"
      style={{ '--lw-ink': app.deep, '--lw-ink-dark': app.accent } as CSSProperties}
    >
      <BrandMark accentColor={app.accent} className="size-10 shrink-0" />
      <span data-logotype="">
        <span className="text-[var(--lw-ink)] dark:text-[var(--lw-ink-dark)]">live</span>
        {app.name.replace(/^live/, '')}
      </span>
    </span>
  );
}
