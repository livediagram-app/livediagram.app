import { lucideBookOpen, lucideMail } from '@livediagram/icons/lucide';
import { JsonLd, lucideGlyph, pageMetadata } from '@livediagram/ui';

import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { FaqBrowser } from '@/components/faq/FaqBrowser';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { TryItCard } from '@/components/TryItCard';
import { FAQ_CATEGORIES, faqAnswerText } from '@/lib/faq-content';

const FAQ_TITLE = 'FAQ · livediagram';
const FAQ_DESCRIPTION =
  'Answers to common questions about livediagram: getting started, collaboration, sharing, AI and MCP, import and export, privacy, and self-hosting.';

export const metadata = pageMetadata({
  title: FAQ_TITLE,
  description: FAQ_DESCRIPTION,
  path: '/faq',
});

// FAQPage JSON-LD: unlocks Google's expandable-FAQ rich result for this page. Built from the same
// FAQ_CATEGORIES the page renders, so the structured data cannot drift from the visible answers. Build-time only.
const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_CATEGORIES.flatMap((c) =>
    c.items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: faqAnswerText(item) },
    })),
  ),
};

const BookIcon = lucideGlyph(lucideBookOpen, 20);
const MailIcon = lucideGlyph(lucideMail, 20);

export default function FaqPage() {
  return (
    <>
      <JsonLd data={FAQ_JSON_LD} />
      <BreadcrumbJsonLd name="FAQ" path="/faq" />
      <Header surface="Faq" />
      <main className="pb-20 sm:pb-24">
        <FaqBrowser
          eyebrow="FAQ"
          title="Questions, answered"
          lede="Everything you might want to know about livediagram, from your first diagram to running your own copy."
        />

        <section aria-labelledby="faq-more-title" className="mx-auto mt-20 max-w-6xl px-6">
          <h2
            id="faq-more-title"
            className="text-center text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"
          >
            Still have a question?
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <a
              href="/help/"
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500/40"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                <BookIcon />
              </span>
              <p className="mt-4 font-semibold text-slate-900 dark:text-slate-100">
                Browse the Help Centre
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Step-by-step guides for every tool, mode and setting.
              </p>
            </a>
            <a
              href="/help/contact/"
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500/40"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                <MailIcon />
              </span>
              <p className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Get in touch</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Ask us anything, report a bug or share an idea.
              </p>
            </a>
            <TryItCard
              title="The quickest answer is to try it"
              body="No sign-up, nothing to install, free forever."
              source="Faq.Card"
            />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
