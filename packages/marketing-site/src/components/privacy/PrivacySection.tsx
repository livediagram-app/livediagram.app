// Privacy section: shares the TemplateGallery's inset band (band-classes.ts), so the
// landing page reads as two distinct promises (what you can make, how we handle the data)
// set apart from the story beats. Each card leads with an animated illustration in the
// FeatureArt vocabulary (Frame + SVG + fa-* keyframes, ./PrivacyArt), drawn for both appearances.
//
// The band is the same in every product; the promises are the product's own words, and `maker` is
// what the lede calls the product ("an editor", "a planner").

import type { ReactNode } from 'react';
import { BAND_CARD, BAND_LEAD, BAND_SECTION, BAND_TITLE } from '../../lib/band-classes';
import { EYEBROW } from '../../lib/eyebrow';

/** One privacy card: its title, its sentence or two, and its illustration. */
export interface PrivacyPromise {
  title: string;
  description: string;
  art: ReactNode;
}

export function PrivacySection({
  promises,
  maker,
}: {
  promises: readonly PrivacyPromise[];
  maker: string;
}) {
  return (
    <section id="privacy" className={BAND_SECTION} aria-labelledby="privacy-heading">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className={EYEBROW}>Privacy by design</p>
          <h2 id="privacy-heading" className={BAND_TITLE}>
            Your data, your call
          </h2>
          <p className={BAND_LEAD}>
            {`We don’t make money by being creepy. No third-party trackers, no ads, no resale, no surprise audience. Just ${maker} that treats your work like your work.`}
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {promises.map((p) => (
            <article key={p.title} className={`flex flex-col p-5 ${BAND_CARD}`}>
              {p.art}
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {p.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {p.description}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-slate-600 dark:text-slate-400">
          Read the full{' '}
          <a
            href="https://www.liveworkspace.app/privacy"
            className="underline transition hover:text-slate-900 dark:hover:text-slate-200"
          >
            privacy policy
          </a>
          {' or check the live '}
          <a
            href="/telemetry"
            className="underline transition hover:text-slate-900 dark:hover:text-slate-200"
          >
            telemetry dashboard
          </a>
          .
        </p>
      </div>
    </section>
  );
}
