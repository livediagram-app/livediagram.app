import { lucideGlyph } from '@livediagram/ui';
import { lucideArrowLeftRight, lucideArrowRight } from '@liveworkspace/icons/lucide';
import type { SiteId } from '@liveworkspace/sites';
import { type ListedApp, listedApps } from '@/lib/apps';
import { TOGETHER, type TogetherCard, togetherHref } from '@/lib/together';
import { AppMark } from './AppLogo';

const ArrowIcon = lucideGlyph(lucideArrowRight, 16);
const BothWaysIcon = lucideGlyph(lucideArrowLeftRight, 16);

// Each app's prism is drawn once, in the section's sprite, and every card shows it by reference: a prism carries a
// dozen gradients, and nine cards hold 42 of them, which drawn in full added 190 KB to the page's HTML.
const markId = (id: SiteId) => `together-mark-${id.replace(/\.app$/, '')}`;

// A card's own link, under its words (the promise tiles' link).
const CARD_LINK =
  'relative touch-target-y mt-auto inline-flex w-fit items-center gap-1.5 pt-4 text-sm font-semibold text-slate-900 underline-offset-4 hover:underline dark:text-white';

// How work moves between the apps (liveworkspace/docs/specs/010-site/site.md "How work moves between them"): the
// features that hand work from one app to the next, each with the apps it joins drawn above its words.
export function Together() {
  const apps = new Map(listedApps().map((app) => [app.id, app]));
  return (
    <section id="together" className="relative scroll-mt-20">
      <svg aria-hidden className="absolute size-0 overflow-hidden">
        {[...apps.values()].map((app) => (
          <symbol key={app.id} id={markId(app.id)} overflow="visible">
            <AppMark app={app} className="size-full" />
          </symbol>
        ))}
      </svg>
      <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 sm:pb-28">
        <p className="text-sm font-semibold tracking-[.18em] text-slate-500 uppercase dark:text-slate-400">
          Better together
        </p>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          Work moves between the apps.
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          Each app hands its work to the next, so nothing is typed twice and nothing goes stale.
        </p>
        {/* Nine cards: three rows of three, or over two columns the ninth across the foot. */}
        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOGETHER.map((card) => (
            <li
              key={card.key}
              className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 sm:last:odd:col-span-2 lg:last:odd:col-span-1 dark:border-slate-800 dark:bg-slate-900"
            >
              <Flow card={card} apps={apps} />
              <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">
                {card.title}
              </h3>
              <p className="mt-1.5 leading-relaxed text-slate-600 dark:text-slate-300">
                {card.body}
              </p>
              <a href={togetherHref(card.link)} className={CARD_LINK}>
                {card.link.kind === 'page' ? (
                  card.link.label
                ) : (
                  <>
                    See How It Works<span className="sr-only">: {card.title}</span>
                  </>
                )}
                <span aria-hidden>→</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// The apps a card joins: where it starts, an arrow, where it lands; or one row where every app takes part.
// Decorative: the words name the apps.
function Flow({ card, apps }: { card: TogetherCard; apps: Map<SiteId, ListedApp> }) {
  const marks = (ids: readonly SiteId[]) => (
    <span className="flex -space-x-1.5">
      {ids.flatMap((id) =>
        apps.has(id)
          ? [
              <span
                key={id}
                className="flex size-9 items-center justify-center rounded-full bg-white ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-700"
              >
                <svg className="size-5 overflow-visible">
                  <use href={`#${markId(id)}`} width="100%" height="100%" overflow="visible" />
                </svg>
              </span>,
            ]
          : [],
      )}
    </span>
  );
  return (
    <div aria-hidden className="flex flex-wrap items-center gap-2.5 select-none">
      {marks(card.from)}
      {card.to ? (
        <>
          <span className="text-slate-400 dark:text-slate-500">
            {card.both ? <BothWaysIcon /> : <ArrowIcon />}
          </span>
          {marks(card.to)}
        </>
      ) : null}
    </div>
  );
}
