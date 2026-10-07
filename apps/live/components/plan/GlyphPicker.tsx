'use client';

// The type editor's Glyph (docs/specs/026-plan/item-types.md "Editing a type"): one field-sized button showing the
// chosen glyph (on a tint of the type's colour) and its name, opening a popover under it (AnchoredPopover, so the
// editor's scrolling body never clips it) with Search glyphs and a category menu on one row, over one dense grid of
// the chosen category's glyphs; a search covers every category. Opening focuses the search; a pick closes it and
// hands focus back to the button, as do Escape (the editor stays open) and a press outside. One radio group; each
// tile is named "{Name} glyph".
import { useEffect, useId, useRef, useState } from 'react';
import { PLAN_GLYPH_CATEGORIES, glyphMatches, planGlyphLabel } from '@livediagram/items';
import { ChevronDownIcon, SearchIcon, Select, TextInput, Tooltip } from '@livediagram/ui';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, ACCENT_TINT, accentVars } from './plan-palette';

// The category menu's value for every glyph at once.
const ALL = 'all';

// Ten 32px tiles to a row, with the popover's padding.
const GLYPH_POPOVER_PX = 352;

const categoryOf = (glyph: string) =>
  PLAN_GLYPH_CATEGORIES.find((c) => (c.glyphs as readonly string[]).includes(glyph))?.id ??
  PLAN_GLYPH_CATEGORIES[0]!.id;

export function GlyphPicker({
  value,
  colour,
  onChange,
}: {
  value: string;
  colour: string;
  onChange: (glyph: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Held in state so the popover anchors on its first render.
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const name = planGlyphLabel(value);
  return (
    <>
      <button
        ref={setTrigger}
        type="button"
        aria-label={`Glyph: ${name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white py-1 pl-1 pr-2 text-left text-[13px] text-slate-800 transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span
          aria-hidden
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${ACCENT_TINT} ${ACCENT_TEXT}`}
          style={accentVars(colour)}
        >
          <PlanTypeGlyph glyph={value} size={16} />
        </span>
        <span className="min-w-28 truncate">{name}</span>
        <ChevronDownIcon className="shrink-0 text-slate-400" />
      </button>
      {open && trigger ? (
        <AnchoredPopover
          anchor={trigger}
          name="Glyph"
          width={GLYPH_POPOVER_PX}
          onClose={() => setOpen(false)}
        >
          <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
            <GlyphGrid
              value={value}
              colour={colour}
              onPick={(g) => {
                onChange(g);
                setOpen(false);
                trigger.focus();
              }}
            />
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}

// The panel's body: the search and category menu, and the grid. Exported for its tests.
export function GlyphGrid({
  value,
  colour,
  onPick,
}: {
  value: string;
  colour: string;
  onPick: (glyph: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(() => categoryOf(value));
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => searchRef.current?.focus(), []);
  // A search covers every category; otherwise the chosen category, or every glyph for All.
  const searching = query.trim().length > 0;
  const glyphs =
    searching || category === ALL
      ? PLAN_GLYPH_CATEGORIES.flatMap((c) => c.glyphs.filter((g) => glyphMatches(g, query)))
      : (PLAN_GLYPH_CATEGORIES.find((c) => c.id === category)?.glyphs ?? []);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <SearchIcon size={14} />
          </span>
          <TextInput
            ref={searchRef}
            id={searchId}
            compact
            type="search"
            aria-label="Search glyphs"
            placeholder="Search glyphs"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select
          aria-label="Glyph category"
          size="sm"
          className="w-36 shrink-0"
          selectClassName="h-full text-[12px]"
          value={searching ? ALL : category}
          onChange={(e) => {
            setQuery('');
            setCategory(e.target.value);
          }}
        >
          <option value={ALL}>All glyphs</option>
          {PLAN_GLYPH_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      <div
        role="radiogroup"
        aria-label="Glyph"
        className="grid max-h-[8.5rem] grid-cols-[repeat(auto-fill,2rem)] content-start justify-between gap-0.5 overflow-y-auto overscroll-contain"
      >
        {glyphs.length === 0 ? (
          <p className="col-span-full px-1 py-3 text-[12px] text-slate-500 dark:text-slate-400">
            No glyphs match “{query.trim()}”.
          </p>
        ) : (
          glyphs.map((g) => {
            const chosen = value === g;
            return (
              <Tooltip key={g} label={planGlyphLabel(g)}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  aria-label={`${planGlyphLabel(g)} glyph`}
                  className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition ${
                    chosen
                      ? `${ACCENT_TINT} ${ACCENT_TEXT} ring-1 ring-inset ring-[var(--accent)] dark:ring-[var(--accent-lift)]`
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                  }`}
                  style={chosen ? accentVars(colour) : undefined}
                  onClick={() => onPick(g)}
                >
                  <PlanTypeGlyph glyph={g} size={16} />
                </button>
              </Tooltip>
            );
          })
        )}
      </div>
    </div>
  );
}
