'use client';

// Home (livediagram's HomePane, without What Happened): under the hero, Jump Back In, the person's latest
// opens, as livediagram draws its two groups (four large cards, then four compact ones), and Shared With You
// Recently. The index keeps when each item was last opened, not how often, so the groups are Recent and
// Earlier rather than livediagram's Most Used and Recent. On a phone Jump Back In is one scrolling strip.
// With the hero hidden, Home takes the ordinary page header. Two requests, each one small page.

import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ShownItem } from '../data/overlay';
import { useItemList } from '../data/useItemList';
import { recentLoader, sharedRecentlyLoader } from '../data/viewLists';
import { EllipsisTriggerButton, useRowMenu } from '../ui/RowMenu';
import { FOCUS_RING, MUTED } from '../ui/classes';
import { ChevronRightIcon, ClockIcon, ItemIcon } from '../ui/icons';
import { relativeSince, useNow } from '../time';
import type { ExplorerView } from '../views';
import { AppMark } from './badges';
import { useExplorer } from './context';
import { ItemMenu } from './menus';
import { PaneHeader } from './PaneHeader';

export const HOME_RECENT = 8;
export const HOME_SHARED = 4;
// The large group's size; the rest of Recent is compact.
const LARGE_COUNT = 4;

export const HOME_COPY = {
  jumpBackIn: 'Jump Back In',
  sharedRecently: 'Shared With You Recently',
  seeMore: 'See More',
  seeAll: 'See All',
  recent: 'Recent',
  earlier: 'Earlier',
} as const;

const SECTION_HEADING =
  'text-2xl font-extrabold tracking-[-0.03em] text-[#17153a] dark:text-slate-100';
const SECTION_LINK =
  'inline-flex min-h-6 items-center rounded-sm text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300';
const GROUP_LABEL =
  'mb-2.5 h-4 text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-slate-500 dark:text-slate-400';
const PANEL_SURFACE =
  'border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-800';
const CARD_SURFACE = `${PANEL_SURFACE} transition hover:border-brand-300 hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-brand-300)_25%,transparent),0_18px_36px_-16px_color-mix(in_oklab,var(--color-brand-600)_45%,transparent)] motion-safe:hover:-translate-y-0.5 dark:hover:border-brand-400/60`;
const LARGE_GRID = 'grid grid-cols-2 gap-4 lg:grid-cols-4';
const COMPACT_GRID = 'grid grid-cols-2 gap-2.5 lg:grid-cols-4';
const THUMB_EDGE =
  'flex items-center justify-center overflow-hidden border border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-900';
const SKELETON = 'rounded-md bg-slate-200/70 motion-safe:animate-pulse dark:bg-slate-800';
const EMPTY_SLOT =
  'border border-dashed border-slate-300 bg-white/60 dark:border-slate-600 dark:bg-slate-800/50';
// Readable over a thumbnail: a frosted chip rather than the row button's bare glyph.
const MENU_CHIP =
  '!absolute bg-white/90 shadow-sm ring-1 ring-slate-200 pointer-fine:group-focus-within:opacity-100 dark:bg-slate-900/90 dark:ring-slate-700';

/** Jump Back In's grid from `md` up; below it, the strip. */
const WIDE_QUERY = '(min-width: 768px)';

function useWide(): boolean {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const list = window.matchMedia(WIDE_QUERY);
    const update = () => setWide(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, []);
  return wide;
}

