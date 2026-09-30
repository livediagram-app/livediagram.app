import { useEffect, useRef } from 'react';
import type { TemplateDescriptor, TemplateCategory, TemplateKind } from '@livediagram/templates';
import { TEMPLATE_CATEGORIES } from '@livediagram/templates';
import { CloseIcon, SearchIcon, SnapCarousel } from '@livediagram/ui';
import { AnimatedHeightBox } from '@/components/primitives/AnimatedHeightBox';
import { CategoryTile, TemplateCard } from '@/components/palette/template-picker-cards';

// A shelf the picker can open: a real template category, or the curated
// Popular set (POPULAR_TEMPLATE_KINDS) that leads it.
export type ShelfCategory = TemplateCategory | 'popular';

type Shelf = {
  id: ShelfCategory;
  label: string;
  description: string;
  items: TemplateDescriptor[];
};

// The template step's browse surface, lifted out of TemplatePicker: the
// search input plus a two-way body (flat search results / the category
// shelf). Render-only: the query / category state stays in TemplatePicker,
// since the wizard remounts this section on every step switch (the step
// container is keyed), so state held here would reset when the user peeks
// at the Location step and comes back.
//
// The shelf mirrors the landing page's "What do you want to create?" gallery
// (docs/specs/019-marketing/marketing-site.md): ONE shelf is open as a carousel of large
// cards, and every other one sits folded underneath as a fanned tile that
// opens it in the open one's place. Popular (Blank Canvas first, then the
// starters most people reach for) is open until the user opens another.
export function TemplatePickerBrowse({
  showIdentity,
  templateQuery,
  setTemplateQuery,
  templateFilter,
  filteredTemplates,
  openCategory,
  setOpenCategory,
  popularTemplates,
  categoryTemplates,
  templateKind,
  onTemplateCommit,
}: {
  // True when the identity row renders above (adds the separating margin).
  showIdentity: boolean;
  templateQuery: string;
  setTemplateQuery: (q: string) => void;
  // The debounced, normalised filter actually applied (empty = browse).
  templateFilter: string;
  filteredTemplates: TemplateDescriptor[];
  // The shelf the user last opened; null is the default, Popular.
  openCategory: ShelfCategory | null;
  setOpenCategory: (c: ShelfCategory | null) => void;
  popularTemplates: TemplateDescriptor[];
  categoryTemplates: (category: TemplateCategory) => TemplateDescriptor[];
  templateKind: TemplateKind;
  // Single-click a template card: select it AND move on (the welcome wizard to Location, Quick Start applies it)
  // (docs/specs/006-document/offline-mode.md). The same handler backs double-click, so either gesture works.
  onTemplateCommit: (kind: TemplateKind) => void;
}) {
  const shelves: Shelf[] = [
    {
      id: 'popular' as const,
      label: 'Popular',
      description: 'Where most people start.',
      items: popularTemplates,
    },
    ...TEMPLATE_CATEGORIES.map((c): Shelf => ({ ...c, items: categoryTemplates(c.id) })),
  ].filter((shelf) => shelf.items.length > 0);
  const openId = openCategory ?? 'popular';
  const open = shelves.find((shelf) => shelf.id === openId) ?? shelves[0];
  const folded = shelves.filter((shelf) => shelf !== open);
  // Popular only repeats templates the categories already hold, so it is left
  // out of the "more templates" sum.
  const foldedCount = folded
    .filter((shelf) => shelf.id !== 'popular')
    .reduce((n, shelf) => n + shelf.items.length, 0);

  // Opening a folded tile swaps it into the carousel at the top of the step;
  // bring that row into view if the user had scrolled down to the tiles.
  const shelfTop = useRef<HTMLDivElement>(null);
  const openedOnce = useRef(false);
  useEffect(() => {
    if (!openedOnce.current) {
      openedOnce.current = true;
      return;
    }
    shelfTop.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [openId]);

  return (
    <>
      {/* Search leads the step as a full-width field (the landing gallery's
          search in the picker's chrome), so finding a template by name reads
          as the first way in rather than a small box beside a label. The
          dialog title already says Quick Start / New Document, so there is no
          section label above it. */}
      <div className={`relative ${showIdentity ? 'mt-5' : ''}`}>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400" />
        <input
          type="search"
          value={templateQuery}
          onChange={(e) => setTemplateQuery(e.target.value)}
          placeholder="Search for what you want to create..."
          aria-label="Search templates"
          autoComplete="off"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-400 transition [&::-webkit-search-cancel-button]:hidden focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-400/25 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:bg-slate-800"
        />
        {templateQuery ? (
          <button
            type="button"
            onClick={() => setTemplateQuery('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>
      {/* A non-empty search overrides the shelf and shows flat results across
          the whole catalogue. Blank is special-cased out of the category
          grouping (it's a "start from scratch", not a category template) and
          leads the Popular shelf instead. */}
      <AnimatedHeightBox viewKey={templateFilter ? 'search' : 'shelf'} className="mt-4">
        {templateFilter ? (
          filteredTemplates.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-slate-400 dark:text-slate-400">
              No templates match “{templateQuery.trim()}”.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {filteredTemplates.map((t) => (
                <TemplateCard
                  key={t.kind}
                  template={t}
                  active={templateKind === t.kind}
                  onSelect={() => onTemplateCommit(t.kind)}
                  onCommit={() => onTemplateCommit(t.kind)}
                />
              ))}
            </div>
          )
        ) : (
          <div ref={shelfTop} className="scroll-mt-4">
            {open ? (
              // The open shelf sits on its own tinted stage and rises into
              // place each time it changes (keyed on the shelf), so opening a
              // tile below draws the eye back up to what just opened.
              <div
                key={open.id}
                className="animate-shelf-open rounded-xl border border-brand-100 bg-brand-50/50 p-3 dark:border-brand-500/20 dark:bg-brand-500/5"
              >
                <SnapCarousel
                  label={open.label}
                  itemsKey={open.id}
                  heading={
                    <>
                      <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {open.label}
                      </h3>
                      <span className="shrink-0 rounded-full bg-white px-1.5 py-px text-[10px] font-semibold tabular-nums text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                        {open.items.length}
                        <span className="sr-only"> templates</span>
                      </span>
                      <span className="hidden truncate text-xs text-slate-500 sm:inline dark:text-slate-400">
                        {open.description}
                      </span>
                    </>
                  }
                  trackClassName="mt-2"
                  itemClassName="[&>li]:basis-[calc((100%-0.75rem)/2)] sm:[&>li]:basis-[calc((100%-1.5rem)/3)]"
                >
                  {open.items.map((t) => (
                    <li key={t.kind} className="flex">
                      <TemplateCard
                        template={t}
                        large
                        active={templateKind === t.kind}
                        onSelect={() => onTemplateCommit(t.kind)}
                        onCommit={() => onTemplateCommit(t.kind)}
                      />
                    </li>
                  ))}
                </SnapCarousel>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Explore More Categories
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {folded.length} more categories, {foldedCount} more templates
              </p>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {folded.map((shelf) => (
                <li key={shelf.id}>
                  <CategoryTile
                    label={shelf.label}
                    ariaLabel={`Browse ${shelf.label} templates`}
                    count={shelf.items.length}
                    // Blank's dashed square makes a dull fan card; Popular
                    // fans the starters after it.
                    kinds={shelf.items.filter((t) => t.kind !== 'blank').map((t) => t.kind)}
                    onOpen={() => setOpenCategory(shelf.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </AnimatedHeightBox>
    </>
  );
}
