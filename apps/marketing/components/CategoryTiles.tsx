import { PreviewFan } from '@livediagram/template-previews';
import type { TemplateCategory } from '@livediagram/templates';
import { BAND_CARD, BAND_CONTROL_HOVER, BAND_LABEL } from '@/components/band-classes';
import type { GalleryTemplate } from '@/lib/template-gallery';

// The template gallery's folded categories (docs/specs/019-marketing/marketing-site.md): one card
// per category not yet open, so they read as part of the gallery rather than a row of tags under
// it. Each shows a fanned stack of its first three templates' previews (PreviewFan, shared with
// the editor's template picker), its name and how many templates it holds. Hovering or
// focusing a card fans the stack wider. Clicking opens the
// category's carousel above, as the chips it replaced did.

type Group = { id: TemplateCategory; label: string; templates: GalleryTemplate[] };

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
              className={`group flex h-full w-full cursor-pointer flex-col p-3 text-left ${BAND_CARD} ${BAND_CONTROL_HOVER}`}
            >
              <PreviewFan kinds={group.templates.map((t) => t.kind)} />
              <span className="mt-3 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {group.label}
                </span>
                <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                  {group.templates.length} templates
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