export function HomePane({ onOpenNav, hero }: { onOpenNav?: () => void; hero: boolean }) {
  const { client, app, filter, overlay, epoch, onCreate } = useExplorer();
  const recentLoad = useMemo(
    () => recentLoader(client, app, filter, HOME_RECENT),
    [client, app, filter],
  );
  const sharedLoad = useMemo(
    () => sharedRecentlyLoader(client, app, filter, HOME_SHARED),
    [client, app, filter],
  );
  const recent = useItemList({
    key: `home-recent:${filter}`,
    load: recentLoad,
    overlay,
    belongs: live,
    epoch,
  });
  const shared = useItemList({
    key: `home-shared:${filter}`,
    load: sharedLoad,
    overlay,
    belongs: live,
    epoch,
  });
  const wide = useWide();
  const showApp = filter === 'all';
  const empty = !recent.loading && recent.items.length === 0;

  return (
    <div data-explorer-view="home">
      {/* The hero is Home's page header; with the banner hidden, Home takes the ordinary one. */}
      {hero ? null : (
        <PaneHeader
          title="Home"
          onOpenNav={onOpenNav}
          onCreateItem={() => onCreate({ folderId: null, teamId: null })}
        />
      )}
      <div className="flex flex-col gap-10">
        <HomeSection
          id="jump-back-in"
          title={HOME_COPY.jumpBackIn}
          busy={recent.loading}
          link={
            wide && !recent.loading && !empty
              ? { view: { kind: 'recent' }, label: HOME_COPY.seeMore }
              : undefined
          }
        >
          {!wide ? (
            recent.loading ? (
              <StripSkeleton />
            ) : (
              <Strip items={recent.items} empty={empty} />
            )
          ) : recent.loading ? (
            <GridSkeleton />
          ) : empty ? (
            <div className={LARGE_GRID}>
              <div
                className={`flex h-[12.5rem] flex-col items-center justify-center gap-2 rounded-[18px] px-4 text-center ${EMPTY_SLOT}`}
              >
                <span className="text-slate-400 [&_svg]:h-6 [&_svg]:w-6">
                  <ClockIcon />
                </span>
                <EmptyWords />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <CardGroup
                label={HOME_COPY.recent}
                items={recent.items.slice(0, LARGE_COUNT)}
                large
                showApp={showApp}
              />
              <CardGroup
                label={HOME_COPY.earlier}
                items={recent.items.slice(LARGE_COUNT)}
                large={false}
                showApp={showApp}
              />
            </div>
          )}
        </HomeSection>
        {shared.items.length > 0 ? (
          <HomeSection
            id="shared-recently"
            title={HOME_COPY.sharedRecently}
            busy={false}
            link={{ view: { kind: 'shared' }, label: HOME_COPY.seeAll }}
          >
            <CardGroup items={shared.items} large showApp={showApp} />
          </HomeSection>
        ) : null}
      </div>
    </div>
  );
}

const live = (i: ShownItem) => i.trashedAt === null;

function EmptyWords() {
  const { kind } = useExplorer();
  return (
    <>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        No {kind.lowerMany} yet
      </span>
      <span className={`text-xs ${MUTED}`}>The {kind.lowerMany} you open will gather here.</span>
    </>
  );
}

