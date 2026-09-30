import { TemplatePreview } from '@livediagram/template-previews';
import type { TemplateCategory } from '@livediagram/templates';
import { ChevronDownIcon } from '@livediagram/ui';
import { BAND_CARD, BAND_CONTROL_HOVER, BAND_LABEL } from '@/components/band-classes';
import type { GalleryTemplate } from '@/lib/template-gallery';

// The template gallery's folded categories (docs/specs/019-marketing/marketing-site.md): one card
// per category not yet open, so they read as part of the gallery rather than a row of tags under
// it. Each shows a fanned stack of its first three templates' previews (the editor picker's own
// art, re-lit in dark by preview-art-tile on the plate), its name and how many templates it
// holds, and a Show All cue. Hovering or focusing a card fans the stack wider. Clicking opens the
// category's carousel above, as the chips it replaced did.

type Group = { id: TemplateCategory; label: string; templates: GalleryTemplate[] };

// Where each of the three previews sits in the fan, at rest and on hover.
const FAN = [
  '-translate-x-[108%] translate-y-[-44%] -rotate-6 group-hover:-translate-x-[122%] group-hover:-rotate-9 group-focus-visible:-translate-x-[122%] group-focus-visible:-rotate-9',
  '-translate-x-1/2 -translate-y-[58%] z-10 group-hover:-translate-y-[66%] group-focus-visible:-translate-y-[66%]',
  'translate-x-[8%] translate-y-[-44%] rotate-6 group-hover:translate-x-[22%] group-hover:rotate-9 group-focus-visible:translate-x-[22%] group-focus-visible:rotate-9',
];

export function CategoryTiles({
  groups,
  onOpen,
}: {
  groups: Group[];
  onOpen: (id: TemplateCategory) => void;
}) {
  const total = groups.reduce((n, g) => n + g.templates.length, 0);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className={BAND_LABEL}>Explore More Categories</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {groups.length} more categories, {total} more templates
        </p>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {groups.map((group) => (
          <li key={group.id}>
            <button
              type="button"
              onClick={() => onOpen(group.id)}
              aria-label={`Show ${group.label} templates`}
              className={`group flex h-full w-full flex-col p-3 text-left ${BAND_CARD} ${BAND_CONTROL_HOVER}`}
            >
              <span className="preview-art-tile relative block h-24 overflow-hidden rounded-xl bg-slate-50">
                {group.templates.slice(0, 3).map((t, i) => (
                  <span
                    key={t.kind}
                    className={`absolute left-1/2 top-1/2 flex h-14 w-[42%] items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm transition [&>svg]:h-10 [&>svg]:w-auto ${FAN[i]}`}
                  >
                    <TemplatePreview kind={t.kind} />
                  </span>
                ))}
              </span>
              <span className="mt-3 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {group.label}
                </span>
                <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                  {group.templates.length} templates
                </span>
              </span>
              <span className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500 group-hover:text-brand-700 dark:text-slate-400 dark:group-hover:text-brand-200">
                Show All
                <ChevronDownIcon size={12} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
