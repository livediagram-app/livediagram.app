import type { ReactNode } from 'react';
import { otherComparisons, reviewedOn } from '../catalogue';
import { CheckIcon, DotIcon } from '../icons';
import { lookOf } from '../looks';
import type { Alternative, Comparisons } from '../types';
import { AlternativeCard } from './AlternativeCard';
import { ComparisonTable } from './ComparisonTable';
import { FaqItem } from './FaqItem';
import type { Mark } from './mark';

const H2 = 'text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100';
const sectionId = (i: number) => `section-${i + 1}`;

// One comparison's body, under the app's own hero (README.md "Page shape"): an "On this page" index
// on wide screens, the table, "Which to pick", the deep dives, the FAQ, the app's call to action, the
// dated disclaimer, and other comparisons.
export function ComparisonArticle({
  comparisons,
  alt,
  mark,
  tryIt,
}: {
  comparisons: Comparisons;
  alt: Alternative;
  mark: Mark;
  tryIt: ReactNode;
}) {
  const { app } = comparisons;
  const look = lookOf(alt.slug);
  const CompetitorIcon = look.icon;
  const toc = [
    { id: 'at-a-glance', label: 'At a glance' },
    { id: 'which-to-pick', label: 'Which to pick' },
    ...alt.sections.map((section, i) => ({ id: sectionId(i), label: section.heading })),
    { id: 'faq', label: 'FAQ' },
  ];
  const others = otherComparisons(comparisons, alt.slug);

  return (
    <>
      <div className="mx-auto mt-14 grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[14rem_1fr] lg:gap-14">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-24">
            <p className="px-3 text-xs font-semibold tracking-wide text-slate-900 uppercase dark:text-slate-100">
              On this page
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {toc.map((entry) => (
                <li key={entry.id}>
                  <a
                    href={`#${entry.id}`}
                    className="block rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    {entry.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="min-w-0 space-y-16">
          <section id="at-a-glance" aria-labelledby="at-a-glance-title" className="scroll-mt-24">
            <h2 id="at-a-glance-title" className={H2}>
              At a glance
            </h2>
            <div className="mt-6">
              <ComparisonTable app={app} alt={alt} />
            </div>
          </section>

          {/* The honest two-sided takeaway (README.md "Golden rule"): two cards of equal weight. */}
          <section
            id="which-to-pick"
            aria-labelledby="which-to-pick-title"
            className="scroll-mt-24"
          >
            <h2 id="which-to-pick-title" className={H2}>
              Which to pick
            </h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-6 dark:border-brand-500/30 dark:bg-brand-500/10">
                <h3 className="flex items-center gap-2.5 font-semibold text-slate-900 dark:text-slate-100">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-brand-700 text-white dark:bg-brand-600">
                    {mark('size-5')}
                  </span>
                  Why pick {app}
                </h3>
                <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  {alt.usBest.map((point) => (
                    <li key={point} className="flex gap-2.5">
                      <span className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-300">
                        <CheckIcon />
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                <h3 className="flex items-center gap-2.5 font-semibold text-slate-900 dark:text-slate-100">
                  <span
                    className={`flex size-8 items-center justify-center rounded-lg bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 ${look.glyph}`}
                  >
                    {CompetitorIcon && <CompetitorIcon size={18} />}
                  </span>
                  Where {alt.name} is the better pick
                </h3>
                <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  {alt.themBest.map((point) => (
                    <li key={point} className="flex gap-2.5">
                      <span className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500">
                        <DotIcon />
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {alt.sections.map((section, i) => (
            <section
              key={section.heading}
              id={sectionId(i)}
              aria-labelledby={`${sectionId(i)}-title`}
              className="scroll-mt-24"
            >
              <h2 id={`${sectionId(i)}-title`} className={H2}>
                {section.heading}
              </h2>
              <div className="mt-4 max-w-3xl space-y-4">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="leading-relaxed text-slate-600 dark:text-slate-300">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}

          {/* Mirrored into the page's FAQPage JSON-LD (faqJsonLd). */}
          <section id="faq" aria-labelledby="faq-title" className="scroll-mt-24">
            <h2 id="faq-title" className={H2}>
              {alt.name} alternative FAQ
            </h2>
            <div className="mt-6 space-y-3">
              {alt.faqs.map((faq) => (
                <FaqItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </section>

          {tryIt}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Comparisons reflect each product&rsquo;s general positioning and may change. Check{' '}
            {alt.name}&rsquo;s own site for current details. Last reviewed{' '}
            <time dateTime={comparisons.updated.toISOString().slice(0, 10)}>
              {reviewedOn(comparisons.updated)}
            </time>
            .
          </p>
        </div>
      </div>

      {others.length > 0 && (
        <section aria-labelledby="others-title" className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
          <h2 id="others-title" className={`${H2} text-center`}>
            Other comparisons
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((other) => (
              <AlternativeCard key={other.slug} alt={other} mark={mark} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
