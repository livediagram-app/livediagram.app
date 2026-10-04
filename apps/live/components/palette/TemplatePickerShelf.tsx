import { scrollToTopWithin } from '@/lib/scroll-within';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { TemplateCategory, TemplateDescriptor, TemplateKind } from '@livediagram/templates';
import { TEMPLATES } from '@livediagram/templates';
import { MaximizeIcon, MinimizeIcon, SnapCarousel, Tooltip, useMediaQuery } from '@livediagram/ui';
import { CategoryTile, TemplateCard } from '@/components/palette/template-picker-cards';
import { track } from '@/lib/telemetry';

// A shelf the picker can open: a real template category, or the curated
// Popular set (POPULAR_TEMPLATE_KINDS) that leads it.
export type ShelfCategory = TemplateCategory | 'popular';

export type Shelf = {
  id: ShelfCategory;
  label: string;
  description: string;
  items: TemplateDescriptor[];
};

// The expand toggle is desktop-only, and so is the expanded layout: a phone
// that inherits the flag (a window narrowed after expanding) reads as the
// normal shelf, since it has no toggle to undo it with. `sm`, where the
// picker goes three across.
const EXPAND_MEDIA_QUERY = '(min-width: 640px)';

// A folded tile's fan, in catalogue order rather than the picker's shuffled
// one: the page is prerendered in catalogue order and shuffles only once it
// hydrates, so a fan drawn from the shuffle swapped its previews a moment after
// load. It fans only what the shelf holds, so a mode filter narrows the fan with the count
// (docs/specs/007-editor/templates-by-mode.md). Blank's dashed square makes a dull fan card, so
// Popular fans the starters after it.
function fanKinds(shelf: Shelf): TemplateKind[] {
  if (shelf.id === 'popular')
    return shelf.items.filter((t) => t.kind !== 'blank').map((t) => t.kind);
  const held = new Set(shelf.items.map((t) => t.kind));
  return TEMPLATES.filter((t) => held.has(t.kind)).map((t) => t.kind);
}

