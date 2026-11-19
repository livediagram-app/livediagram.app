import type { ReactNode } from 'react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';

// A platform help article in the site's own chrome (liveworkspace/docs/specs/010-site/site.md "Help"): a heading, a
// lede, a row of links to its sections, and the sections, each under its own heading. Google Drive sync and the
// Explorer's articles are drawn with it.

// Reading styles for the article's plain HTML, as the legal pages set theirs.
export const PROSE =
  'text-[1.0625rem] leading-relaxed text-slate-700 dark:text-slate-300 [&_a]:font-medium [&_a]:text-slate-900 [&_a]:underline [&_a]:decoration-slate-300 [&_a]:underline-offset-4 hover:[&_a]:decoration-slate-900 dark:[&_a]:text-white dark:[&_a]:decoration-slate-600 dark:hover:[&_a]:decoration-white [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em] dark:[&_code]:bg-slate-800 [&_li]:pl-1 [&_li]:marker:text-slate-400 [&_p]:mt-4 first:[&_p]:mt-0 [&_strong]:font-semibold [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_table]:mt-4 [&_table]:w-full [&_table]:text-left [&_table]:text-base [&_th]:border-b [&_th]:border-slate-200 [&_th]:py-2 [&_th]:pr-4 [&_th]:font-semibold [&_th]:text-slate-900 dark:[&_th]:border-slate-700 dark:[&_th]:text-white [&_td]:border-b [&_td]:border-slate-100 [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top dark:[&_td]:border-slate-800';

export type HelpSection = { id: string; title: string; body: ReactNode };

export function HelpArticle({
  heading,
  lede,
  sections,
  after,
}: {
  heading: string;
  lede: string;
  sections: readonly HelpSection[];
  /** What follows the sections: links to the neighbouring articles. */
  after?: ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 pt-14 pb-20 sm:px-6 sm:pt-20 sm:pb-24">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Help
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl dark:text-white">
          {heading}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">{lede}</p>
        <nav aria-label="On this page" className="mt-8">
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="relative touch-target-y font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-white"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-10">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className="scroll-mt-24 border-t border-slate-200 py-10 dark:border-slate-800"
            >
              <h2
                id={`${section.id}-title`}
                className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white"
              >
                {section.title}
              </h2>
              <div className={`mt-5 ${PROSE}`}>{section.body}</div>
            </section>
          ))}
        </div>
        {after ? (
          <div className="border-t border-slate-200 pt-8 dark:border-slate-800">{after}</div>
        ) : null}
      </main>
      <Footer />
    </>
  );
}
