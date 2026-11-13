'use client';

// The rule builder's pickers (docs/specs/026-plan/automations.md "The rule builder"): Add an Action and Pick a Trigger
// share this one dialog. The dialog hero header with the picker's art, a search that narrows the tiles across the
// groups, a rail that scrolls to a group from sm (chips on a phone), and the grouped tiles: each a picture that plays
// on hover, the step's icon, its name and a line on what it does. The arrow keys walk the tiles; Enter picks.

import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button, useMediaQuery } from '@liveplanner/ui';
import { HeroDialogHeader, type HeroArt } from '@liveworkspace/ui/dialog-hero';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { SearchInput } from '@liveworkspace/workbench/components/primitives/SearchInput';

export type PickerTile<K extends string> = {
  key: K;
  name: string;
  line: string;
  icon: ReactNode;
  scene: ReactNode;
};

export type PickerSection<K extends string> = {
  id: string;
  name: string;
  // A note beside the group's name (AI's daily allowance).
  note?: string;
  // Why the group's tiles are dimmed: the rule holds all it may of them.
  full?: string;
  tiles: readonly PickerTile<K>[];
};

const RAIL_ON = 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200';
const RAIL_OFF =
  'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50';
const CHIP_ON =
  'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900';
const CHIP_OFF =
  'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600';
const TILE =
  'flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left outline-none transition duration-micro hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_12px_28px_-12px_rgba(76,29,149,0.28),0_2px_6px_rgba(15,23,42,0.06)] focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-400/50 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-slate-200 disabled:hover:shadow-none motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/60 dark:disabled:hover:border-slate-700';

const fold = (s: string) => s.toLocaleLowerCase();

/** The sections narrowed to the tiles whose name or line holds the query; sections left empty drop out. */
function searchSections<K extends string>(
  sections: readonly PickerSection<K>[],
  query: string,
): PickerSection<K>[] {
  const q = fold(query.trim());
  if (!q) return [...sections];
  return sections
    .map((s) => ({
      ...s,
      tiles: s.tiles.filter((t) => fold(t.name).includes(q) || fold(t.line).includes(q)),
    }))
    .filter((s) => s.tiles.length > 0);
}

