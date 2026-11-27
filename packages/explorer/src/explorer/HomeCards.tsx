'use client';

// Home's rows (HomeTimeline's made and opened rows, HomePane's ranked Most Used and Shared With You Recently): the
// row and its frame, the Offline row, the rank and the day chart's line. One component for every Home section, so a
// row looks and behaves the same wherever Home shows it (its menu, rename and drag); only its line differs (made or
// opened, and where; or the 14-day chart and its opens).

import { SIDEBAR_LABELS } from '../views';
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
import { jumpBackInLine, newLine } from '../data/viewLists';
import { EllipsisTriggerButton, useRowMenu } from '../ui/RowMenu';
import { FOCUS_RING, MUTED, RENAME_INPUT } from '../ui/classes';
import { InlineRenameInput } from '../ui/InlineRenameInput';
import { useItemDrag, useThisBrowserDrag } from '../drag/drag';
import { ItemIcon } from '../ui/icons';
import { useNow } from '../time';
import { AppMark, MadeByAiBadge } from './badges';
import { useExplorer } from './context';
import { ItemMenu } from './menus';
import { useItemBits } from './rows';
import { CARD_NAME, CARD_SURFACE, THUMB_EDGE } from './HomeSection';
import { DayChart } from './DayChart';
import type { ThisBrowserItem } from '../this-browser';
import { LocalPreview, ThisBrowserItemMenu, useThisBrowserItems } from './ThisBrowser';

// A card's line: when it was opened (Most Used, Recent, Shared With You Recently) or when it was made (New).
/** What a card's line says: when it was opened or made (the large cards'), or in a row of Home's (one-explorer.md
 *  "Recent, a timeline" and "Home's rail"): `made-here`/`opened-here` say what happened and where, the timeline's
 *  clock saying when, and `used` draws Most Used's day chart and its opens. */
export type CardLine = 'opened' | 'made' | 'made-here' | 'opened-here' | 'used';

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

const MENU_CHIP =
  '!absolute bg-white/90 shadow-sm ring-1 ring-slate-200 pointer-fine:group-focus-within:opacity-100 dark:bg-slate-900/90 dark:ring-slate-700';

/** One row of Home's timeline or rail (one-explorer.md "Recent, a timeline", "Home's rail"): the card's own menu,
 *  rename and drag, drawn flat. `rank` and `peak` are Most Used's. */
export function HomeRow({
  item,
  showApp,
  line,
  rank,
  peak,
  iconMarks = false,
}: {
  item: ShownItem | ThisBrowserItem;
  showApp: boolean;
  line: CardLine;
  rank?: number;
  peak?: number;
  /** The rail's narrow panels (Most Used, Shared With You Recently): Made by AI as its icon alone. */
  iconMarks?: boolean;
}) {
  return 'app' in item ? (
    <JumpBackInCard
      item={item}
      large={false}
      flat
      showApp={showApp}
      line={line}
      rank={rank}
      peak={peak}
      iconMarks={iconMarks}
    />
  ) : (
    <LocalCard item={item} large={false} flat showApp={showApp} line={line} />
  );
}

/** Most Used's place, before the name: quiet, in tabular figures so the column lines up. */
function RankMark({ rank }: { rank: number }) {
  return (
    <span
      aria-hidden
      className="w-5 shrink-0 text-center text-[13px] font-extrabold tabular-nums text-slate-400 dark:text-slate-500"
    >
      {rank}
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
      {line === 'made-here' || line === 'opened-here'
        ? happenedHere(line, place)
        : now
          ? line === 'made'
            ? newLine(item, now, place)
            : jumpBackInLine(item, now)
          : ''}
    </span>
  );
}

/** A timeline row's line: what happened and where ("Made · Marketing", "Opened · My Work"); its clock says when. */
export function happenedHere(line: 'made-here' | 'opened-here', place: string | null): string {
  const what = line === 'made-here' ? 'Made' : 'Opened';
  return place ? `${what} · ${place}` : what;
}

/** Most Used's line in the rail: the day chart, then how often ("31 opens"). An index that sends no days draws the
 *  count alone. */
function UsedLine({ item, id, peak }: { item: ShownItem; id: string; peak: number }) {
  const opens = item.useOpens ?? item.useDays ?? 0;
  return (
    <span id={id} className={`flex min-w-0 items-center gap-2 text-xs leading-[18px] ${MUTED}`}>
      {item.useHistory ? <DayChart history={item.useHistory} peak={peak} app={item.app} /> : null}
      <span className="truncate tabular-nums">{opens === 1 ? '1 open' : `${opens} opens`}</span>
    </span>
  );
}

/** A picture with a pill on its corner (Offline's, Made by AI), as the editors' panel has it, so the line keeps its
 *  width. */
function Pinned({ pill, children }: { pill: ReactNode; children: ReactNode }) {
  return (
    <span className="relative block h-full w-full">
      {children}
      <span className="absolute left-1.5 top-1.5">{pill}</span>
    </span>
  );
}

