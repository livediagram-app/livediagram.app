'use client';

// Home's cards (HomePane's Most Used, Recent and Shared With You Recently, HomeNew's New): the large card and its
// frame, the This Browser card, a group of them, the phone's strip and the placeholders they load behind. One
// component for every Home section, so a card looks and behaves the same wherever Home shows it; only its line
// differs (when it was opened, or when it was made).

import {
  createContext,
  memo,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ShownItem } from '../data/overlay';
import { JUMP_BACK_IN_PER_GROUP, jumpBackInLine, newLine } from '../data/viewLists';
import { EllipsisTriggerButton, useRowMenu } from '../ui/RowMenu';
import { FOCUS_RING, MUTED, RENAME_INPUT, SKELETON } from '../ui/classes';
import { InlineRenameInput } from '../ui/InlineRenameInput';
import { useItemDrag, useThisBrowserDrag } from '../drag/drag';
import { ChevronRightIcon, ItemIcon } from '../ui/icons';
import { useNow } from '../time';
import { AppMark, MadeByAiBadge } from './badges';
import { useExplorer } from './context';
import { ItemMenu } from './menus';
import { useItemBits } from './rows';
import { CARD_NAME, CARD_SURFACE, THUMB_EDGE } from './HomeSection';
import type { ThisBrowserItem } from '../this-browser';
import {
  LocalPreview,
  ThisBrowserItemMenu,
  ThisBrowserPill,
  useThisBrowserItems,
} from './ThisBrowser';

// A card's line: when it was opened (Most Used, Recent, Shared With You Recently) or when it was made (New).
export type CardLine = 'opened' | 'made';

// New and Most Used or Recent can show the same item, so a rename is drawn in the card whose menu started it: the
// kind of line it carries says which section that was (Most Used, Recent and Shared With You Recently never share an
// item). With no menu opened on Home, every card of the item takes it, as before.
type RenameFrom = { from: CardLine | null; setFrom: (line: CardLine) => void };
const RenameFromContext = createContext<RenameFrom>({ from: null, setFrom: () => {} });

/** Home's cards' rename place, around every section that draws them. */
export function HomeCardsProvider({ children }: { children: ReactNode }) {
  const [from, setFrom] = useState<CardLine | null>(null);
  const value = useMemo(() => ({ from, setFrom }), [from]);
  return <RenameFromContext.Provider value={value}>{children}</RenameFromContext.Provider>;
}

export const LARGE_GRID = 'grid grid-cols-2 gap-4 lg:grid-cols-4';
const COMPACT_GRID = 'grid grid-cols-2 gap-2.5 lg:grid-cols-4';
// Readable over a thumbnail: a frosted chip rather than the row button's bare glyph.
const MENU_CHIP =
  '!absolute bg-white/90 shadow-sm ring-1 ring-slate-200 pointer-fine:group-focus-within:opacity-100 dark:bg-slate-900/90 dark:ring-slate-700';