export function StepPicker<K extends string>({
  title,
  line,
  art,
  noun,
  emptyHint,
  sections,
  current,
  onPick,
  onClose,
}: {
  title: string;
  // The header's line under the title (for screen readers alone on a phone).
  line: string;
  // The header's art and title mark (AddActionHeroArt, AutomationsHeroArt).
  art: HeroArt;
  // What a tile is, for the search and the rail: "action", "trigger".
  noun: string;
  // The empty search's suggestion: "Try another word, such as “label”".
  emptyHint: string;
  sections: readonly PickerSection<K>[];
  // The step's kind now, badged Current.
  current?: K | undefined;
  onPick: (key: K) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const phone = useMediaQuery('(max-width: 639.98px)');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string>('all');
  const shown = useMemo(() => searchSections(sections, query), [sections, query]);
  const scroller = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<string, HTMLElement>());
  const groupsLabel = `${noun.charAt(0).toUpperCase()}${noun.slice(1)} groups`;

  // The tiles in reading order, for the arrow keys.
  const tiles = () =>
    Array.from(scroller.current?.querySelectorAll<HTMLButtonElement>('[data-picker-tile]') ?? []);
  const columns = () => {
    const grid = scroller.current?.querySelector<HTMLElement>('[data-picker-grid]');
    if (!grid) return 1;
    return Math.max(
      1,
      getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
    );
  };
  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = tiles();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const step =
      e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowLeft'
          ? -1
          : e.key === 'ArrowDown'
            ? columns()
            : e.key === 'ArrowUp'
              ? -columns()
              : 0;
    if (!step) return;
    e.preventDefault();
    // A full group's tiles are disabled and take no focus: the keys walk past them.
    let next = at + step;
    while (next >= 0 && next < list.length && list[next]!.disabled) next += step;
    if (next < 0) {
      scroller.current
        ?.closest('[data-dialog-panel]')
        ?.querySelector<HTMLInputElement>('input')
        ?.focus();
      return;
    }
    if (next >= list.length) {
      next = list.length - 1;
      while (next > at && list[next]!.disabled) next -= 1;
    }
    list[next]?.focus();
  };
  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      tiles()[0]?.focus();
    } else if (e.key === 'Enter') {
      const first = shown.find((s) => !s.full)?.tiles[0];
      if (first) {
        e.preventDefault();
        onPick(first.key);
      }
    }
  };

  const jump = (id: string) => {
    setActive(id);
    const box = scroller.current;
    if (!box) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const top = id === 'all' ? 0 : (refs.current.get(id)?.offsetTop ?? 0) - box.offsetTop;
    box.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  };
  // The rail follows the scroll: the last group whose heading has reached the top.
  const onScroll = () => {
    const box = scroller.current;
    if (!box || query) return;
    if (box.scrollTop < 4) return setActive('all');
    let at = 'all';
    for (const s of shown) {
      const el = refs.current.get(s.id);
      if (el && el.offsetTop - box.offsetTop <= box.scrollTop + 24) at = s.id;
    }
    setActive(at);
  };

  const nav = [{ id: 'all', name: 'All' }, ...sections.map((s) => ({ id: s.id, name: s.name }))];

  return (
    <Dialog
      open
      onClose={onClose}
      titleId={titleId}
      size="3xl"
      phoneSheet
      initialFocus="first"
      className="max-h-[min(44rem,calc(100dvh-2rem))] overflow-hidden"
    >
      {/* The dialog hero header (dialog-hero-header.md), under the sheet's handle on a phone. Only the close stands
          beside the title, so the centre piece moves out to 4.5rem from the edge. */}
      <HeroDialogHeader
        art={art}
        titleId={titleId}
        title={title}
        subtitle={line}
        onClose={onClose}
        underHandle
        className="[--hero-centre-end:4.5rem]"
      />
      <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-3 dark:border-slate-800">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            setActive('all');
            scroller.current?.scrollTo({ top: 0 });
          }}
          placeholder={`Find ${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`}
          ariaLabel={`Find ${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`}
          clearAriaLabel="Clear Search"
          clearDescription={`Show every ${noun} again.`}
          onKeyDown={onSearchKey}
          autoFocus
        />
        {phone && !query ? (
          <div
            role="group"
            aria-label={groupsLabel}
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5"
          >
            {nav.map((n) => (
              <button
                key={n.id}
                type="button"
                aria-pressed={active === n.id}
                onClick={() => jump(n.id)}
                className={`h-[30px] shrink-0 cursor-pointer rounded-full border px-3 text-[12px] font-medium transition ${active === n.id ? CHIP_ON : CHIP_OFF}`}
              >
                {n.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1">
        {phone ? null : (
          <nav
            aria-label={groupsLabel}
            className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-slate-100 p-3 dark:border-slate-800"
          >
            {nav.map((n) => (
              <button
                key={n.id}
                type="button"
                aria-current={active === n.id ? 'true' : undefined}
                disabled={Boolean(query)}
                onClick={() => jump(n.id)}
                className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium transition disabled:cursor-default disabled:opacity-50 ${active === n.id && !query ? RAIL_ON : RAIL_OFF}`}
              >
                {n.name}
              </button>
            ))}
          </nav>
        )}
        <div
          ref={scroller}
          onScroll={onScroll}
          onKeyDown={onGridKey}
          className="relative min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4"
        >
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center animate-fade-in">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                No {noun}s match
              </p>
              <p className="text-[13px] text-slate-500 dark:text-slate-400">{emptyHint}</p>
              <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                Clear Search
              </Button>
            </div>
          ) : (
            <div key={query ? 'search' : 'all'} className="flex flex-col gap-5">
              {shown.map((s) => (
                <section
                  key={s.id}
                  aria-labelledby={`${titleId}-${s.id}`}
                  ref={(el) => {
                    if (el) refs.current.set(s.id, el);
                    else refs.current.delete(s.id);
                  }}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-baseline justify-between gap-3 px-0.5">
                    <h3
                      id={`${titleId}-${s.id}`}
                      className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400"
                    >
                      {s.name}
                    </h3>
                    {s.full ? (
                      <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                        {s.full}
                      </span>
                    ) : s.note ? (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {s.note}
                      </span>
                    ) : null}
                  </div>
                  <ul
                    data-picker-grid=""
                    className="lvd-cascade grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {s.tiles.map((t) => (
                      <li key={t.key} className="flex">
                        <button
                          type="button"
                          data-picker-tile={t.key}
                          disabled={Boolean(s.full)}
                          aria-current={t.key === current ? 'true' : undefined}
                          onClick={() => onPick(t.key)}
                          className={TILE}
                        >
                          {t.scene}
                          <span className="flex items-start gap-2.5 px-3 pb-3 pt-2.5">
                            {t.icon}
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900 dark:text-slate-50">
                                {t.name}
                                {t.key === current ? (
                                  <span className="rounded-full bg-brand-100 px-1.5 py-px text-[10px] font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                                    Current
                                  </span>
                                ) : null}
                              </span>
                              <span className="text-[12px] leading-snug text-slate-500 dark:text-slate-400">
                                {t.line}
                              </span>
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
