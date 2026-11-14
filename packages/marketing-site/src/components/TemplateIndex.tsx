import { lucideChevronDown } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';

const ChevronIcon = lucideGlyph(lucideChevronDown, 16);

// The folded shelves' templates as plain links (each product's docs/specs/019-marketing/marketing-site.md): a folded
// shelf draws no preview cards until it opens, so its templates would otherwise be missing from the page's HTML.
// Each is a text link to the same place its card goes (the product's create link), A to Z and once each however many
// shelves list it, under a native <details> that starts closed: the links are in the static HTML for crawlers and a
// visitor who wants a template by name finds it in one press, without a script, while the band stays short. The
// open shelf's templates are its cards, so they are left out.

export type IndexedTemplate = { kind: string; title: string };

/** The folded shelves' templates, once each, A to Z by title, less any the open shelf already shows as a card. */
export function indexedTemplates<T extends IndexedTemplate>(
  folded: readonly { templates: readonly T[] }[],
  open: readonly T[],
): T[] {
  const seen = new Set(open.map((t) => t.kind));
  const out: T[] = [];
  for (const shelf of folded)
    for (const t of shelf.templates) {
      if (seen.has(t.kind)) continue;
      seen.add(t.kind);
      out.push(t);
    }
  return out.sort((a, b) => a.title.localeCompare(b.title, 'en'));
}

export function TemplateIndex<T extends IndexedTemplate>({
  templates,
  href,
}: {
  templates: readonly T[];
  href: (template: T) => string;
}) {
  if (templates.length === 0) return null;
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 transition marker:hidden hover:bg-white hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 pointer-coarse:py-3 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-brand-300 [&::-webkit-details-marker]:hidden">
        Every Template A to Z
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {templates.length}
        </span>
        <span className="text-slate-500 transition-transform group-open:rotate-180 motion-reduce:transition-none dark:text-slate-400">
          <ChevronIcon />
        </span>
      </summary>
      <ul className="mt-3 columns-2 gap-x-6 px-3 sm:columns-3 lg:columns-4">
        {templates.map((t) => (
          <li key={t.kind} className="break-inside-avoid">
            <a
              href={href(t)}
              className="block rounded py-1 text-sm text-slate-600 underline-offset-2 hover:text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 pointer-coarse:py-3 dark:text-slate-400 dark:hover:text-brand-300"
            >
              {t.title}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
