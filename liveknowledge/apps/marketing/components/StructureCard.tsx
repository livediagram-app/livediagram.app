import { ctaHref, type CtaSource } from '@liveknowledge/api-schema';
import { BAND_CARD, BAND_CONTROL_HOVER } from '@liveworkspace/marketing-site/lib/band-classes';
import { StructureArt } from '@liveknowledge/ui';
import { createLabelPrefix } from '@/lib/create-label';
import { structureCreateHref, type GalleryStructure } from '@/lib/template-gallery';

// One knowledgebase structure as a gallery card (docs/specs/019-marketing/marketing-site.md "Structure" 3): a link
// that makes a new knowledgebase from it straight away (/new?structure=<id>). Its picture is the knowledgebase it
// makes, as the editor's start draws it (StructureArt, @liveknowledge/ui): a miniature window in its group's colour,
// its real top pages in the tree and its emblem on the chosen page's cover. Then its name with its page count, then
// its line.
// `source` is the CTA slot the click is counted under.

const plural = (n: number) => `${n} ${n === 1 ? 'Page' : 'Pages'}`;

export function StructureCard({
  template,
  source,
}: {
  template: GalleryStructure;
  source: CtaSource;
}) {
  return (
    <a
      href={ctaHref(structureCreateHref(template.kind), source)}
      data-structure-card={template.kind}
      className={`group flex h-full flex-col p-3 ${BAND_CARD} ${BAND_CONTROL_HOVER}`}
    >
      {/* The picture: the knowledgebase it makes, as the editor's start draws it. Its wash fills this frame. */}
      <span className="block h-28 overflow-hidden rounded-xl p-3 max-sm:p-1.5">
        <StructureArt
          kind="structure"
          id={template.kind}
          group={template.group}
          pages={template.pages}
        />
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
