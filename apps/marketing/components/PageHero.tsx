import type { ReactNode } from 'react';

// The tinted hero band that opens the marketing content pages (FAQ, the comparison hub and each comparison):
// an eyebrow pill, the h1, a lede, and an optional slot below them (the FAQ's search, a comparison's CTA).
export function PageHero({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lede: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-slate-200/70 bg-gradient-to-b from-brand-50/70 to-transparent px-6 pt-16 pb-14 text-center sm:pt-20 dark:border-slate-800/70 dark:from-brand-500/10">
      <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-wide text-brand-700 uppercase ring-1 ring-brand-100 dark:bg-slate-900 dark:text-brand-300 dark:ring-brand-500/20">
        {eyebrow}
      </p>
      <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl dark:text-slate-100">
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
        {lede}
      </p>
      {children}
    </div>
  );
}
