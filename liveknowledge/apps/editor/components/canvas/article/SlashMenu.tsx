'use client';

// The slash menu (docs/specs/030-knowledgebase/page-surface.md "The slash menu"): under the `/` that opened it, its
// sections (Recent, then the groups), each entry a tile, its name with the typed letters bold and a line; on a
// desktop a preview of the highlighted block beside the list; on a phone a sheet above the keyboard. The writing's
// keys move it (article-slash.ts, through the writing's bridge) and a press chooses; it never takes the focus from
// the writing. The page picker draws its pages with it too, without a preview.
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  NoMatches,
  Portal,
  useMediaQuery,
  useVisualViewportBand,
  POPOVER_VIEWPORT_MARGIN,
} from '@liveknowledge/ui';
import type { SlashItem } from '@/lib/article/article-slash-items';
import { RECENT, type SlashModel } from '@/lib/article/slash-menu-model';
import {
  placeSlashMenu,
  SLASH_LIST_WIDTH,
  SLASH_MAX_HEIGHT,
  type SlashPlace,
} from './slash-menu-place';
import { recentIcon, slashIcon } from './slash-menu-icons';
import { SlashPreview } from './SlashPreview';

// The menu and its options by id, for the writing to point at (aria-controls, aria-activedescendant) while the
// caret stays in it.
export const SLASH_MENU_ID = 'article-slash-menu';
export const slashOptionId = (i: number) => `article-slash-option-${i}`;

/** Where the menu is a sheet along the screen's foot rather than a popover at the caret. */
export const SLASH_SHEET_QUERY = '(max-width: 639px)';
// The sheet's share of the visible height at most.
const SHEET_SHARE = 0.45;

// A name with the matched letters bold: runs of marked and unmarked characters.
function Marked({ text, marks }: { text: string; marks: readonly number[] }) {
  if (marks.length === 0) return <>{text}</>;
  const on = new Set(marks);
  const runs: { bold: boolean; text: string }[] = [];
  for (let i = 0; i < text.length; i++) {
    const bold = on.has(i);
    const last = runs[runs.length - 1];
    if (last && last.bold === bold) last.text += text[i];
    else runs.push({ bold, text: text[i]! });
  }
  return (
    <>
      {runs.map((r, i) =>
        r.bold ? (
          <b key={i} className="font-bold text-slate-950 dark:text-white">
            {r.text}
          </b>
        ) : (
          <span key={i}>{r.text}</span>
        ),
      )}
    </>
  );
}

function Row({
  item,
  marks,
  i,
  selected,
  sheet,
  onPick,
  onHover,
}: {
  item: SlashItem;
  marks: readonly number[];
  i: number;
  selected: boolean;
  sheet: boolean;
  onPick: (item: SlashItem) => void;
  onHover: (index: number) => void;
}) {
  return (
    <button
      id={slashOptionId(i)}
      type="button"
      role="option"
      // Its name, then its line: read as two phrases, not run together.
      aria-label={item.hint ? `${item.label}, ${item.hint}` : item.label}
      aria-selected={selected}
      data-slash-index={i}
      data-slash-id={item.id}
      onPointerEnter={() => onHover(i)}
      onClick={() => onPick(item)}
      className={`flex w-full items-center gap-3 rounded-lg px-2 text-left transition-colors duration-micro ${
        sheet ? 'min-h-11 py-1' : 'py-1.5'
      } ${
        selected
          ? 'bg-brand-50 text-brand-900 dark:bg-brand-500/15 dark:text-brand-50'
          : 'text-slate-700 dark:text-slate-200'
      }`}
    >
      <span
        aria-hidden
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors duration-micro ${
          selected
            ? 'border-brand-700 bg-brand-700 text-white shadow-sm shadow-brand-900/20 dark:border-brand-500 dark:bg-brand-600 dark:text-white'
            : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
        }`}
      >
        {slashIcon(item.id)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium leading-5">
          <Marked text={item.label} marks={marks} />
        </span>
        {item.hint ? (
          <span
            className={`block truncate text-xs leading-4 ${
              selected
                ? 'text-brand-800/80 dark:text-brand-100/75'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {item.hint}
          </span>
        ) : null}
      </span>
      {selected && !sheet ? (
        <span
          aria-hidden
          className="rounded border border-brand-200 px-1 text-[10px] leading-4 text-brand-700 dark:border-brand-400/40 dark:text-brand-200"
        >
          ↵
        </span>
      ) : null}
    </button>
  );
}

const Heading = ({ name, sheet }: { name: string; sheet: boolean }) => (
  <p
    aria-hidden
    className={`flex items-center gap-1.5 px-2 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
      sheet ? 'sticky top-0 z-[1] bg-white dark:bg-slate-900' : ''
    }`}
  >
    {name === RECENT ? recentIcon() : null}
    {name}
  </p>
);

// The keys, said once at the list's foot on a desktop.
const KEY_HINTS = [
  ['↑↓', 'Move'],
  ['Tab', 'Next Group'],
  ['↵', 'Insert'],
  ['Esc', 'Close'],
] as const;
const KeyHints = () => (
  <p
    aria-hidden
    className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-slate-100 px-3 py-1.5 text-[10.5px] text-slate-500 dark:border-slate-800 dark:text-slate-400"
  >
    {KEY_HINTS.map(([k, what]) => (
      <span key={k} className="inline-flex items-center gap-1">
        <kbd className="font-sans font-semibold text-slate-600 dark:text-slate-300">{k}</kbd>
        {what}
      </span>
    ))}
  </p>
);

