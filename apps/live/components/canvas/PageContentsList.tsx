'use client';

// The pieces of Illustrate's Contents (docs/specs/007-editor/illustrate-pages.md "Contents"), laid
// out by its two homes: the popover (PageContentsPanel) and the docked sidebar
// (PageContentsSidebar). The state behind them is usePageContents.
import { Fragment, type CSSProperties } from 'react';
import { MAX_ILLUSTRATE_PAGES, type PageKind } from '@livediagram/document';
import {
  lucideFileText,
  lucideGripVertical,
  lucideLock,
  lucidePanelsTopLeft,
  lucidePlus,
  lucideSearch,
  lucideShapes,
} from '@livediagram/icons/lucide';
import { lucideGlyph, Tooltip } from '@livediagram/ui';
import { SlideDeckIcon } from '@/components/palette/palette-icons';
import { DropCaret } from '@/components/primitives/DropCaret';
import { CONTENTS_FIND_AFTER, type ContentsRow } from '@/lib/page-contents';
import type { SlideThumb } from '@/lib/slide-thumb';
import type { PageContents } from '@/hooks/ui/usePageContents';

const LockIcon = lucideGlyph(lucideLock, 12);
const GripIcon = lucideGlyph(lucideGripVertical, 14);
const FindIcon = lucideGlyph(lucideSearch, 14);
const PlusIcon = lucideGlyph(lucidePlus, 14);
const InfographicIcon = lucideGlyph(lucidePanelsTopLeft, 16);
const ArticleIcon = lucideGlyph(lucideFileText, 16);
const LogoIcon = lucideGlyph(lucideShapes, 16);

// The popover's rows: a thumbnail this tall, its width following the page's shape, up to LIST_MAX_W.
const LIST_THUMB_H = 52;
const LIST_MAX_W = 92;
// The sidebar's filmstrip: a picture as wide as the column, up to this tall (a portrait page).
const FILM_MAX_W = 172;
const FILM_MAX_H = 124;

const ADD_KINDS: readonly { kind: PageKind; name: string; icon: () => React.ReactNode }[] = [
  { kind: 'infographic', name: 'Infographic', icon: () => <InfographicIcon /> },
  { kind: 'slide', name: 'Slide', icon: () => <SlideDeckIcon /> },
  { kind: 'article', name: 'Article', icon: () => <ArticleIcon /> },
  { kind: 'logo', name: 'Logo', icon: () => <LogoIcon /> },
];

// The page count, a badge at the right of the header line.
export function ContentsCount({ count }: { count: number }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {count === 1 ? '1 page' : `${count} pages`}
    </span>
  );
}

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

