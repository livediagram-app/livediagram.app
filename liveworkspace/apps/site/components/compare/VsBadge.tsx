import { BrandMark } from '@livediagram/ui';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import { AppMark } from '@/components/landing/AppLogo';
import { COMPETITOR_LOOK } from '@/lib/alternatives/competitor-look';
import type { CompareVoice } from './compare-theme';

// The "<us> vs <tool>" pair of tiles: our mark (the app's own prism, or liveworkspace's for a suite
// comparison) against a generic glyph of what the other tool is (competitor-look.ts), never its
// logo, so the page compares without borrowing anyone's brand.
export function VsBadge({
  slug,
  voice,
  size = 'lg',
}: {
  slug: string;
  voice: CompareVoice;
  size?: 'lg' | 'sm';
}) {
  const look = COMPETITOR_LOOK[slug];
  const Icon = look?.icon;
  const tile = size === 'lg' ? 'size-16 rounded-2xl' : 'size-12 rounded-xl';
  const mark = size === 'lg' ? 'size-9' : 'size-7';
  const only = voice.apps.length === 1 ? voice.apps[0] : undefined;
  return (
    <span className="inline-flex items-center gap-3" aria-hidden="true">
      <span
        className={`flex items-center justify-center bg-white shadow-md shadow-slate-900/5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 ${tile}`}
      >
        {only ? (
          <AppMark app={only} className={mark} />
        ) : (
          <BrandMark accentColor={PLATFORM_SITE.accent} className={mark} />
        )}
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