export function SlashMenu({
  at,
  model,
  index,
  onPick,
  onHover,
  query = '',
  label = 'Insert a block',
  things = 'blocks',
  look,
  preview = true,
}: {
  // The `/`'s place on screen.
  at: { left: number; top: number; bottom: number };
  model: SlashModel;
  index: number;
  onPick: (item: SlashItem) => void;
  onHover: (index: number) => void;
  // What is typed after the `/`, for the empty state.
  query?: string;
  // The list's name and what its empty state says none of match: the page picker's are its own.
  label?: string;
  things?: string;
  // The writing's look (its `--article-*` variables), so the tiles' type and the preview wear the knowledgebase's.
  look?: Readonly<Record<string, string>>;
  // Whether a preview may show beside the list (the page picker has none).
  preview?: boolean;
}) {
  const sheet = useMediaQuery(SLASH_SHEET_QUERY);
  const band = useVisualViewportBand();
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<SlashPlace | null>(null);
  const count = model.items.length;
  // Placed before it paints: its height read once per open and filter (never per frame).
  useLayoutEffect(() => {
    if (sheet) return;
    const height = Math.min(SLASH_MAX_HEIGHT, box.current?.scrollHeight ?? SLASH_MAX_HEIGHT);
    setPlace(
      placeSlashMenu(at, height, { width: window.innerWidth, height: window.innerHeight }, preview),
    );
  }, [at, count, sheet, preview]);
  // The highlighted entry stays in view as the keys move it: the list's own scroll only, never the page's (an
  // element's scrollIntoView scrolls every scrolling box around it, the page under the menu too).
  useLayoutEffect(() => {
    const box = list.current;
    const row = box?.querySelector<HTMLElement>(`[data-slash-index="${index}"]`);
    if (!box || !row) return;
    const top = row.offsetTop - box.offsetTop;
    // A group's first entry brings its heading with it.
    const prev = row.previousElementSibling;
    const head = prev instanceof HTMLParagraphElement ? prev.offsetHeight : 0;
    if (top - head < box.scrollTop) box.scrollTop = Math.max(0, top - head - 6);
    else if (top + row.offsetHeight > box.scrollTop + box.clientHeight)
      box.scrollTop = top + row.offsetHeight - box.clientHeight + 6;
  }, [index]);
  const current = model.items[index];
  const showPreview = !sheet && !!place?.preview && !!current;

  const body: ReactNode =
    count === 0 ? (
      <NoMatches things={things} query={query} />
    ) : (
      model.sections.map((section, s) => (
        <div key={`${section.name}-${s}`} role="group" aria-label={section.name}>
          <Heading name={section.name} sheet={sheet} />
          {section.entries.map(({ item, marks }, e) => {
            // Its place in the whole list: the section's first, then its own.
            const i = (model.starts[s] ?? 0) + e;
            return (
              <Row
                key={`${section.name}-${item.id}`}
                item={item}
                marks={marks}
                i={i}
                selected={i === index}
                sheet={sheet}
                onPick={onPick}
                onHover={onHover}
              />
            );
          })}
        </div>
      ))
    );

  // A sheet sits along the visible screen's foot (above the on-screen keyboard); a popover at the `/`.
  const m = POPOVER_VIEWPORT_MARGIN;
  const layoutHeight = sheet ? document.documentElement.clientHeight || window.innerHeight : 0;
  const style: CSSProperties = sheet
    ? {
        ...look,
        left: m + (band?.left ?? 0),
        right: m,
        bottom: band
          ? layoutHeight - (band.top + band.height) + m
          : `calc(${m}px + env(safe-area-inset-bottom))`,
        maxHeight: Math.round((band ? band.height : layoutHeight) * SHEET_SHARE),
      }
    : {
        ...look,
        left: place?.left ?? -9999,
        top: place?.top ?? -9999,
        width: place?.width ?? SLASH_LIST_WIDTH,
        maxHeight: place?.maxHeight ?? SLASH_MAX_HEIGHT,
      };
  const motion = sheet
    ? 'animate-sheet-up'
    : place?.above
      ? 'animate-dropdown-up origin-bottom-left'
      : 'animate-dropdown-down origin-top-left';
  return (
    <Portal>
      <div
        ref={box}
        data-article-keep-active=""
        data-slash-menu={sheet ? 'sheet' : 'popover'}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        className={`fixed z-[var(--z-overlay)] flex overflow-hidden border border-slate-200/90 bg-white text-sm shadow-2xl shadow-slate-900/15 motion-reduce:animate-none dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-slate-950/60 ${motion} ${
          sheet ? 'flex-col rounded-2xl' : 'rounded-xl'
        }`}
        style={style}
      >
        {sheet ? (
          <span aria-hidden className="flex h-4 shrink-0 items-center justify-center">
            <span className="h-1 w-9 rounded-full bg-slate-300 dark:bg-slate-600" />
          </span>
        ) : null}
        <div
          className="flex min-h-0 min-w-0 flex-col"
          style={sheet ? undefined : { width: SLASH_LIST_WIDTH, flex: 'none' }}
        >
          <div
            ref={list}
            id={SLASH_MENU_ID}
            role="listbox"
            aria-label={label}
            className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${
              sheet ? 'px-1.5 pb-1.5' : 'p-1.5'
            }`}
          >
            {body}
          </div>
          {!sheet && count > 0 && preview ? <KeyHints /> : null}
        </div>
        {showPreview ? (
          <div className="flex min-w-0 flex-1 flex-col border-l border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/40">
            <SlashPreview item={current} />
          </div>
        ) : null}
      </div>
    </Portal>
  );
}
