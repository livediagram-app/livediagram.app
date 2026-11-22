import { ChevronRightIcon } from '@liveknowledge/ui';
import { FaqItem } from '@liveworkspace/marketing-site/components/faq/FaqItem';
import { EYEBROW } from '@liveworkspace/marketing-site/lib/eyebrow';

import { LANDING_FAQ } from '@/lib/faq-content';

// The landing page's FAQ (docs/specs/019-marketing/marketing-site.md "Structure" 9): eight plain answers, each a
// native <details> (the shared FaqItem), so every answer is in the static HTML and opens without script. The
// full list, with its search, is /faq, which also carries the FAQPage structured data.
export function LandingFaq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="scroll-mt-20 border-t border-slate-200/70 bg-slate-50 dark:border-slate-800/70 dark:bg-slate-950"
    >
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <div className="text-center">
          <p className={EYEBROW}>FAQ</p>
          <h2
            id="faq-title"
            className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100"
          >
            Honest Answers
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            What it costs, who can see what, and what it does not do yet.
          </p>
        </div>
        <div className="mt-10 space-y-3">
          {LANDING_FAQ.map((item) => (
            <FaqItem key={item.q} q={item.q}>
              {item.a}
            </FaqItem>
          ))}
        </div>
        <p className="mt-8 text-center">
          <a
            href="/faq"
            className="group inline-flex items-center gap-1 rounded-sm text-base font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-300 dark:hover:text-brand-200"
          >
            Read Every Question
            <ChevronRightIcon
              size={16}
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            />
          </a>
        </p>
      </div>
    </section>
  );
}
