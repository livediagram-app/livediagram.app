import { useState } from 'react';
import type { TemplateCategory, TemplateDescriptor, TemplateKind } from '@livediagram/templates';
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_COLLECTIONS,
  TEMPLATES,
  templateShelfTemplates,
} from '@livediagram/templates';
import { CloseIcon, SearchIcon } from '@livediagram/ui';
import { AnimatedHeightBox } from '@/components/primitives/AnimatedHeightBox';
import { BackBar } from '@/components/primitives/BackBar';
import { TemplateCard } from '@/components/palette/template-picker-cards';
import {
  TemplatePickerShelf,
  type Shelf,
  type ShelfCategory,
} from '@/components/palette/TemplatePickerShelf';

export type { ShelfCategory };

// Whiteboard is a different activity from the diagram templates, and not a category: never on a
// category shelf or a tile of its own, only on Popular (third) (docs/specs/023-whiteboard/whiteboard.md "Creating one").
const onShelf = (t: TemplateDescriptor) => t.kind !== 'whiteboard';

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
  shelfExpanded,
  setShelfExpanded,
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
  // The shelf's flow inverted (desktop only): every card of the open shelf,
  // the other categories as a carousel. Held by the picker like the open shelf.
  shelfExpanded: boolean;
  setShelfExpanded: (expanded: boolean) => void;
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
    ...TEMPLATE_COLLECTIONS.filter((c) => c.id === openCategory).map((c): Shelf => ({
      ...c,
      items: templateShelfTemplates(c.id, TEMPLATES),
    })),
    ...TEMPLATE_CATEGORIES.map((c): Shelf => ({
      ...c,
      items: categoryTemplates(c.id).filter(onShelf),
    })),
  ]
    // Popular is a curated list, so the Whiteboard it names stays on it; a category never shows it.
    .map((shelf) =>
      shelf.id === 'popular' ? shelf : { ...shelf, items: shelf.items.filter(onShelf) },
    )
    .filter((shelf) => shelf.items.length > 0);
  const openId = openCategory ?? 'popular';
  const open = shelves.find((shelf) => shelf.id === openId) ?? shelves[0];
  // A collection is never a folded tile: it leaves once another shelf opens.
  // A `?browse=` collection opens drilled in, as it always has: every card of it at once under a
  // back bar, the shelf and the other categories out of the way (docs/specs/007-editor/new-document-route.md).
  const collection = open && TEMPLATE_COLLECTIONS.some((c) => c.id === open.id) ? open : undefined;
  const folded = shelves.filter(
    (shelf) => shelf !== open && !TEMPLATE_COLLECTIONS.some((c) => c.id === shelf.id),
  );
  // True once the user has opened a tile in this mount. Only then does the
  // stage replay its entrance and scroll into view: on load the modal's own
  // entrance is the only motion, so nothing jitters as the page arrives.
  const [userOpened, setUserOpened] = useState(false);
  const openShelf = (id: ShelfCategory) => {
    setUserOpened(true);
    setOpenCategory(id);
  };

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
      <AnimatedHeightBox
        viewKey={templateFilter ? 'search' : collection ? 'collection' : 'shelf'}
        className="mt-4"
      >
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
        ) : collection ? (
          <>
            <BackBar
              label="All templates"
              current={collection.label}
              onClick={() => setOpenCategory('popular')}
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {collection.items.map((t) => (
                <TemplateCard
                  key={t.kind}
                  template={t}
                  active={templateKind === t.kind}
                  onSelect={() => onTemplateCommit(t.kind)}
                  onCommit={() => onTemplateCommit(t.kind)}
                />
              ))}
            </div>
          </>
        ) : (
          <TemplatePickerShelf
            open={open}
            folded={folded}
            onOpenShelf={openShelf}
            userOpened={userOpened}
            expanded={shelfExpanded}
            setExpanded={setShelfExpanded}
            templateKind={templateKind}
            onTemplateCommit={onTemplateCommit}
          />
        )}
      </AnimatedHeightBox>
    </>
  );
}
