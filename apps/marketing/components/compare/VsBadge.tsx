import { BrandMark } from '@livediagram/ui';

import { COMPETITOR_LOOK } from '@/components/compare/competitor-look';

// The "livediagram vs <tool>" pair of tiles: our mark against a generic glyph of what the other tool is
// (competitor-look.ts), never its logo, so the page compares without borrowing anyone's brand.
export function VsBadge({ slug, size = 'lg' }: { slug: string; size?: 'lg' | 'sm' }) {
  const look = COMPETITOR_LOOK[slug];
  const Icon = look?.icon;
  const tile = size === 'lg' ? 'size-16 rounded-2xl' : 'size-12 rounded-xl';
  const mark = size === 'lg' ? 'size-9' : 'size-7';
  return (
    <span className="inline-flex items-center gap-3" aria-hidden="true">
      <span
        className={`flex items-center justify-center bg-brand-500 text-white shadow-md shadow-brand-500/25 dark:bg-brand-600 ${tile}`}
      >
        <BrandMark className={mark} tone="mono" />
      </span>
      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase ring-1 ring-slate-200 dark:bg-slate-900/80 dark:text-slate-400 dark:ring-slate-700">
        vs
      </span>
      <span
        className={`flex items-center justify-center bg-white shadow-md shadow-slate-900/5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 ${tile} ${look?.glyph ?? 'text-slate-500'}`}
      >
        {Icon && <Icon size={size === 'lg' ? 28 : 22} />}
      </span>
    </span>
  );
}
