'use client';

import { ctaHref } from '@livediagram/api-schema';
import { editorModeLabel } from '@livediagram/document';
import { TemplatePreview } from '@livediagram/template-previews';
import { templateCreateHref, type TemplateKind } from '@livediagram/templates';
import { EDITOR_MODE_ICONS, Glyph, StartBlankMenu } from '@livediagram/ui';
import { useDeferredValue, useId, useRef, useState, type KeyboardEvent } from 'react';
import { heroSearch } from '@/lib/hero-starts';

// The hero's template search (docs/specs/019-marketing/marketing-site.md "Hero"): a search form whose
// best matches list under the bar as real links, each creating its template. Enter opens the top
// match, Down moves into the list (Up and Down walk it, Up off the top returns to the box), Escape
// clears the box. The list shows while focus is inside the search and the box holds a query. The
// header's Start Blank menu sits inside the bar, its rows reported as the hero's own funnel slots.

const createHref = (kind: TemplateKind) => ctaHref(templateCreateHref(kind), 'Home.HeroSearch');

export function HeroSearch() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  // The list follows the box a beat behind, so a fast typist never waits on five previews mounting.
  const shown = useDeferredValue(query);
  const matches = heroSearch(shown);
  const open = focused && shown.trim() !== '';
  const listId = useId();
  const statusId = useId();
  const rootRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const links = () => [
    ...(rootRef.current?.querySelectorAll<HTMLAnchorElement>('[data-hero-result]') ?? []),
  ];
  const onKeyDown = (e: KeyboardEvent) => {
    // Only the box and the results: the Start Blank menu in the bar keeps its own keys.
    const target = e.target as HTMLElement;
    if (target !== inputRef.current && !target.hasAttribute('data-hero-result')) return;
    if (e.key === 'Escape') {
      setQuery('');
      inputRef.current?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const all = links();
    if (all.length === 0) return;
    e.preventDefault();
    const at = all.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === 'ArrowDown') all[Math.min(at + 1, all.length - 1)]?.focus();
    else if (at <= 0) inputRef.current?.focus();
    else all[at - 1]?.focus();
  };

  return (
    <form
      ref={rootRef}
      role="search"
      aria-label="Templates"
      onSubmit={(e) => {
        e.preventDefault();
        const top = heroSearch(query)[0];
        if (top) window.location.assign(createHref(top.kind));
      }}
      onKeyDown={onKeyDown}
      // The results are for the box and the list: focus moving to the Start Blank menu in the bar
      // closes them, so picking a blank never shows the matches for what was typed.
      onFocus={(e) => setFocused(!(e.target as HTMLElement).closest('[data-hero-blank]'))}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget)) setFocused(false);
      }}
      className="relative mx-auto mt-12 w-full max-w-2xl text-left"
    >
      <div
        data-hero-anchor="target"
        className="flex h-16 items-center gap-3 rounded-2xl bg-white pl-5 pr-2 shadow-[0_0_0_4px_var(--hero-ring)] transition-shadow focus-within:shadow-[0_0_0_4px_var(--hero-ring-focus)]"
      >
        <Glyph size={20} units={24} className="shrink-0 text-slate-500">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20 L16 16" />
        </Glyph>
        <label htmlFor="hero-search" className="sr-only">
          Search templates
        </label>
        <input
          ref={inputRef}
          id="hero-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates"
          autoComplete="off"
          aria-controls={listId}
          aria-describedby={statusId}
          className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-500 sm:text-lg [&::-webkit-search-cancel-button]:hidden"
        />
        <span data-hero-blank="" className="contents">
          <StartBlankMenu
            ctaSurface="Home"
            place="HeroBlank"
            triggerClassName="inline-flex h-12 cursor-pointer items-center gap-2 rounded-xl bg-(--hero-cta) px-4 text-sm font-semibold text-white transition-colors hover:bg-(--hero-cta-hover) sm:px-5 sm:text-base"
          />
        </span>
      </div>

      {/* Said once the list settles, for a screen reader: how many matched, or that none did. */}
      <p id={statusId} aria-live="polite" className="sr-only">
        {open
          ? matches.length > 0
            ? `${matches.length} templates match. Press Enter to open the first, or Down to choose.`
            : 'No templates match.'
          : ''}
      </p>

      <div
        id={listId}
        hidden={!open}
        className="absolute inset-x-0 top-[4.75rem] z-30 rounded-2xl bg-white p-2 text-slate-900 border border-sky-100 shadow-[0_30px_60px_-20px_var(--hero-card-shadow)] dark:border-transparent"
      >
        {matches.length > 0 ? (
          <ul aria-label="Matching templates" className="flex flex-col">
            {matches.map((t) => {
              const ModeIcon = EDITOR_MODE_ICONS[t.mode];
              return (
                <li key={t.kind}>
                  <a
                    data-hero-result=""
                    href={createHref(t.kind)}
                    className="flex items-center gap-4 rounded-xl px-3 py-2.5 outline-none hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <span className="flex h-12 w-[4.5rem] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 [&>svg]:h-9 [&>svg]:w-auto">
                      <TemplatePreview kind={t.kind} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{t.title}</span>
                      <span className="block truncate text-sm text-slate-600">{t.description}</span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 sm:inline-flex">
                      <ModeIcon size={13} aria-hidden />
                      {editorModeLabel(t.mode)}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-3 py-3 text-[15px] text-slate-700">
            Nothing matches &ldquo;{shown.trim()}&rdquo;. Start from a blank, or browse every
            template below.
          </p>
        )}
        <a
          data-hero-result=""
          href="#templates"
          className="mt-1 flex items-center justify-between rounded-xl border-t border-slate-100 px-3 py-3 text-sm font-medium text-blue-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          Browse every template
          <span aria-hidden>↓</span>
        </a>
      </div>
    </form>
  );
}