/** One section's cards; a group with nothing draws nothing. */
export function CardGroup({
  items,
  large,
  showApp,
  line = 'opened',
}: {
  items: readonly (ShownItem | ThisBrowserItem)[];
  large: boolean;
  showApp: boolean;
  line?: CardLine;
}) {
  if (items.length === 0) return null;
  return (
    <div data-card-group={large ? 'large' : 'compact'}>
      <ul className={large ? LARGE_GRID : COMPACT_GRID}>
        {items.map((item) => (
          <li key={item.id} className="min-w-0">
            {'app' in item ? (
              <JumpBackInCard item={item} large={large} showApp={showApp} line={line} />
            ) : (
              <LocalCard item={item} large={large} showApp={showApp} line={line} />
            )}
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

/** The quiet line under a card's name: "Opened 2 hours ago", or for New "Made 2 hours ago · Marketing" (`place`,
 *  where it lives). */
function Line({
  item,
  id,
  large,
  line,
  place = null,
}: {
  item: Parameters<typeof jumpBackInLine>[0] & { createdAt: number };
  id: string;
  large: boolean;
  line: CardLine;
  place?: string | null;
}) {
  const now = useNow();
  return (
    <span
      id={id}
      className={`block min-w-0 truncate leading-[18px] ${large ? 'text-[12.5px]' : 'text-xs'} ${MUTED}`}
    >
      {now ? (line === 'made' ? newLine(item, now, place) : jumpBackInLine(item, now)) : ''}
    </span>
  );
}

/** A picture with a pill on its corner (This Browser's, Made by AI), as the editors' panel has it, so the line keeps its
 *  width. */
function Pinned({ pill, children }: { pill: ReactNode; children: ReactNode }) {
  return (
    <span className="relative block h-full w-full">
      {children}
      <span className="absolute left-1.5 top-1.5">{pill}</span>
    </span>
  );
}

const cardClass = (large: boolean) =>
  `flex min-w-0 ${
    large
      ? 'h-[12.5rem] flex-col gap-2.5 rounded-[18px] p-2 pb-3'
      : 'h-[3.875rem] items-center gap-3 rounded-[14px] p-2 pr-11'
  } ${CARD_SURFACE} ${FOCUS_RING}`;
const nameSize = (large: boolean) => (large ? 'text-[15px] leading-5' : 'text-sm leading-5');

/** One Home card's frame, whoever holds the item: the thumbnail area, the name row (the app's mark under All)
 *  and the line under it, the ⋯ chip, the right-click menu and the drag. The index's cards and This Browser's differ
 *  only in what fills it. */
function CardFrame({
  id,
  large,
  app,
  thumb,
  name,
  line,
  link,
  menu,
  menuLabel,
  renderMenu,
  drag,
  attrs,
}: {
  id: string;
  large: boolean;
  // The app's mark beside the name (under All), or null.
  app: ShownItem['app'] | null;
  thumb: ReactNode;
  name: ReactNode;
  line: ReactNode;
  // The card as a link, or null while it can't open (renaming).
  link: ((className: string, body: ReactNode) => ReactNode) | null;
  menu: ReturnType<typeof useRowMenu>;
  menuLabel: string;
  renderMenu: (anchor: HTMLElement | null, onClose: () => void) => ReactNode;
  drag: ReturnType<typeof useItemDrag>;
  attrs?: Record<string, string>;
}) {
  const body = (
    <>
      <span
        className={`${large ? 'h-32 w-full rounded-xl' : 'h-11 w-16 shrink-0 rounded-lg'} ${THUMB_EDGE}`}
      >
        {thumb}
      </span>
      <span className={`flex min-w-0 flex-col gap-0.5 ${large ? 'px-1' : ''}`}>
        <span className="flex min-w-0 items-center gap-1.5">
          {app ? <AppMark app={app} size={14} /> : null}
          {name}
        </span>
        {line}
      </span>
    </>
  );
  return (
    <div
      data-item-card={id}
      {...attrs}
      className="group relative min-w-0"
      onContextMenu={menu.onContextMenu}
      {...drag}
    >
      {link ? (
        link(cardClass(large), body)
      ) : (
        // While renaming the card doesn't open: the field keeps its focus and its clicks.
        <div className={cardClass(large)}>{body}</div>
      )}
      {link ? (
        <EllipsisTriggerButton
          {...menu.triggerProps}
          reveal
          size="md"
          label={menuLabel}
          className={`${MENU_CHIP} ${large ? 'right-3.5 top-3.5' : 'right-2.5 top-1/2 -translate-y-1/2'}`}
        />
      ) : null}
      {menu.open ? renderMenu(menu.triggerRef.current, menu.close) : null}
    </div>
  );
}

const JumpBackInCard = memo(function JumpBackInCard({
  item,
  large,
  showApp,
  line,
}: {
  item: ShownItem;
  large: boolean;
  showApp: boolean;
  line: CardLine;
}) {
  const { Link, renamingId, renderThumbnail } = useExplorer();
  const bits = useItemBits(item);
  const rename = useContext(RenameFromContext);
  const renaming = renamingId === item.id && (rename.from === null || rename.from === line);
  const menu = useRowMenu({ disabled: renaming });
  const { setFrom } = rename;
  useEffect(() => {
    if (menu.open) setFrom(line);
  }, [menu.open, setFrom, line]);
  const drag = useItemDrag(item, renaming);
  const title = item.title || 'Untitled';
  const picture = renderThumbnail?.(item, 'card') ?? (
    <span className="text-slate-300 dark:text-slate-600 [&_svg]:h-7 [&_svg]:w-7">
      <ItemIcon />
    </span>
  );
  return (
    <CardFrame
      id={item.id}
      large={large}
      app={showApp ? item.app : null}
      // An AI tool's item says so on its picture's corner, as rows and Details do beside the name.
      thumb={
        item.source === 'ai' && large ? (
          <Pinned pill={<MadeByAiBadge item={item} />}>
            <span className="flex h-full w-full items-center justify-center">{picture}</span>
          </Pinned>
        ) : (
          picture
        )
      }
      name={
        renaming ? (
          <InlineRenameInput
            initial={item.title}
            ariaLabel={`Rename ${title}`}
            onCommit={bits.commitRename}
            onCancel={bits.cancelRename}
            className={`min-w-0 flex-1 ${RENAME_INPUT} ${nameSize(large)}`}
          />
        ) : (
          <span className={`${CARD_NAME} ${nameSize(large)}`}>{title}</span>
        )
      }
      line={
        <Line
          item={item}
          id={`jbi-${item.id}-${large ? 'l' : 'c'}`}
          large={large}
          line={line}
          place={bits.place?.label ?? null}
        />
      }
      link={
        renaming
          ? null
          : (className, body) => (
              <Link href={bits.href} aria-label={title} className={className}>
                {body}
              </Link>
            )
      }
      menu={menu}
      menuLabel={`Menu for ${title}`}
      renderMenu={(anchor, onClose) => <ItemMenu item={item} anchor={anchor} onClose={onClose} />}
      drag={drag}
    />
  );
});

/** A Home card for an item kept only in this browser: the same card, its thumbnail area This Browser's,
 *  its line led by the This Browser badge, This Browser's menu, and a drag that its targets read as This Browser's
 *  (drag.tsx). It opens in the app's editor, by its address. */
const LocalCard = memo(function LocalCard({
  item,
  large,
  showApp,
  line,
}: {
  item: ThisBrowserItem;
  large: boolean;
  showApp: boolean;
  line: CardLine;
}) {
  const { app } = useExplorer();
  const { host } = useThisBrowserItems();
  const menu = useRowMenu();
  const drag = useThisBrowserDrag(item);
  const title = item.title || 'Untitled';
  return (
    <CardFrame
      id={item.id}
      attrs={{ 'data-this-browser-card': '' }}
      large={large}
      app={showApp ? app : null}
      // The pill on the picture's corner, as the editors' panel has it, so the line keeps its width.
      thumb={
        <Pinned pill={<ThisBrowserPill inLink />}>
          <LocalPreview app={app} iconSize={large ? 28 : 18} className="h-full w-full" />
        </Pinned>
      }
      name={<span className={`${CARD_NAME} ${nameSize(large)}`}>{title}</span>}
      line={
        <Line item={item} id={`jbi-${item.id}-${large ? 'l' : 'c'}`} large={large} line={line} />
      }
      link={(className, body) => (
        <a href={host?.itemHref(item)} aria-label={title} className={className}>
          {body}
        </a>
      )}
      menu={menu}
      menuLabel={`Menu for ${title}`}
      renderMenu={(anchor, onClose) => (
        <ThisBrowserItemMenu item={item} anchor={anchor} onClose={onClose} />
      )}
      drag={drag}
    />
  );
});

/** A phone's Home section (Most Used, Recent or New): one strip of at most `max` small tiles (the index's first, then
 *  this browser's), then, with `seeMore` (Recent's), its tile into the Recent view. */
export function Strip({
  items: all,
  local: allLocal,
  max,
  seeMore,
}: {
  items: readonly ShownItem[];
  local: readonly ThisBrowserItem[];
  max: number;
  seeMore?: string;
}) {
  const { app, Link, itemHref, viewHref, navigate } = useExplorer();
  const { host } = useThisBrowserItems();
  const items = all.slice(0, max);
  const local = allLocal.slice(0, max - items.length);
  return (
    <div className="relative -mx-4 sm:mx-0">
      <div className="flex h-28 snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:-mx-1 sm:scroll-px-1 sm:px-1">
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
          {local.map((item) => (
            <li key={item.id} className="w-32 shrink-0 snap-start" data-this-browser-card="">
              <a
                href={host?.itemHref(item)}
                aria-label={item.title || 'Untitled'}
                className={`group block min-w-0 rounded-md ${FOCUS_RING}`}
              >
                <LocalPreview app={app} iconSize={20} className="h-20 w-32 rounded-md" />
                <span className="mt-1 block h-4 truncate text-xs leading-4 text-slate-700 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-slate-100">
                  {item.title || 'Untitled'}
                </span>
              </a>
            </li>
          ))}
        </ul>
        {seeMore ? (
          <a
            href={viewHref({ kind: 'recent' })}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              navigate({ kind: 'recent' });
            }}
            className={`group block shrink-0 snap-start rounded-md ${FOCUS_RING}`}
            data-see-link=""
          >
            <span className="flex h-20 w-32 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 text-xs font-medium text-brand-700 transition group-hover:border-slate-400 group-hover:bg-slate-100 dark:border-slate-600 dark:text-brand-300 dark:group-hover:border-slate-500 dark:group-hover:bg-slate-800/70">
              <ChevronRightIcon size={16} />
              {seeMore}
            </span>
          </a>
        ) : null}
      </div>
    </div>
  );
}

/** A section's large cards as they load, under its own heading: `cards` of them (a full group on a desktop: Most
 *  Used's or Recent's eight, New's four). */
export function GridSkeleton({ cards = JUMP_BACK_IN_PER_GROUP }: { cards?: number }) {
  return (
    <div aria-hidden className={LARGE_GRID}>
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className={`h-[12.5rem] rounded-[18px] ${SKELETON}`} />
      ))}
    </div>
  );
}

export function StripSkeleton() {
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