function HomeSection({
  id,
  title,
  link,
  busy,
  children,
}: {
  id: string;
  title: string;
  link?: { view: ExplorerView; label: string };
  busy: boolean;
  children: ReactNode;
}) {
  const { viewHref, navigate } = useExplorer();
  const headingId = `home-${id}`;
  return (
    <section aria-labelledby={headingId} aria-busy={busy} data-home-section={id}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id={headingId} className={SECTION_HEADING}>
          {title}
        </h2>
        {link ? (
          <a
            href={viewHref(link.view)}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              navigate(link.view);
            }}
            className={`${SECTION_LINK} ${FOCUS_RING}`}
          >
            {link.label}
          </a>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** One labelled group of cards; a group with nothing draws nothing, label included. */
function CardGroup({
  label,
  items,
  large,
  showApp,
}: {
  label?: string;
  items: ShownItem[];
  large: boolean;
  showApp: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div data-jump-back-in-group={large ? 'large' : 'compact'}>
      {label ? <h3 className={GROUP_LABEL}>{label}</h3> : null}
      <ul className={large ? LARGE_GRID : COMPACT_GRID}>
        {items.map((item) => (
          <li key={item.id} className="min-w-0">
            <JumpBackInCard item={item} large={large} showApp={showApp} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Thumb({ item, className }: { item: ShownItem; className: string }) {
  const { renderThumbnail } = useExplorer();
  return (
    <span className={`${className} ${THUMB_EDGE}`}>
      {renderThumbnail?.(item, 'card') ?? (
        <span className="text-slate-300 dark:text-slate-600 [&_svg]:h-7 [&_svg]:w-7">
          <ItemIcon />
        </span>
      )}
    </span>
  );
}

/** "Opened 2 hours ago": when the person last opened it, or else last changed it. */
function OpenedLine({ item, id, large }: { item: ShownItem; id: string; large: boolean }) {
  const now = useNow();
  const at = item.lastOpenedAt ?? item.updatedAt;
  return (
    <span
      id={id}
      className={`block truncate leading-[18px] ${large ? 'text-[12.5px]' : 'text-xs'} ${MUTED}`}
    >
      {now ? `${item.lastOpenedAt ? 'Opened' : 'Changed'} ${relativeSince(at, now)}` : ''}
    </span>
  );
}

const JumpBackInCard = memo(function JumpBackInCard({
  item,
  large,
  showApp,
}: {
  item: ShownItem;
  large: boolean;
  showApp: boolean;
}) {
  const { Link, itemHref } = useExplorer();
  const menu = useRowMenu();
  const title = item.title || 'Untitled';
  const lineId = `jbi-${item.id}-${large ? 'l' : 'c'}`;
  return (
    <div
      data-item-card={item.id}
      className="group relative min-w-0"
      onContextMenu={menu.onContextMenu}
    >
      <Link
        href={itemHref(item)}
        aria-label={title}
        className={`flex min-w-0 ${
          large
            ? 'h-[12.5rem] flex-col gap-2.5 rounded-[18px] p-2 pb-3'
            : 'h-[3.875rem] items-center gap-3 rounded-[14px] p-2 pr-11'
        } ${CARD_SURFACE} ${FOCUS_RING}`}
      >
        <Thumb
          item={item}
          className={large ? 'h-32 w-full rounded-xl' : 'h-11 w-16 shrink-0 rounded-lg'}
        />
        <span className={`flex min-w-0 flex-col gap-0.5 ${large ? 'px-1' : ''}`}>
          <span className="flex min-w-0 items-center gap-1.5">
            {showApp ? <AppMark app={item.app} size={14} /> : null}
            <span
              className={`block truncate font-semibold text-[#17153a] dark:text-slate-100 ${
                large ? 'text-[15px] leading-5' : 'text-sm leading-5'
              }`}
            >
              {title}
            </span>
          </span>
          <OpenedLine item={item} id={lineId} large={large} />
        </span>
      </Link>
      <EllipsisTriggerButton
        {...menu.triggerProps}
        reveal
        size="md"
        label={`Menu for ${title}`}
        className={`${MENU_CHIP} ${large ? 'right-3.5 top-3.5' : 'right-2.5 top-1/2 -translate-y-1/2'}`}
      />
      {menu.open ? (
        <ItemMenu item={item} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </div>
  );
});

/** A phone's Jump Back In: one strip of small tiles, then See More. */
function Strip({ items, empty }: { items: ShownItem[]; empty: boolean }) {
  const { Link, itemHref, viewHref, navigate } = useExplorer();
  return (
    <div className="relative -mx-4 sm:mx-0">
      <div className="flex h-28 snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:-mx-1 sm:scroll-px-1 sm:px-1">
        {empty ? (
          <div className="flex w-48 shrink-0 flex-col justify-center gap-1">
            <EmptyWords />
          </div>
        ) : (
          <>
            <ul className="flex shrink-0 gap-3">
              {items.map((item) => (
                <li key={item.id} className="w-32 shrink-0 snap-start">
                  <Link
                    href={itemHref(item)}
                    aria-label={item.title || 'Untitled'}
                    className={`group block min-w-0 rounded-md ${FOCUS_RING}`}
                  >
                    <Thumb item={item} className="h-20 w-32 rounded-md" />
                    <span className="mt-1 block h-4 truncate text-xs leading-4 text-slate-700 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-slate-100">
                      {item.title || 'Untitled'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <a
              href={viewHref({ kind: 'recent' })}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                navigate({ kind: 'recent' });
              }}
              className={`group block shrink-0 snap-start rounded-md ${FOCUS_RING}`}
            >
              <span className="flex h-20 w-32 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 text-xs font-medium text-brand-700 transition group-hover:border-slate-400 group-hover:bg-slate-100 dark:border-slate-600 dark:text-brand-300 dark:group-hover:border-slate-500 dark:group-hover:bg-slate-800/70">
                <ChevronRightIcon size={16} />
                {HOME_COPY.seeMore}
              </span>
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div>
        <div className={`mb-2.5 h-4 w-20 ${SKELETON}`} />
        <div className={LARGE_GRID}>
          {Array.from({ length: LARGE_COUNT }, (_, i) => (
            <div key={i} className={`h-[12.5rem] rounded-[18px] ${SKELETON}`} />
          ))}
        </div>
      </div>
      <div>
        <div className={`mb-2.5 h-4 w-16 ${SKELETON}`} />
        <div className={COMPACT_GRID}>
          {Array.from({ length: LARGE_COUNT }, (_, i) => (
            <div key={i} className={`h-[3.875rem] rounded-[14px] ${SKELETON}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StripSkeleton() {
  return (
    <div aria-hidden className="-mx-1 flex h-28 gap-3 overflow-hidden px-1 pb-2 pt-1">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="w-32 shrink-0">
          <div className={`h-20 w-32 ${SKELETON}`} />
          <div className="mt-1 h-4 py-0.5">
            <div className={`h-3 w-3/4 ${SKELETON}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
