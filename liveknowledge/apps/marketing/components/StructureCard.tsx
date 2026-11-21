import { ctaHref, type CtaSource } from '@liveknowledge/api-schema';
import { BAND_CARD, BAND_CONTROL_HOVER } from '@liveworkspace/marketing-site/lib/band-classes';
import { createLabelPrefix } from '@/lib/create-label';
import { structureCreateHref, type GalleryStructure } from '@/lib/template-gallery';

// One knowledgebase structure as a gallery card (docs/specs/019-marketing/marketing-site.md "Structure" 3): a link
// that makes a new knowledgebase from it straight away (/new?structure=<id>). In place of a picture, the structure
// itself, as the editor's start draws it (apps/editor components/start/structure-card.tsx): an outline of its page
// tree two levels deep, each top page with its subpages after it. Then its name with its page count, then its line.
// `source` is the CTA slot the click is counted under.

const plural = (n: number) => `${n} ${n === 1 ? 'Page' : 'Pages'}`;

export function StructureCard({
  template,
  source,
}: {
  template: GalleryStructure;
  source: CtaSource;
}) {
  const { lines, more } = template.outline;
  return (
    <a
      href={ctaHref(structureCreateHref(template.kind), source)}
      data-structure-card={template.kind}
      className={`group flex h-full flex-col p-3 ${BAND_CARD} ${BAND_CONTROL_HOVER}`}
    >
      {/* The outline: a quiet sheet of rows, the sidebar's tree in miniature. */}
      <span
        aria-hidden
        className="flex h-28 flex-col justify-center gap-0.5 overflow-hidden rounded-xl bg-slate-50 px-3.5 text-left text-[11px] leading-[15px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
      >
        {lines.map((line) => (
          <span key={line.title} className="flex min-w-0 items-baseline gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-[2px] bg-brand-500" />
            <span className="truncate">
              <span className="font-medium text-slate-800 dark:text-slate-100">{line.title}</span>
              {line.under.length > 0 ? (
                <span className="text-slate-500 dark:text-slate-400">
                  : {line.under.join(', ')}
                </span>
              ) : null}
            </span>
          </span>
        ))}
        {more > 0 ? (
          <span className="pl-3 text-slate-500 dark:text-slate-400">and {more} More</span>
        ) : null}
      </span>
      <span className="mt-3 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {/* The link's name is its own text, "Create a Team Handbook" and the rest, so its visible name is part
              of it (WCAG 2.5.3). */}
          <span className="sr-only">{createLabelPrefix(template.title)}</span>
          {template.title}
        </span>
        <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
          {plural(template.pageCount)}
        </span>
      </span>
      <span className="mt-1 block text-xs leading-relaxed text-slate-600 dark:text-slate-400">
        {template.line}
      </span>
    </a>
  );
}
