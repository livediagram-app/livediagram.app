'use client';

// The pieces of Pages mode's Contents (docs/specs/007-editor/pages-mode.md "Contents"), laid
// out by its two homes: the popover (PageContentsPanel) and the docked sidebar
// (PageContentsSidebar). The state behind them is usePageContents.
import { Fragment, type CSSProperties } from 'react';
import {
  lucideGripVertical,
  lucideCopy,
  lucideLock,
  lucideLockOpen,
  lucideTrash2,
  lucideSearch,
} from '@livediagram/icons/lucide';
import { lucideGlyph, Tooltip, trustedHtml } from '@livediagram/ui';
import { SlideDeckIcon } from '@/components/palette/palette-icons';
import { DropCaret } from '@/components/primitives/DropCaret';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import {
  MenuActionRow,
  MenuGroupSeparator,
  MenuHeader,
  PortalMenu,
} from '@/components/primitives/PortalMenu';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import { CONTENTS_FIND_AFTER, type ContentsRow } from '@/lib/page-contents';
import type { SlideThumb } from '@/lib/slide-thumb';
import type { PageActions, PageContents } from '@/hooks/ui/usePageContents';

const LockIcon = lucideGlyph(lucideLock, 12);
const LockToolIcon = lucideGlyph(lucideLock, 14);
const UnlockIcon = lucideGlyph(lucideLockOpen, 14);
const CopyIcon = lucideGlyph(lucideCopy, 14);
const DeleteIcon = lucideGlyph(lucideTrash2, 14);
const GripIcon = lucideGlyph(lucideGripVertical, 14);
const FindIcon = lucideGlyph(lucideSearch, 14);

// The popover's rows: a thumbnail this tall, its width following the page's shape, up to LIST_MAX_W.
const LIST_THUMB_H = 52;
const LIST_MAX_W = 92;
// The sidebar's filmstrip: a picture as wide as the column, up to this tall (a portrait page).
const FILM_MAX_W = 172;
const FILM_MAX_H = 124;

// Find a Page, once the tab has more pages than fit at a glance.
export function ContentsFind({ contents }: { contents: PageContents }) {
  const { pages, query, setQuery, focusFirst } = contents;
  if (pages.length <= CONTENTS_FIND_AFTER) return null;
  return (
    <label className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-400 focus-within:border-brand-400 dark:border-slate-700 dark:bg-slate-900">
      <FindIcon />
      <input
        type="search"
        value={query}
        placeholder="Find a Page"
        aria-label="Find a Page"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && query) {
            e.stopPropagation();
            setQuery('');
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusFirst();
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
      />
    </label>
  );
}

