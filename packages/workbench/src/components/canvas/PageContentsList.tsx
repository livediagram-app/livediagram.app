'use client';

// The pieces of Pages mode's Contents (docs/specs/007-editor/pages-mode.md "Contents"), laid
// out by its two homes: the popover (PageContentsPanel) and the docked sidebar
// (PageContentsSidebar). The state behind them is hooks/ui/usePageContents.
import { Fragment, useId, type CSSProperties, type ReactNode } from 'react';
import { lucideGripVertical, lucideLock } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';
import { trustedHtml } from '@liveworkspace/trusted-types';
import { DropCaret } from '../primitives/DropCaret';
import { ContentsVeil, veiledPictureClass } from './ContentsVeil';
import { PageRowMenu, PageRowMenuButton, PageRowStack, usePageRowMenu } from './PageRowMenu';
import type { ContentsRowBase, ContentsThumb } from '../../lib/page-contents';
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
// under the number (the grip at the row's end). One ⋯ menu serves the whole list.
export function ContentsList<R extends ContentsRowBase>({
  contents,
  variant,
  touch,
  badges,
  className = '',
  style,
}: {
  contents: ContentsListState<R>;
  variant: 'list' | 'film';
  // A finger drags a row by its grip, always shown (a phone); else the grip shows on hover.
  touch: boolean;
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
  const Row = variant === 'film' ? FilmRow : ListRow;
  // The open menu's page, read afresh each render so its verbs follow the page (locked, moved).
  const menuRow = menu.openId ? rows.find((r) => r.id === menu.openId) : undefined;
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
        {rows.map((row, i) => {
          const actions = actionsFor(row);
          const asideId = row.setAside ? `${uid}-aside-${row.id}` : undefined;
          const rowMenu = actions ? menu.rowProps(row.id) : null;
          const grip = reorderable ? (
            <span
              aria-hidden
              data-contents-grip=""
              onPointerDown={(e) => {
                if (e.pointerType === 'touch') reorder.beginDrag(e, row.id);
              }}
              // In the filmstrip it is the top of the row's stack, shown with it.
              className={`relative z-10 flex w-5 shrink-0 cursor-grab touch-none items-center justify-center text-slate-400 transition ${
                variant === 'film' ? 'h-6' : 'h-8'
              } ${touch || variant === 'film' ? '' : 'opacity-0 group-hover:opacity-100'}`}
            >
              <GripIcon />
            </span>
          ) : null;
          return (
            <Fragment key={row.id}>
              {reorder.caretBefore(i) ? <DropCaret /> : null}
              <div
                role="listitem"
                data-contents-slot={i}
                onClick={(e) => go(row, e.timeStamp)}
                onContextMenu={rowMenu?.onContextMenu}
                // A mouse or pen drags the whole row; a finger drags its grip, so the list still
                // scrolls, and a finger held still opens the page's menu.
                onPointerDown={(e) => {
                  rowMenu?.onPointerDown(e);
                  if (e.pointerType !== 'touch') reorder.beginDrag(e, row.id);
                }}
                onPointerMove={reorder.moveDrag}
                onPointerUp={reorder.endDrag}
                onPointerCancel={reorder.endDrag}
                // The row wears its button's keyboard focus: the button lies under the row's own content.
                className={`group relative flex w-full cursor-pointer select-none text-left transition [-webkit-touch-callout:none] has-[>button:focus-visible]:outline-2 has-[>button:focus-visible]:outline-brand-600 ${
                  reorder.moving && reorder.draggingId === row.id ? 'opacity-50' : ''
                } ${variant === 'film' ? FILM_ROW_CLASS(row.id === current) : LIST_ROW_CLASS(row.id === current)}`}
              >
                {/* The row opens through one button stretched across it; its tools and grip sit above that button as
                    controls of their own. An option holding them was a control nested in a control (docs/specs/007-editor/pages-mode.md). */}
                <button
                  ref={(el) => registerRow(row.id, el)}
                  type="button"
                  aria-label={row.name}
                  aria-describedby={asideId}
                  aria-current={row.id === current ? 'page' : undefined}
                  data-page-row={row.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    go(row, e.timeStamp);
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
                  here={row.id === current}
                  thumb={thumbs.get(row.id)}
                  badges={badges?.(row)}
                  tools={
                    variant === 'film' ? (
                      actions ? (
                        <PageRowStack
                          id={row.id}
                          name={row.name}
                          menu={menu}
                          grip={grip}
                          shown={touch || row.id === current}
                          {...(actions.remove ? { remove: actions.remove } : {})}
                        />
                      ) : null
                    ) : actions ? (
                      <span className="relative z-10 flex">
                        <PageRowMenuButton id={row.id} name={row.name} menu={menu} reveal />
                      </span>
                    ) : null
                  }
                  grip={variant === 'list' ? grip : null}
                />
              </div>
            </Fragment>
          );
        })}
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
          dangerouslySetInnerHTML={{ __html: trustedHtml(thumb.markup) }}
        />
      ) : null}
      <ContentsVeil on={aside} width={w} {...(large ? { large } : {})} />
    </span>
  );
}

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
        <span className="flex justify-center" data-contents-film-frame="" style={{ width: FILM_MAX_W }}>
          <Picture thumb={thumb} w={w} h={h} here={here} large aside={!!row.setAside} />
        </span>
        <span className="flex min-w-0 flex-col pl-0.5" style={{ width: FILM_MAX_W }}>
          <NameLine row={row} badges={badges} small />
        </span>
      </span>
    </>
  );
}
