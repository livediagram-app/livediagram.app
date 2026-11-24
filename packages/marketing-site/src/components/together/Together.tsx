import { BRAND_APPS, type BrandApp, BrandMark } from '@liveworkspace/brand';
import { lucideArrowLeftRight, lucideArrowRight } from '@liveworkspace/icons/lucide';
import { APP_SITES, type SiteId, PLATFORM_SITE } from '@liveworkspace/sites';
import { lucideGlyph } from '@liveworkspace/ui';
import { TOGETHER, type TogetherCard, togetherFor, togetherHref } from '../../lib/together';

const ArrowIcon = lucideGlyph(lucideArrowRight, 16);
const BothWaysIcon = lucideGlyph(lucideArrowLeftRight, 16);

const brandOf = (id: SiteId): BrandApp | null => {
  const app = id.replace(/\.app$/, '');
  return app in BRAND_APPS ? (app as BrandApp) : null;
};

// Each app's prism is drawn once, in the section's sprite, and every card shows it by reference: a prism carries a
// dozen gradients, and nine cards hold 42 of them, which drawn in full added 190 KB to the page's HTML.
const markId = (id: SiteId) => `together-mark-${id.replace(/\.app$/, '')}`;

// A card's own link, under its words (the promise tiles' link).
const CARD_LINK =
  'relative touch-target-y mt-auto inline-flex w-fit items-center gap-1.5 pt-4 text-sm font-semibold text-slate-900 underline-offset-4 hover:underline dark:text-white';

// How work moves between the apps (liveworkspace/docs/specs/010-site/site.md "How work moves between them"): the
// features that hand work from one app to the next, each with the apps it joins drawn above its words.
// liveworkspace.app shows every card; a product's landing page passes its `app` and shows the ones it takes part
// in, closing on a link to the whole set.
export function Together({ app }: { app?: SiteId } = {}) {
  const site = app ? APP_SITES.find((s) => s.id === app) : undefined;
  const cards = app ? togetherFor(app) : TOGETHER;
  const ids = new Set(cards.flatMap((card) => [...card.from, ...(card.to ?? [])]));
  const marks = APP_SITES.filter((s) => ids.has(s.id) && brandOf(s.id));
  return (
    <section id="together" className="relative scroll-mt-20">
      <svg aria-hidden className="absolute size-0 overflow-hidden">
        {marks.map((s) => (
          <symbol key={s.id} id={markId(s.id)} overflow="visible">
            <BrandMark app={brandOf(s.id)!} className="size-full" />
          </symbol>
        ))}
      </svg>
      <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 sm:pb-28">
        <p className="text-sm font-semibold tracking-[.18em] text-slate-500 uppercase dark:text-slate-400">
          Better together
        </p>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          {site ? 'Works with your other apps' : 'Work moves between the apps.'}
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          {site
            ? `${site.name} hands its work to the other liveworkspace apps and takes theirs in.`
            : 'Each app hands its work to the next, so nothing is typed twice and nothing goes stale.'}
        </p>
        {/* Three columns from lg, two from sm with an odd last card across the foot, one on a phone. */}
        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <li
              key={card.key}
              className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 sm:last:odd:col-span-2 lg:last:odd:col-span-1 dark:border-slate-800 dark:bg-slate-900"
            >
              <Flow card={card} />
              <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">
                {card.title}
              </h3>
              <p className="mt-1.5 leading-relaxed text-slate-600 dark:text-slate-300">
                {card.body}
              </p>
              <a href={togetherHref(card.link, !site)} className={CARD_LINK}>
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
        {site ? (
          <a href={`${PLATFORM_SITE.url}/#together`} className={`${CARD_LINK} mt-8 pt-0 text-base`}>
            See how every app works together
            <span aria-hidden>→</span>
          </a>
        ) : null}
      </div>
    </section>
  );
}

// The apps a card joins: where it starts, an arrow, where it lands; or one row where every app takes part.
// Decorative: the words name the apps.
function Flow({ card }: { card: TogetherCard }) {
  const marks = (ids: readonly SiteId[]) => (
    <span className="flex -space-x-1.5">
      {ids.flatMap((id) =>
        brandOf(id)
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
