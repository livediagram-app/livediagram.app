import { DeferredPreviewFan } from '@liveworkspace/template-previews/deferred-preview-fan';
import type { ComponentType } from 'react';
import { BAND_CARD, BAND_CONTROL_HOVER, BAND_LABEL } from '../lib/band-classes';
import type { TemplateShelf } from './TemplateGallery';

// The template gallery's folded shelves (each product's docs/specs/019-marketing/marketing-site.md): one card per
// shelf not open, so they read as part of the gallery rather than a row of tags under it. Each shows a fanned stack
// of its first three templates' previews (@liveworkspace/template-previews' DeferredPreviewFan over the product's
// previews: only the front card is in the page's HTML, the other two are added when the browser is idle), its name and how many templates it holds. Hovering or
// focusing a card fans the stack wider. Clicking opens the category's carousel above, as the chips it replaced did.
// The folded shelves' templates themselves are plain links underneath (TemplateIndex.tsx), not cards.

export function CategoryTiles<Id extends string, T extends { kind: string }>({
  groups,
  onOpen,
  Preview,
}: {
  groups: readonly TemplateShelf<Id, T>[];
  onOpen: (id: Id) => void;
  Preview: ComponentType<{ kind: T['kind'] }>;
}) {
  // A template cross-listed on two folded shelves counts once.
  const total = new Set(groups.flatMap((g) => g.templates.map((t) => t.kind))).size;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className={BAND_LABEL}>Explore More Categories</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {groups.length} more {groups.length === 1 ? 'category' : 'categories'}, {total} more{' '}
          {total === 1 ? 'template' : 'templates'}
        </p>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {groups.map((group) => (
          <li key={group.id}>
            <button
              type="button"
              onClick={() => onOpen(group.id)}
              className={`group flex h-full w-full cursor-pointer flex-col p-3 text-left ${BAND_CARD} ${BAND_CONTROL_HOVER}`}
            >
              <DeferredPreviewFan Preview={Preview} kinds={group.templates.map((t) => t.kind)} />
              <span className="mt-3 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {/* The tile's name is its own text, "Show Brainstorm 5 templates", so what it shows is
                      part of what a screen reader announces (WCAG 2.5.3). */}
                  <span className="sr-only">Show </span>
                  {group.label}
                </span>
                <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                  {group.templates.length} {group.templates.length === 1 ? 'template' : 'templates'}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