// A row in Home's timeline or rail: no frame of its own, the hover wash the sidebar's rows have, tall enough for a
// thumb on a phone.
const FLAT_ROW = `flex min-h-14 min-w-0 items-center gap-3 rounded-[14px] p-2 pr-11 transition duration-micro hover:bg-slate-100 dark:hover:bg-slate-700/50 ${FOCUS_RING}`;

// On a phone a row's name may take two lines rather than cut off after a word or two.
const FLAT_NAME = 'max-sm:line-clamp-2 max-sm:whitespace-normal max-sm:break-words';

const cardClass = (large: boolean, flat = false) =>
  flat
    ? FLAT_ROW
    : `flex min-w-0 ${
        large
          ? 'h-[12.5rem] flex-col gap-2.5 rounded-[18px] p-2 pb-3'
          : 'h-[3.875rem] items-center gap-3 rounded-[14px] p-2 pr-11'
      } ${CARD_SURFACE} ${FOCUS_RING}`;
const nameSize = (large: boolean) => (large ? 'text-[15px] leading-5' : 'text-sm leading-5');

/** One Home card's frame, whoever holds the item: the thumbnail area, the name row (the app's mark under All)
 *  and the line under it, the ⋯ chip, the right-click menu and the drag. The index's cards and Offline's differ
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
  flat = false,
  lead = null,
}: {
  id: string;
  large: boolean;
  /** A row of the timeline's or the rail's (cardClass): `large` is false. */
  flat?: boolean;
  /** Before the thumbnail (Most Used's rank). */
  lead?: ReactNode;
  // The app's mark beside the name (under All), or null.
  app: ShownItem['app'] | null;
  // The picture, or null for a row with none (Most Used's).
  thumb: ReactNode | null;
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
      {lead}
      {thumb === null ? null : (
        <span
          className={`${large ? 'h-32 w-full rounded-xl' : `h-11 shrink-0 rounded-lg ${flat ? 'w-14 sm:w-16' : 'w-16'}`} ${THUMB_EDGE}`}
        >
          {thumb}
        </span>
      )}
      <span className={`flex min-w-0 flex-1 flex-col gap-0.5 ${large ? 'px-1' : ''}`}>
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
        link(cardClass(large, flat), body)
      ) : (
        // While renaming the card doesn't open: the field keeps its focus and its clicks.
        <div className={cardClass(large, flat)}>{body}</div>
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
  flat = false,
  rank,
  peak = 0,
  iconMarks = false,
}: {
  item: ShownItem;
  large: boolean;
  showApp: boolean;
  line: CardLine;
  flat?: boolean;
  iconMarks?: boolean;
  /** Most Used's place in the rail, drawn before the name. */
  rank?: number;
  /** The busiest day across Most Used, which its day charts measure against. */
  peak?: number;
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
      flat={flat}
      lead={rank === undefined ? null : <RankMark rank={rank} />}
      app={showApp ? item.app : null}
      // An AI tool's item says so on its picture's corner, as rows and Details do beside the name.
      thumb={
        line === 'used' ? null : item.source === 'ai' && large ? (
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
          <>
            <span className={`${CARD_NAME} ${nameSize(large)} ${flat ? FLAT_NAME : ''}`}>
              {title}
            </span>
            {/* A row's picture is too small for the pill, so it follows the name. */}
            {flat && item.source === 'ai' ? (
              <span className="flex shrink-0">
                <MadeByAiBadge item={item} iconOnly={iconMarks} />
              </span>
            ) : null}
          </>
        )
      }
      line={
        line === 'used' ? (
          <UsedLine item={item} id={`jbi-${item.id}-u`} peak={peak} />
        ) : (
          <Line
            item={item}
            id={`jbi-${item.id}-${large ? 'l' : 'c'}`}
            large={large}
            line={line}
            place={bits.place?.label ?? null}
          />
        )
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

/** A Home card for an item kept only in this browser: the same card, its thumbnail area Offline's,
 *  its line led by the Offline badge, Offline's menu, and a drag that its targets read as Offline's
 *  (drag.tsx). It opens in the app's editor, by its address. */
const LocalCard = memo(function LocalCard({
  item,
  large,
  showApp,
  line,
  flat = false,
}: {
  item: ThisBrowserItem;
  large: boolean;
  showApp: boolean;
  line: CardLine;
  flat?: boolean;
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
      flat={flat}
      app={showApp ? app : null}
      // The picture says where it lives (a crossed cloud), with no pill on it (owner, 2026-11-17).
      thumb={
        <>
          <LocalPreview app={app} iconSize={large ? 28 : 18} className="h-full w-full" />
          <span className="sr-only" data-this-browser="">
            {SIDEBAR_LABELS.thisBrowser}
          </span>
        </>
      }
      name={<span className={`${CARD_NAME} ${nameSize(large)}`}>{title}</span>}
      line={
        <Line
          item={item}
          id={`jbi-${item.id}-${large ? 'l' : 'c'}`}
          large={large}
          line={line}
          place={line === 'opened-here' || line === 'made-here' ? SIDEBAR_LABELS.thisBrowser : null}
        />
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
