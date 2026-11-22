import { CATEGORY_ICONS } from '@/components/category-icons';
import { LANDING_SECTIONS } from '@/lib/landing-content';

// The sideways links between the feature pages (docs/specs/019-marketing/marketing-site.md "Feature pages"): every
// other section's page, so a visitor (and a crawler) can move through the set without going home first.
export function OtherCategories({ currentId }: { currentId: string }) {
  const others = LANDING_SECTIONS.filter((section) => section.id !== currentId);
  return (
    <section className="border-t border-slate-200/70 bg-white dark:border-slate-800/70 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Explore More of liveknowledge
        </h2>
        <ul className="mt-8 flex flex-wrap justify-center gap-3">
          {others.map((section) => {
            const Icon = CATEGORY_ICONS[section.id];
            return (
              <li key={section.id}>
                <a
                  href={`/features/${section.id}`}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors duration-micro hover:border-brand-300 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:text-brand-200"
                >
                  {Icon ? <Icon size={15} aria-hidden /> : null}
                  <span className="text-optical-centre">{section.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
