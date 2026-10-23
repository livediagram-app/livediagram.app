'use client';

// The Explorer's search field: what the person types becomes the Search view 250 ms after they stop, so
// the index is asked once per pause rather than once per key (and the list cancels a superseded request).
// Escape clears it. Two sizes, as livediagram draws its field: the header's bar, and Home's hero, drawn
// large with New inside its end. Typing in the hero leaves Home, so the hero folds away and the header's
// bar takes the focus, the caret at the end of what was typed.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { SearchIcon } from '../ui/icons';
import { useExplorer } from './context';

export const SEARCH_DEBOUNCE_MS = 250;

const SIZES = {
  bar: {
    wrap: 'relative w-full sm:w-64 lg:w-[22rem]',
    box: 'h-9 gap-1.5 rounded-lg border border-slate-300 bg-white pl-2.5 pr-1 text-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/40 dark:border-slate-600 dark:bg-slate-900',
    glyph: 14,
    input: 'text-sm',
  },
  hero: {
    wrap: 'relative w-full',
    box: 'h-[60px] gap-3 rounded-[18px] border-2 border-brand-200 bg-white pl-[18px] pr-2 text-base shadow-[0_0_0_6px_color-mix(in_oklab,var(--color-brand-300)_22%,transparent),0_18px_40px_-20px_color-mix(in_oklab,var(--color-brand-600)_45%,transparent)] focus-within:border-brand-400 dark:border-brand-400/40 dark:bg-slate-800 dark:shadow-[0_0_0_6px_color-mix(in_oklab,var(--color-brand-400)_12%,transparent)] dark:focus-within:border-brand-400',
    glyph: 18,
    input: 'text-base',
  },
} as const;

export type SearchFieldSize = keyof typeof SIZES;

// Set by the hero's field as it hands the typing over; the bar that mounts next takes the focus.
let barFocusRequested = false;

export function SearchField({
  size = 'bar',
  trailing,
  className,
}: {
  size?: SearchFieldSize;
  /** A control inside the field's end (the hero's New). */
  trailing?: ReactNode;
  className?: string;
}) {
  const { view, navigate, words } = useExplorer();
  const current = view.kind === 'search' ? view.q : '';
  const [text, setText] = useState(current);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const look = SIZES[size];

  useLayoutEffect(() => {
    if (size !== 'bar' || !barFocusRequested) return;
    barFocusRequested = false;
    const el = field.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [size]);

  // A view change from elsewhere (the sidebar) shows in the field.
  useEffect(() => {
    setText((t) => (t.trim() === current ? t : current));
  }, [current]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const change = (next: string) => {
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (size === 'hero' && next.trim() !== '') barFocusRequested = true;
      navigateRef.current({ kind: 'search', q: next.trim() });
    }, SEARCH_DEBOUNCE_MS);
  };

  return (
    <div className={`${look.wrap}${className ? ` ${className}` : ''}`}>
      <div
        className={`flex items-center overflow-hidden ${look.box}`}
        onMouseDown={(e) => {
          // A press on the box's padding or glyph puts the caret in the field.
          if (e.target === field.current || (e.target as HTMLElement).closest('button')) return;
          e.preventDefault();
          field.current?.focus();
        }}
      >
        <span aria-hidden className="shrink-0 text-slate-500 dark:text-slate-400">
          <SearchIcon size={look.glyph} />
        </span>
        <input
          ref={field}
          type="search"
          value={text}
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && text) {
              e.preventDefault();
              change('');
            }
          }}
          autoComplete="off"
          spellCheck={false}
          placeholder={`Search ${words.lowerMany} and folders`}
          aria-label="Search"
          data-search-field={size}
          className={`h-full min-w-[8rem] flex-1 bg-transparent ${look.input} text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden`}
        />
        {trailing}
      </div>
    </div>
  );
}
