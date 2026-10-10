import { LANDING_SECTIONS } from '@/lib/landing-content';

// Lateral links between the feature category pages. With no /features hub,
// each category page was only reachable from the homepage; this block links
// every other category from each detail page so visitors (and crawlers) can
// move sideways through the set, spreading internal link equity and
// reinforcing the topical cluster. Rendered above the closing CTA.
export function OtherCategories({ currentId }: { currentId: string }) {
  const others = LANDING_SECTIONS.filter((section) => section.id !== currentId);

  return (
    <section className="border-t border-slate-200/70 bg-white dark:border-slate-800/70 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Explore more of livediagram
        </h2>
        <ul className="mt-8 flex flex-wrap justify-center gap-3">
          {others.map((section) => (
            <li key={section.id}>
              <a
                href={`/features/${section.id}`}
                className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:text-brand-200"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
