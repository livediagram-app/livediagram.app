'use client';

// The pieces of Pages mode's Contents (docs/specs/007-editor/pages-mode.md "Contents"), laid
// out by its two homes: the popover (PageContentsPanel) and the docked sidebar
// (PageContentsSidebar). The state behind them is hooks/ui/usePageContents.
import { sanitizedHtml } from '@liveworkspace/trusted-types/sanitize';
import {
  Fragment,
  memo,
  useId,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { lucideGripVertical, lucideLock } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';
import { htmlProps } from '@liveworkspace/trusted-types';
import { DropCaret } from '../primitives/DropCaret';
import { ContentsVeil, veiledPictureClass } from './ContentsVeil';
import {
  PageRowMenu,
  PageRowMenuButton,
  PageRowStack,
  rowToolsReveal,
  usePageRowMenu,
  type PageRowMenuHandle,
  type PageRowModel,
} from './PageRowMenu';
import { useStableCallbacks } from '../../hooks/ui/useStableCallbacks';
import type { ContentsRowBase, ContentsThumb, ContentsThumbPart } from '../../lib/page-contents';
import type { PageContents } from '../../hooks/ui/usePageContents';

const LockIcon = lucideGlyph(lucideLock, 12);
const GripIcon = lucideGlyph(lucideGripVertical, 14);

// The popover's rows: a thumbnail this tall, its width following the page's shape, up to LIST_MAX_W.
const LIST_THUMB_H = 52;
const LIST_MAX_W = 92;
// The sidebar's filmstrip: a picture as wide as the column, up to this tall (a portrait page).
const FILM_MAX_W = 172;
const FILM_MAX_H = 124;

/** Contents' state as the list reads it: none of it depends on the editor's page or Add Page types. */
export type ContentsListState<R extends ContentsRowBase> = Pick<
  PageContents<R, { id: string }, never>,
  | 'pages'
  | 'rows'
  | 'current'
  | 'list'
  | 'registerRow'
  | 'reorder'
  | 'reorderable'
  | 'go'
  | 'onListKey'
  | 'thumbs'
  | 'actionsFor'
>;

/** A row's marks of the editor's own, after its name and before the padlock (livedocuments' speaking
 *  time). */
export type ContentsBadges<R extends ContentsRowBase> = (row: R) => ReactNode;

// The rows: `list` in the popover (number, small thumbnail, name side by side), `film` in the
// sidebar (a filmstrip, as a slide editor shows its slides: the number beside a picture as wide as
// the column, the name under it). An Editor's page actions sit down the row's left: in the
// filmstrip the grip, Delete and ⋯ stacked under the number, in the popover's compact rows the ⋯
// under the number (the grip at the row's end). One ⋯ menu serves the whole list. In both, the grip
// and ⋯ show and hide together by one rule (rowToolsReveal): on hover or focus under a mouse or pen,
// always to a finger, whatever the window's width.
//
// Each row is a memoised ContentsRow (Work Tracker 945): a typing commit, a picture's settle and a menu opening
// render the rows whose page changed, not all of them. The row takes its page's fields (compared one by one, so an
// editor needn't keep row objects stable), whether it is here, its picture and the list's presses, each the same
// function for the list's life (useStableCallbacks) calling through to the newest state.
export function ContentsList<R extends ContentsRowBase>({
  contents,
  variant,
  badges,
  className = '',
  style,
}: {
  contents: ContentsListState<R>;
  variant: 'list' | 'film';
  badges?: ContentsBadges<R> | undefined;
  className?: string;
  style?: CSSProperties;
}) {
  const {
    rows,
    current,
    list,
    registerRow,
    reorder,
    reorderable,
    go,
    onListKey,
    thumbs,
    actionsFor,
  } = contents;
  const menu = usePageRowMenu();
  // A set-aside row's reason, read as its button's description.
  const uid = useId();
  const rowOf = (id: string) => rows.find((r) => r.id === id);
  // A row's page actions: an Editor's (actionsFor answers null for a Participant and a Viewer).
  const actionsOf = (id: string) => {
    const row = rowOf(id);
    return row ? actionsFor(row) : null;
  };
  const on = useStableCallbacks<RowPresses>({
    go: (id, at) => {
      const row = rowOf(id);
      if (row) go(row, at);
    },
    register: registerRow,
    // A mouse or pen drags the whole row; a finger drags its grip, so the list still scrolls, and a finger held
    // still opens the page's menu.
    press: (id, e) => {
      if (actionsOf(id)) menu.rowProps(id).onPointerDown(e);
      if (e.pointerType !== 'touch') reorder.beginDrag(e, id);
    },
    contextMenu: (id, e) => {
      if (actionsOf(id)) menu.rowProps(id).onContextMenu(e);
    },
    grip: (id, e) => {
      if (e.pointerType === 'touch') reorder.beginDrag(e, id);
    },
    move: (e) => reorder.moveDrag(e),
    end: (e) => reorder.endDrag(e),
    remove: (id) => actionsOf(id)?.remove?.(),
    registerTrigger: (id, el) => menu.registerTrigger(id, el),
    toggle: (id) => menu.toggle(id),
  });
  // The open menu's page, read afresh each render so its verbs follow the page (locked, moved).
  const menuRow = menu.openId ? rowOf(menu.openId) : undefined;
  const menuModel = menuRow ? actionsFor(menuRow) : null;
  return (
    <>
      <div
        ref={list}
        role="list"
        aria-label="Pages"
        onKeyDown={onListKey}
        className={`flex min-h-0 flex-col overflow-y-auto ${className}`}
        style={style}
      >
        {rows.map((row, i) => (
          <Fragment key={row.id}>
            {reorder.caretBefore(i) ? <DropCaret /> : null}
            <ContentsRow
              row={row}
              index={i}
              variant={variant}
              here={row.id === current}
              thumb={thumbs.get(row.id)}
              badges={badges}
              reorderable={reorderable}
              dragging={reorder.moving && reorder.draggingId === row.id}
              menuOpen={menu.openId === row.id}
              uid={uid}
              actionsFor={actionsFor}
              on={on}
            />
          </Fragment>
        ))}
        {reorder.caretAfterLast ? <DropCaret /> : null}
      </div>
      {menuRow && menuModel ? (
        <PageRowMenu
          title={menuRow.name}
          model={menuModel}
          anchor={menu.anchor}
          onClose={menu.close}
        />
      ) : null}
    </>
  );
}

// A row's presses, by its page's id: the same functions for the list's life.
type RowPresses = {
  go: (id: string, at: number) => void;
  register: (id: string, el: HTMLElement | null) => void;
  press: (id: string, e: ReactPointerEvent) => void;
  contextMenu: (id: string, e: ReactMouseEvent) => void;
  grip: (id: string, e: ReactPointerEvent) => void;
  move: (e: ReactPointerEvent) => void;
  end: (e: ReactPointerEvent) => void;
  remove: (id: string) => void;
  registerTrigger: (id: string, el: HTMLElement | null) => void;
  toggle: (id: string) => void;
};

type ContentsRowProps<R extends ContentsRowBase> = {
  row: R;
  // Its place in the list, the drop slot a drag reads.
  index: number;
  variant: 'list' | 'film';
  here: boolean;
  thumb: ContentsThumb | undefined;
  badges: ContentsBadges<R> | undefined;
  reorderable: boolean;
  // Being dragged: it fades.
  dragging: boolean;
  // Its ⋯ menu is open: its tools stay shown.
  menuOpen: boolean;
  uid: string;
  // The page's actions, worked out by the row as it renders. New on every render of the list, so it is not compared:
  // what the row draws from it (whether it has tools, whether Delete) follows the role, which `reorderable` follows
  // (an Editor's pages move), and the page's lock, a row field. Its presses run the newest through `on`.
  actionsFor: (row: R) => PageRowModel | null;
  on: RowPresses;
};

/** The same row: every field of the page's equal (Object.is), so a row rebuilt equal is the same row. */
export function sameRow(a: ContentsRowBase, b: ContentsRowBase): boolean {
  if (a === b) return true;
  const ka = Object.keys(a) as (keyof ContentsRowBase)[];
  return ka.length === Object.keys(b).length && ka.every((k) => Object.is(a[k], b[k]));
}

function sameRowProps<R extends ContentsRowBase>(
  a: ContentsRowProps<R>,
  b: ContentsRowProps<R>,
): boolean {
  return (
    a.index === b.index &&
    a.variant === b.variant &&
    a.here === b.here &&
    a.thumb === b.thumb &&
    a.badges === b.badges &&
    a.reorderable === b.reorderable &&
    a.dragging === b.dragging &&
    a.menuOpen === b.menuOpen &&
    a.uid === b.uid &&
    a.on === b.on &&
    sameRow(a.row, b.row)
  );
}

const ContentsRow = memo(function ContentsRow<R extends ContentsRowBase>({
  row,
  index,
  variant,
  here,
  thumb,
  badges,
  reorderable,
  dragging,
  menuOpen,
  uid,
  actionsFor,
  on,
}: ContentsRowProps<R>) {
  const id = row.id;
  const actions = actionsFor(row);
  const asideId = row.setAside ? `${uid}-aside-${id}` : undefined;
  const Row = variant === 'film' ? FilmRow : ListRow;
  // The menu as the row's ⋯ reads it: open on this page or not, and the list's one menu behind it.
  const menu: PageRowMenuHandle = {
    openId: menuOpen ? id : undefined,
    registerTrigger: on.registerTrigger,
    toggle: on.toggle,
  };
  // The popover's grip and ⋯ (apart, at the row's two ends) wear the same reveal; in the
  // filmstrip the grip is the top of the row's stack, which wears it for all three.
  const listReveal = variant === 'list' ? rowToolsReveal(menuOpen) : '';
  const grip = reorderable ? (
    <span
      aria-hidden
      data-contents-grip=""
      onPointerDown={(e) => on.grip(id, e)}
      className={`relative z-10 flex w-5 shrink-0 cursor-grab touch-none items-center justify-center text-slate-400 transition ${
        variant === 'film' ? 'h-6' : 'h-8'
      } ${listReveal}`}
    >
      <GripIcon />
    </span>
  ) : null;
  return (
    <div
      role="listitem"
      data-contents-slot={index}
      onClick={(e) => on.go(id, e.timeStamp)}
      onContextMenu={(e) => on.contextMenu(id, e)}
      onPointerDown={(e) => on.press(id, e)}
      onPointerMove={on.move}
      onPointerUp={on.end}
      onPointerCancel={on.end}
      // The row wears its button's keyboard focus: the button lies under the row's own content.
      className={`group relative flex w-full cursor-pointer select-none text-left transition [-webkit-touch-callout:none] has-[>button:focus-visible]:outline-2 has-[>button:focus-visible]:outline-brand-600 ${
        dragging ? 'opacity-50' : ''
      } ${variant === 'film' ? FILM_ROW_CLASS(here) : LIST_ROW_CLASS(here)}`}
    >
      {/* The row opens through one button stretched across it; its tools and grip sit above that button as
          controls of their own. An option holding them was a control nested in a control (docs/specs/007-editor/pages-mode.md). */}
      <button
        ref={(el) => on.register(id, el)}
        type="button"
        aria-label={row.name}
        aria-describedby={asideId}
        aria-current={here ? 'page' : undefined}
        data-page-row={id}
        onClick={(e) => {
          e.stopPropagation();
          on.go(id, e.timeStamp);
        }}
        className="absolute inset-0 z-0 cursor-pointer rounded-[inherit] outline-none"
      />
      {asideId ? (
        <span id={asideId} className="sr-only">
          {row.setAside}
        </span>
      ) : null}
      <Row
        row={row}
        here={here}
        thumb={thumb}
        badges={badges?.(row)}
        tools={
          variant === 'film' ? (
            actions ? (
              <PageRowStack
                id={id}
                name={row.name}
                menu={menu}
                grip={grip}
                shown={here}
                {...(actions.remove ? { remove: () => on.remove(id) } : {})}
              />
            ) : null
          ) : actions ? (
            <span
              data-contents-row-menu=""
              className={`relative z-10 flex transition-opacity duration-micro ${listReveal}`}
            >
              <PageRowMenuButton id={id} name={row.name} menu={menu} />
            </span>
          ) : null
        }
        grip={variant === 'list' ? grip : null}
      />
    </div>
  );
}, sameRowProps) as <R extends ContentsRowBase>(props: ContentsRowProps<R>) => ReactNode;

const LIST_ROW_CLASS = (here: boolean) =>
  `items-center gap-3 rounded-xl px-2 py-1.5 ${
    here ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
  }`;
const FILM_ROW_CLASS = (here: boolean) =>
  `items-start gap-1.5 rounded-xl py-2 pl-1 pr-2 ${
    here
      ? 'bg-brand-50/80 dark:bg-brand-500/10'
      : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
  }`;

type RowProps = {
  row: ContentsRowBase;
  here: boolean;
  thumb: ContentsThumb | undefined;
  // The editor's own marks after the name.
  badges: ReactNode;
  // The page's tools down the row's left (an Editor's), under its number.
  tools: ReactNode;
  // The popover's grip, at the row's end.
  grip: ReactNode;
};

// A set-aside page (setAside) greys under its veil and trades the sheet's solid edge for a dashed one;
// the page here keeps its brand ring over that.
function Picture({
  thumb,
  w,
  h,
  here,
  large,
  aside = false,
}: {
  thumb: ContentsThumb | undefined;
  w: number;
  h: number;
  here: boolean;
  large?: boolean;
  aside?: boolean;
}) {
  return (
    <span
      data-contents-picture=""
      className={`relative block overflow-hidden transition ${
        aside ? 'bg-slate-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-800'
      } ${large ? 'rounded-lg' : 'rounded-md'} ${
        here
          ? `ring-brand-500 ${large ? 'shadow-md ring-2' : 'shadow-sm ring-1 ring-brand-400'}`
          : aside
            ? 'outline-1 outline-offset-0 outline-dashed outline-slate-400 dark:outline-slate-500'
            : 'shadow-sm ring-1 ring-slate-900/10 group-hover:shadow-md group-hover:ring-slate-900/20 dark:ring-white/15 dark:group-hover:ring-white/30'
      }`}
      style={{ width: w, height: h }}
    >
      {thumb ? (
        <svg
          aria-hidden
          className={veiledPictureClass(aside)}
          width={w}
          height={h}
          viewBox={thumb.viewBox}
          preserveAspectRatio="xMidYMid slice"
          // The editor's own renderer's output (every label is xmlEscaped inside it).
          {...(thumb.parts ? {} : htmlProps(sanitizedHtml(thumb.markup, 'svg-content')))}
        >
          {thumb.parts?.map((part) => (
            <PicturePart key={part.key} markup={part.markup} />
          ))}
        </svg>
      ) : null}
      <ContentsVeil on={aside} width={w} {...(large ? { large } : {})} />
    </span>
  );
}

// One part of a picture, set as markup only when its markup changed: a drop on a page of a thousand elements
// re-sets the box it moved and the arrows it reached, not the page, so the browser parses, restyles and lays out
// those alone (docs/specs/008-canvas/canvas-performance.md "Pictures of every page"). A bare group draws nothing of
// its own, so the parts in their groups draw as the markup did in one piece.
const PicturePart = memo(function PicturePart({ markup }: Pick<ContentsThumbPart, 'markup'>) {
  return <g {...htmlProps(sanitizedHtml(markup, 'svg-content'))} />;
});

// The name, the editor's own marks, then the padlock on a locked page.
function NameLine({
  row,
  badges,
  small,
}: {
  row: ContentsRowBase;
  badges: ReactNode;
  small?: boolean;
}) {
  return (
    <span className="flex h-6 min-w-0 items-center gap-1.5">
      <span
        className={`truncate font-medium transition-colors ${
          row.setAside ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-100'
        } ${small ? 'text-xs' : 'text-sm'}`}
      >
        {row.name}
      </span>
      {badges}
      {row.locked ? (
        <span role="img" className="shrink-0 text-slate-400" aria-label="Locked">
          <LockIcon />
        </span>
      ) : null}
    </span>
  );
}

function ListRow({ row, here, thumb, badges, tools, grip }: RowProps) {
  const w = Math.min(LIST_MAX_W, Math.round(LIST_THUMB_H * row.aspect));
  const h = Math.round(w / row.aspect);
  return (
    <>
      {here ? (
        <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-full bg-brand-500" />
      ) : null}
      <span className="flex w-7 shrink-0 flex-col items-center gap-0.5">
        <span
          className={`text-sm font-semibold tabular-nums ${here ? 'text-brand-700 dark:text-brand-200' : 'text-slate-500 dark:text-slate-400'}`}
        >
          {row.number}
        </span>
        {tools}
      </span>
      <span
        className="flex shrink-0 items-center justify-center"
        style={{ width: LIST_MAX_W, height: LIST_THUMB_H + 4 }}
      >
        <Picture thumb={thumb} w={w} h={h} here={here} aside={!!row.setAside} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <NameLine row={row} badges={badges} />
      </span>
      {grip}
    </>
  );
}

function FilmRow({ row, here, thumb, badges, tools }: RowProps) {
  const w = Math.min(FILM_MAX_W, Math.round(FILM_MAX_H * row.aspect));
  const h = Math.round(w / row.aspect);
  return (
    <>
      <span className="flex w-6 shrink-0 flex-col items-center gap-1 pt-0.5">
        <span
          className={`text-xs font-semibold tabular-nums ${here ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'}`}
        >
          {row.number}
        </span>
        {tools}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* A page narrower than the slot (a portrait page, a card) sits in its middle, not at its left. */}
        <span
          className="flex justify-center"
          data-contents-film-frame=""
          style={{ width: FILM_MAX_W }}
        >
          <Picture thumb={thumb} w={w} h={h} here={here} large aside={!!row.setAside} />
        </span>
        <span className="flex min-w-0 flex-col pl-0.5" style={{ width: FILM_MAX_W }}>
          <NameLine row={row} badges={badges} small />
        </span>
      </span>
    </>
  );
}
