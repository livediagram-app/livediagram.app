'use client';

// The slash menu (docs/specs/007-editor/article-pages.md "The slash menu"): under the `/` that
// opened it, its entries in groups, filtered by what is typed after it; Up and Down move, Enter or
// Tab choose (the writing's keys, through article-slash.ts), a press chooses too. It never takes focus
// from the writing.
import { useLayoutEffect, useRef, useState } from 'react';
import { Portal } from '@livediagram/ui';
import type { SlashItem } from '@/lib/article/article-slash-items';

// The menu and its options by id, for the writing to point at (aria-controls,
// aria-activedescendant) while the caret stays in it.
export const SLASH_MENU_ID = 'article-slash-menu';
export const slashOptionId = (i: number) => `article-slash-option-${i}`;

const WIDTH = 260;
const MAX_HEIGHT = 320;

export function SlashMenu({
  at,
  items,
  index,
  onPick,
  onHover,
}: {
  // The `/`'s place on screen.
  at: { left: number; top: number; bottom: number };
  items: readonly SlashItem[];
  index: number;
  onPick: (item: SlashItem) => void;
  onHover: (index: number) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const h = Math.min(MAX_HEIGHT, list.current?.offsetHeight ?? MAX_HEIGHT);
    const left = Math.max(8, Math.min(at.left, window.innerWidth - WIDTH - 8));
    const below = at.bottom + 6;
    const top = below + h + 8 <= window.innerHeight ? below : Math.max(8, at.top - 6 - h);
    setPos({ left, top });
  }, [at.left, at.top, at.bottom, items.length]);
  // The highlighted entry stays in view as the keys move it.
  useLayoutEffect(() => {
    list.current
      ?.querySelector(`[data-slash-index="${index}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [index]);
  // The entries by group, each group a labelled set of options (their headings are its name). A
  // search ranks across groups, so a group can come back after another: a run of its own each time.
  const groups: { name: string; entries: { item: SlashItem; i: number }[] }[] = [];
  items.forEach((item, i) => {
    const last = groups[groups.length - 1];
    if (last && last.name === item.group) last.entries.push({ item, i });
    else groups.push({ name: item.group, entries: [{ item, i }] });
  });
  return (
    <Portal>
      <div
        ref={list}
        id={SLASH_MENU_ID}
        role="listbox"
        aria-label="Insert a block"
        data-article-keep-active=""
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-[var(--z-overlay)] animate-fade-in overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
        style={{
          left: pos?.left ?? -9999,
          top: pos?.top ?? -9999,
          width: WIDTH,
          maxHeight: MAX_HEIGHT,
        }}
      >
        {items.length === 0 ? (
          <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">No blocks match</p>
        ) : (
          groups.map((group) => (
            <div key={`${group.name}-${group.entries[0]!.i}`} role="group" aria-label={group.name}>
              <p
                aria-hidden
                className="px-2.5 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-400"
              >
                {group.name}
              </p>
              {group.entries.map(({ item, i }) => (
                <button
                  key={item.id}
                  id={slashOptionId(i)}
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  data-slash-index={i}
                  onPointerEnter={() => onHover(i)}
                  onClick={() => onPick(item)}
                  className={`flex w-full items-baseline justify-between gap-3 rounded-md px-2.5 py-1.5 text-left transition ${
                    i === index
                      ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="truncate text-xs text-slate-400 dark:text-slate-400">
                    {item.hint}
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </Portal>
  );
}