// The rows: `list` in the popover (number, small thumbnail, name and kind side by side), `film` in
// the sidebar (a filmstrip, as a slide editor shows its slides: the number beside a picture as wide
// as the column, the name under it).
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
  const { shown, query, current, list, registerRow, reorder, reorderable, go, onListKey, thumbs } =
    contents;
  const Row = variant === 'film' ? FilmRow : ListRow;
  return (
    <div
      ref={list}
      role="listbox"
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
          <button
            ref={(el) => registerRow(row.id, el)}
            type="button"
            role="option"
            aria-selected={row.id === current}
            data-page-row={row.id}
            data-contents-slot={i}
            onClick={() => go(row)}
            // A mouse or pen drags the whole row; a finger drags its grip, so the list still scrolls.
            onPointerDown={(e) => {
              if (e.pointerType !== 'touch') reorder.beginDrag(e, row.id);
            }}
            onPointerMove={reorder.moveDrag}
            onPointerUp={reorder.endDrag}
            onPointerCancel={reorder.endDrag}
            className={`group relative flex w-full text-left transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
              reorder.moving && reorder.draggingId === row.id ? 'opacity-50' : ''
            } ${variant === 'film' ? FILM_ROW_CLASS(row.id === current) : LIST_ROW_CLASS(row.id === current)}`}
          >
            <Row
              row={row}
              here={row.id === current}
              thumb={thumbs.get(row.id)}
              grip={
                reorderable ? (
                  <span
                    aria-hidden
                    data-contents-grip=""
                    onPointerDown={(e) => {
                      if (e.pointerType === 'touch') reorder.beginDrag(e, row.id);
                    }}
                    className={`flex h-8 w-5 shrink-0 cursor-grab touch-none items-center justify-center text-slate-400 transition ${
                      touch ? '' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <GripIcon />
                  </span>
                ) : null
              }
            />
          </button>
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
          dangerouslySetInnerHTML={{ __html: thumb.markup }}
        />
      ) : null}
    </span>
  );
}

function NameLine({ row, small }: { row: ContentsRow; small?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`truncate font-medium text-slate-800 dark:text-slate-100 ${small ? 'text-xs' : 'text-sm'}`}
      >
        {row.name}
      </span>
      {row.locked ? (
        <span className="shrink-0 text-slate-400" aria-label="Locked">
          <LockIcon />
        </span>
      ) : null}
    </span>
  );
}

function ListRow({ row, here, thumb, grip }: RowProps) {
  const w = Math.min(LIST_MAX_W, Math.round(LIST_THUMB_H * row.aspect));
  const h = Math.round(w / row.aspect);
  return (
    <>
      {here ? (
        <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-full bg-brand-500" />
      ) : null}
      <span className="flex w-7 shrink-0 flex-col items-center">
        <span
          className={`text-sm font-semibold tabular-nums ${here ? 'text-brand-700 dark:text-brand-200' : 'text-slate-400 dark:text-slate-400'}`}
        >
          {row.number}
        </span>
        {here ? (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
            Here
          </span>
        ) : null}
      </span>
      <span
        className="flex shrink-0 items-center justify-center"
        style={{ width: LIST_MAX_W, height: LIST_THUMB_H + 4 }}
      >
        <Picture thumb={thumb} w={w} h={h} here={here} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <NameLine row={row} />
        <span className="truncate text-xs text-slate-500 dark:text-slate-400">{row.line}</span>
      </span>
      {grip}
    </>
  );
}

function FilmRow({ row, here, thumb, grip }: RowProps) {
  const w = Math.min(FILM_MAX_W, Math.round(FILM_MAX_H * row.aspect));
  const h = Math.round(w / row.aspect);
  return (
    <>
      <span className="flex w-6 shrink-0 flex-col items-center gap-1 pt-0.5">
        <span
          className={`text-xs font-semibold tabular-nums ${here ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400 dark:text-slate-500'}`}
        >
          {row.number}
        </span>
        {grip}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex justify-center" style={{ width: FILM_MAX_W }}>
          <Picture thumb={thumb} w={w} h={h} here={here} large />
        </span>
        <span className="flex min-w-0 flex-col px-0.5">
          <NameLine row={row} small />
          <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {here ? (
              <span className="font-semibold text-brand-700 dark:text-brand-300">Here · </span>
            ) : null}
            {row.line}
          </span>
        </span>
      </span>
    </>
  );
}

// An Editor's footer: Add Page, the four kinds, the last page's kind first and highlighted. Four
// across in the popover; two by two in the narrower sidebar.
export function ContentsAddPage({ contents, columns }: { contents: PageContents; columns: 2 | 4 }) {
  const { canAdd, add, full, lastKind } = contents;
  if (!canAdd) return null;
  const kinds = lastKind
    ? [
        ...ADD_KINDS.filter((k) => k.kind === lastKind),
        ...ADD_KINDS.filter((k) => k.kind !== lastKind),
      ]
    : ADD_KINDS;
  return (
    <div className="border-t border-slate-100 px-3 pb-3 pt-2.5 dark:border-slate-800">
      <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <PlusIcon />
        Add Page
      </p>
      <div className={`grid gap-1.5 ${columns === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
        {kinds.map(({ kind, name, icon }) => (
          <Tooltip
            key={kind}
            label={full ? `A tab holds up to ${MAX_ILLUSTRATE_PAGES} pages` : `Add a ${name} page`}
          >
            <button
              type="button"
              disabled={full}
              aria-label={`Add a ${name} page`}
              onClick={() => add?.(kind)}
              className={`flex items-center rounded-lg border text-[11px] font-medium transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-40 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20 dark:hover:text-brand-100 ${
                columns === 4 ? 'flex-col gap-1 px-1 py-2' : 'gap-1.5 px-2 py-1.5'
              } ${
                kind === lastKind
                  ? 'border-brand-400 bg-brand-50 text-brand-700 ring-2 ring-brand-400/30 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100'
                  : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              }`}
            >
              {icon()}
              {name}
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