// The category shelf (docs/specs/008-canvas/canvas-and-palette.md "Templates section"): ONE
// shelf open on a tinted stage, every other one folded underneath as a fanned
// tile that opens it in the open one's place. By default the stage is a
// carousel and the folded tiles a grid; expanded (desktop only) the flow
// inverts: the stage shows every card of its shelf, and the folded tiles
// become the carousel.
export function TemplatePickerShelf({
  open,
  folded,
  onOpenShelf,
  userOpened,
  expanded: expandedFlag,
  setExpanded,
  templateKind,
  onTemplateCommit,
}: {
  open: Shelf | undefined;
  folded: Shelf[];
  onOpenShelf: (id: ShelfCategory) => void;
  // True once the user has opened a tile in this mount: only then does the
  // stage replay its entrance and scroll into view.
  userOpened: boolean;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  templateKind: TemplateKind;
  onTemplateCommit: (kind: TemplateKind) => void;
}) {
  const desktop = useMediaQuery(EXPAND_MEDIA_QUERY);
  const expanded = expandedFlag && desktop;

  // Opening a folded tile swaps it into the stage at the top of the step, so
  // scroll the stage itself to the top of the view: on a phone the tiles sit
  // well below it, and the shelf as a whole is taller than the screen, which a
  // 'nearest' scroll of the whole shelf treated as already in view.
  const stageRef = useRef<HTMLDivElement>(null);
  const openId = open?.id;
  useEffect(() => {
    // Within the picker's own scroller only: scrollIntoView also scrolled the page, which slid
    // the Quick Start modal up under the header (lib/scroll-within).
    if (userOpened && stageRef.current) scrollToTopWithin(stageRef.current);
  }, [openId, userOpened]);

  // Popular only repeats templates the categories already hold, so it is left
  // out of the "more templates" sum.
  const foldedCount = folded
    .filter((shelf) => shelf.id !== 'popular')
    .reduce((n, shelf) => n + shelf.items.length, 0);

  // What the last layout change revealed, so only that cascades in and the
  // change reads as cards arriving rather than a jump. A toggle flip reveals
  // shelf cards and re-forms the tiles; a tile opening the shelf expanded
  // re-forms only the tiles (the stage has its own shelf-open rise). Never on load.
  const [cascade, setCascade] = useState<'none' | 'flip' | 'tiles'>('none');
  // Picking a category is asking to see it, so it opens expanded on desktop.
  const openShelf = (id: ShelfCategory) => {
    setCascade(expanded || !desktop ? 'none' : 'tiles');
    setExpanded(true);
    onOpenShelf(id);
  };
  // A revealed card's entrance, `order` beats into the cascade. Three cascade
  // steps a card so the rise reads as a sweep; the delay still caps at the
  // cascade cap, inside the motion budget (docs/specs/004-interface-design/motion.md).
  const rise = (order: number, of: 'cards' | 'tiles') =>
    cascade === 'flip' || (cascade === 'tiles' && of === 'tiles')
      ? {
          className: 'animate-card-rise stagger-enter',
          style: { '--stagger-i': order * 3 } as CSSProperties,
        }
      : {};

  const toggle = (
    <ExpandToggle
      expanded={expanded}
      animate={cascade === 'flip'}
      onToggle={() => {
        track('UI', 'Toggled', expanded ? 'TemplateShelfCollapsed' : 'TemplateShelfExpanded');
        setCascade('flip');
        setExpanded(!expanded);
      }}
    />
  );

  const cards = (open?.items ?? []).map((t) => (
    <TemplateCard
      key={t.kind}
      template={t}
      large
      active={templateKind === t.kind}
      onSelect={() => onTemplateCommit(t.kind)}
      onCommit={() => onTemplateCommit(t.kind)}
    />
  ));

  // Both layouts re-form the tiles (a grid into a carousel, or back), so they
  // all cascade in after a flip.
  const tiles = [
    ...folded.map((shelf, i) => (
      <li key={shelf.id} {...rise(i, 'tiles')}>
        <CategoryTile
          label={shelf.label}
          ariaLabel={`Browse ${shelf.label} templates`}
          count={shelf.items.length}
          kinds={fanKinds(shelf)}
          onOpen={() => openShelf(shelf.id)}
        />
      </li>
    )),
  ];

  const moreHeading = (
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      Explore More Categories
    </h3>
  );
  const moreSummary = (
    <p className="text-[11px] text-slate-500 dark:text-slate-400">
      {folded.length} more categories, {foldedCount} more templates
    </p>
  );

  return (
    <div>
      {open ? (
        // The scroll anchor stays still while the stage inside it rises in,
        // so a scroll measured mid-animation lands where the stage settles.
        <div ref={stageRef} className="scroll-mt-4">
          {/* The open shelf sits on its own tinted stage and rises into
              place each time the user opens one (keyed on the shelf), so
              opening a tile below draws the eye back up to what just
              opened. Not on load, where it would fight the modal's
              entrance. */}
          <div
            key={open.id}
            className={`${userOpened ? 'animate-shelf-open ' : ''}rounded-xl border border-brand-100 bg-brand-50/50 p-3 dark:border-brand-500/20 dark:bg-brand-500/5`}
          >
            {expanded ? (
              <>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <ShelfHeading shelf={open} />
                  </div>
                  {/* No arrows to sit beside, so the toggle takes the right edge. */}
                  <div className="shrink-0">{toggle}</div>
                </div>
                <ul className="mt-2 grid grid-cols-3 gap-3">
                  {/* The first row was already on show in the carousel; the
                      rest are what expanding revealed, so they rise in. */}
                  {cards.map((card, i) => {
                    const { className = '', style } = i >= 3 ? rise(i - 3, 'cards') : {};
                    return (
                      <li key={card.key} className={`flex ${className}`} style={style}>
                        {card}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <SnapCarousel
                label={open.label}
                itemsKey={open.id}
                heading={<ShelfHeading shelf={open} />}
                actions={toggle}
                trackClassName="mt-2"
                itemClassName="[&>li]:basis-[calc((100%-0.75rem)/2)] sm:[&>li]:basis-[calc((100%-1.5rem)/3)]"
              >
                {cards.map((card) => (
                  <li key={card.key} className="flex">
                    {card}
                  </li>
                ))}
              </SnapCarousel>
            )}
          </div>
        </div>
      ) : null}

      {expanded ? (
        <SnapCarousel
          className="mt-6"
          label="more"
          itemNoun="categories"
          itemsKey={open?.id ?? 'popular'}
          heading={
            <>
              {moreHeading}
              {moreSummary}
            </>
          }
          trackClassName="mt-2"
          itemClassName="[&>li]:basis-[calc((100%-1.5rem)/3)]"
        >
          {tiles}
        </SnapCarousel>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            {moreHeading}
            {moreSummary}
          </div>
          {/* Three across, so the eight categories and Whiteboard fill three even rows. */}
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{tiles}</ul>
        </>
      )}
    </div>
  );
}

// The open shelf's name, count badge and one-line description.
function ShelfHeading({ shelf }: { shelf: Shelf }): ReactNode {
  return (
    <>
      <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
        {shelf.label}
      </h3>
      {/* The PickerCard count badge: the digit's ink centred in the
          pill (text-optical-centre, optical-alignment.md), and the
          screen-reader word kept outside it so it never skews the
          pill's content box. */}
      <span className="relative top-[0.5px] inline-flex h-3.5 shrink-0 items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-semibold leading-none tabular-nums text-slate-500 dark:bg-slate-700 dark:text-slate-300">
        <span className="text-optical-centre">{shelf.items.length}</span>
      </span>
      <span className="sr-only"> templates</span>
      <span className="hidden truncate text-xs text-slate-500 sm:inline dark:text-slate-400">
        {shelf.description}
      </span>
    </>
  );
}

// Inverts the shelf's flow. Desktop only: hidden below `sm`, where the
// expanded layout never applies either.
// After a flip its new glyph pops in (keyed on the state), echoing the change.
function ExpandToggle({
  expanded,
  animate,
  onToggle,
}: {
  expanded: boolean;
  animate: boolean;
  onToggle: () => void;
}) {
  const label = expanded ? 'Show Fewer Templates' : 'Show All Templates';
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        className="hidden h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-500/60 dark:hover:text-white"
      >
        <span key={String(expanded)} className={`flex ${animate ? 'animate-pop-in' : ''}`}>
          {expanded ? <MinimizeIcon size={16} /> : <MaximizeIcon size={16} />}
        </span>
      </button>
    </Tooltip>
  );
}
