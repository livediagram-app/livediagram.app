import { lucideArrowRight, lucideCheck } from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';
import { AppMark } from '@/components/landing/AppLogo';
import type { Alternative } from '@/lib/alternatives';
import { COMPETITOR_LOOK } from '@/lib/alternatives/competitor-look';
import { compareVoice, voiceStyle } from './compare-theme';
import { VsBadge } from './VsBadge';

const ArrowIcon = lucideGlyph(lucideArrowRight, 16);
const CheckIcon = lucideGlyph(lucideCheck, 12);

// A link card to one comparison page: the hub's grid and the "Other comparisons" row under each
// page. A tinted header panel carries the vs tiles on a dot grid; below it the apps it is about,
// the page's h1, its description, and the competitor's three highlight chips (competitor-look.ts),
// all in the colours of the app the comparison speaks for.
export function AlternativeCard({ alt }: { alt: Alternative }) {
  const look = COMPETITOR_LOOK[alt.slug];
  const voice = compareVoice(alt.apps);
  return (
    <a
      href={`/alternatives/${alt.slug}`}
      style={voiceStyle(voice)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-900/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lw-ink)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900"
    >
      <span
        className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${look?.panel ?? 'from-slate-100 to-white dark:from-slate-800 dark:to-slate-900'}`}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 [background-image:radial-gradient(rgb(15_23_42/0.08)_1px,transparent_1px)] [background-size:14px_14px] dark:[background-image:radial-gradient(rgb(255_255_255/0.07)_1px,transparent_1px)]"
        />
        <span className="relative transition-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          <VsBadge slug={alt.slug} voice={voice} size="sm" />
        </span>
      </span>
      <span className="flex flex-1 flex-col p-6">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          <span>vs {alt.name}</span>
          <span aria-hidden="true">·</span>
          {voice.apps.map((app) => (
            <span
              key={app.id}
              className="inline-flex items-center gap-1 tracking-normal normal-case"
            >
              <AppMark app={app} className="size-3.5" />
              {app.name}
            </span>
          ))}
        </span>
        <span className="mt-2 block text-lg leading-snug font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {alt.h1}
        </span>
        <span className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {alt.description}
        </span>
        {look && (
          <span className="mt-4 flex flex-wrap gap-1.5">
            {look.highlights.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <span className="text-[var(--lw-ink)] dark:text-[var(--lw-ink-dark)]">
                  <CheckIcon />
                </span>
                {chip}
              </span>
            ))}
          </span>
        )}
        <span className="mt-auto flex items-center justify-between pt-6 text-sm font-medium text-slate-900 dark:text-slate-100">
          Read the comparison
          <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition group-hover:bg-[var(--lw-ink)] group-hover:text-white motion-reduce:transition-none dark:bg-slate-800 dark:text-slate-300">
            <ArrowIcon />
          </span>
        </span>
      </span>
    </a>
  );
}