// The rows: `list` in the popover (number, small thumbnail, name side by side), `film` in the
// sidebar (a filmstrip, as a slide editor shows its slides: the number beside a picture as wide as
// the column, the name under it). Each row's name shares its line with the page's own toolbar (an
// Editor's), shown while the row is hovered, focused or here, and always to a finger.
export function ContentsList({
  contents,
  variant,
  touch,
  className = '',
  style,
}: {
  contents: PageContents;
  variant: 'list' | 'film';
  // A finger drags a row by its grip, always shown (a phone); else the grip shows on hover.
  touch: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const {
    shown,
    query,
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
  const Row = variant === 'film' ? FilmRow : ListRow;
  return (
    <div
      ref={list}
      role="list"
      aria-label="Pages"
      onKeyDown={onListKey}
      className={`flex min-h-0 flex-col overflow-y-auto ${className}`}
      style={style}
    >
      {shown.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          No page matches “{query}”.
        </p>
      ) : null}
      {shown.map((row, i) => (
        <Fragment key={row.id}>
          {reorder.caretBefore(i) ? <DropCaret /> : null}
          <div
            role="listitem"
            data-contents-slot={i}
            onClick={(e) => go(row, e.timeStamp)}
            // A mouse or pen drags the whole row; a finger drags its grip, so the list still scrolls.
            onPointerDown={(e) => {
              if (e.pointerType !== 'touch') reorder.beginDrag(e, row.id);
            }}
            onPointerMove={reorder.moveDrag}
            onPointerUp={reorder.endDrag}
            onPointerCancel={reorder.endDrag}
            // The row wears its button's keyboard focus: the button lies under the row's own content.
            className={`group relative flex w-full cursor-pointer text-left transition has-[>button:focus-visible]:outline-2 has-[>button:focus-visible]:outline-brand-600 ${
              reorder.moving && reorder.draggingId === row.id ? 'opacity-50' : ''
            } ${variant === 'film' ? FILM_ROW_CLASS(row.id === current) : LIST_ROW_CLASS(row.id === current)}`}
          >
            {/* The row opens through one button stretched across it; its toolbar and grip sit above that button as
                controls of their own. An option holding them was a control nested in a control (docs/specs/007-editor/pages-mode.md). */}
            <button
              ref={(el) => registerRow(row.id, el)}
              type="button"
              aria-label={row.name}
              aria-current={row.id === current ? 'page' : undefined}
              data-page-row={row.id}
              onClick={(e) => {
                e.stopPropagation();
                go(row, e.timeStamp);
              }}
              className="absolute inset-0 z-0 cursor-pointer rounded-[inherit] outline-none"
            />
            <Row
              row={row}
              here={row.id === current}
              thumb={thumbs.get(row.id)}
              actions={
                <span className="relative z-10 flex">
                  {variant === 'film' ? (
                    <PageToolbar
                      row={row}
                      actions={actionsFor(row)}
                      shown={touch || row.id === current}
                    />
                  ) : (
                    <PageMenu row={row} actions={actionsFor(row)} />
                  )}
                </span>
              }
              grip={
                reorderable ? (
                  <span
                    aria-hidden
                    data-contents-grip=""
                    onPointerDown={(e) => {
                      if (e.pointerType === 'touch') reorder.beginDrag(e, row.id);
                    }}
                    className={`relative z-10 flex h-8 w-5 shrink-0 cursor-grab touch-none items-center justify-center text-slate-400 transition ${
                      touch ? '' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <GripIcon />
                  </span>
                ) : null
              }
            />
          </div>
        </Fragment>
      ))}
      {reorder.caretAfterLast ? <DropCaret /> : null}
    </div>
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
  row: ContentsRow;
  here: boolean;
  thumb: SlideThumb | undefined;
  actions: React.ReactNode;
  grip: React.ReactNode;
};

function Picture({
  thumb,
  w,
  h,
  here,
  large,
}: {
  thumb: SlideThumb | undefined;
  w: number;
  h: number;
  here: boolean;
  large?: boolean;
}) {
  return (
    <span
      className={`block overflow-hidden bg-white transition dark:bg-slate-800 ${
        large ? 'rounded-lg' : 'rounded-md'
      } ${
        here
          ? `ring-brand-500 ${large ? 'shadow-md ring-2' : 'shadow-sm ring-1 ring-brand-400'}`
          : 'shadow-sm ring-1 ring-slate-900/10 group-hover:shadow-md group-hover:ring-slate-900/20 dark:ring-white/15 dark:group-hover:ring-white/30'
      }`}
      style={{ width: w, height: h }}
    >
      {thumb ? (
        <svg
          aria-hidden
          width={w}
          height={h}
          viewBox={thumb.viewBox}
          preserveAspectRatio="xMidYMid slice"
          // Our own renderer's output (every label is xmlEscaped inside it).
          dangerouslySetInnerHTML={{ __html: trustedHtml(thumb.markup) }}
        />
      ) : null}
    </span>
  );
}

// The name, the padlock on a locked page, and the page's toolbar at the line's end.
function NameLine({
  row,
  small,
  actions,
}: {
  row: ContentsRow;
  small?: boolean;
  actions: React.ReactNode;
}) {
  return (
    <span className="flex h-6 min-w-0 items-center gap-1.5">
      <span
        className={`truncate font-medium text-slate-800 dark:text-slate-100 ${small ? 'text-xs' : 'text-sm'}`}
      >
        {row.name}
      </span>
      {row.locked ? (
        <span role="img" className="shrink-0 text-slate-400" aria-label="Locked">
          <LockIcon />
        </span>
      ) : null}
      <span className="ml-auto flex shrink-0 items-center">{actions}</span>
    </span>
  );
}

// A page's own toolbar: Add to Slides (a slide page not yet in the deck), Duplicate, Lock or Unlock
// and Delete, each a glyph with its Tooltip. None for a Participant or a Viewer. Shown while the row
// is hovered or focused, and while it is here (or always, to a finger); laid out all along, so the
// row never shifts as it shows.
function PageToolbar({
  row,
  actions,
  shown,
}: {
  row: ContentsRow;
  actions: PageActions | null;
  shown: boolean;
}) {
  if (!actions) return null;
  const tools: { key: string; label: string; icon: React.ReactNode; run: () => void }[] = [];
  if (actions.addToSlides)
    tools.push({
      key: 'slides',
      label: 'Add to Slides',
      icon: <SlideDeckIcon />,
      run: actions.addToSlides,
    });
  if (actions.duplicate)
    tools.push({
      key: 'duplicate',
      label: 'Duplicate',
      icon: <CopyIcon />,
      run: actions.duplicate,
    });
  tools.push({
    key: 'lock',
    label: row.locked ? 'Unlock' : 'Lock',
    icon: row.locked ? <UnlockIcon /> : <LockToolIcon />,
    run: actions.toggleLock,
  });
  if (actions.remove)
    tools.push({ key: 'delete', label: 'Delete', icon: <DeleteIcon />, run: actions.remove });
  return (
    <span
      role="toolbar"
      aria-label={`${row.name} actions`}
      data-page-toolbar=""
      className={`flex items-center gap-px transition-opacity duration-micro ${
        shown ? '' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
      }`}
    >
      {tools.map((tool) => (
        <Tooltip key={tool.key} label={tool.label}>
          <button
            type="button"
            aria-label={`${tool.label} ${row.name}`}
            data-page-action={tool.key}
            // A press here is the tool's, not the row's: no glide, no drag.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              tool.run();
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className={`flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100 ${
              tool.key === 'delete' ? 'hover:text-red-700 dark:hover:text-red-300' : ''
            }`}
          >
            {tool.icon}
          </button>
        </Tooltip>
      ))}
    </span>
  );
}

// The popover's rows are narrower to spare: one ⋯ button opens the same actions as a menu, a
// header naming the page, Delete last under its own separator.
function PageMenu({ row, actions }: { row: ContentsRow; actions: PageActions | null }) {
  const menu = useRowMenu();
  if (!actions) return null;
  const then = (fn: () => void) => () => {
    fn();
    menu.close();
  };
  return (
    // The menu is portalled, but its events still bubble through React to the row: none of its
    // presses, keys or clicks are the row's (no glide, no drag).
    <span
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <EllipsisTriggerButton
        {...menu.triggerProps}
        size="md"
        reveal
        label={`Menu for ${row.name}`}
      />
      {menu.open ? (
        <PortalMenu anchor={menu.triggerRef.current} placement="below" onClose={menu.close}>
          <MenuHeader title={row.name} />
          {actions.addToSlides ? (
            <MenuActionRow
              plain
              icon={<SlideDeckIcon />}
              label="Add to Slides"
              onClick={then(actions.addToSlides)}
            />
          ) : null}
          {actions.duplicate ? (
            <MenuActionRow
              plain
              icon={<CopyIcon />}
              label="Duplicate"
              onClick={then(actions.duplicate)}
            />
          ) : null}
          <MenuActionRow
            plain
            icon={row.locked ? <UnlockIcon /> : <LockToolIcon />}
            label={row.locked ? 'Unlock' : 'Lock'}
            onClick={then(actions.toggleLock)}
          />
          {actions.remove ? (
            <>
              <MenuGroupSeparator />
              <MenuActionRow
                plain
                icon={<DeleteIcon />}
                label="Delete"
                onClick={then(actions.remove)}
              />
            </>
          ) : null}
        </PortalMenu>
      ) : null}
    </span>
  );
}

function ListRow({ row, here, thumb, actions, grip }: RowProps) {
  const w = Math.min(LIST_MAX_W, Math.round(LIST_THUMB_H * row.aspect));
  const h = Math.round(w / row.aspect);
  return (
    <>
      {here ? (
        <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-full bg-brand-500" />
      ) : null}
      <span className="flex w-7 shrink-0 flex-col items-center">
        <span
          className={`text-sm font-semibold tabular-nums ${here ? 'text-brand-700 dark:text-brand-200' : 'text-slate-500 dark:text-slate-400'}`}
        >
          {row.number}
        </span>
      </span>
      <span
        className="flex shrink-0 items-center justify-center"
        style={{ width: LIST_MAX_W, height: LIST_THUMB_H + 4 }}
      >
        <Picture thumb={thumb} w={w} h={h} here={here} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <NameLine row={row} actions={actions} />
      </span>
      {grip}
    </>
  );
}

function FilmRow({ row, here, thumb, actions, grip }: RowProps) {
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
        {grip}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex" style={{ width: FILM_MAX_W }}>
          <Picture thumb={thumb} w={w} h={h} here={here} large />
        </span>
        <span className="flex min-w-0 flex-col pl-0.5" style={{ width: FILM_MAX_W }}>
          <NameLine row={row} small actions={actions} />
        </span>
      </span>
    </>
  );
}
