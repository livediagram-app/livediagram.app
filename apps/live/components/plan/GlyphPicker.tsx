'use client';

// The type editor's Glyph (docs/specs/026-plan/item-types.md "Editing a type"): the glyph set in its categories,
// each under a small heading, with a search over the glyphs' names and keywords. One radio group; each tile is
// named "{Name} glyph" and drawn in the type's colour.
import { useId, useState } from 'react';
import { PLAN_GLYPH_CATEGORIES, glyphMatches, planGlyphLabel } from '@livediagram/items';
import { SearchIcon, TextInput } from '@livediagram/ui';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, accentVars } from './plan-palette';

export function GlyphPicker({
  value,
  colour,
  onChange,
}: {
  value: string;
  colour: string;
  onChange: (glyph: string) => void;
}) {
  const [query, setQuery] = useState('');
  const searchId = useId();
  const shown = PLAN_GLYPH_CATEGORIES.map((c) => ({
    ...c,
    glyphs: c.glyphs.filter((g) => glyphMatches(g, query)),
  })).filter((c) => c.glyphs.length > 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
          <SearchIcon size={14} />
        </span>
        <TextInput
          id={searchId}
          compact
          type="search"
          aria-label="Search glyphs"
          placeholder="Search glyphs"
          className="pl-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Escape clears the search first, leaving the editor open.
            if (e.key === 'Escape' && query) {
              e.stopPropagation();
              setQuery('');
            }
          }}
        />
      </div>
      <div role="radiogroup" aria-label="Glyph" className="flex flex-col gap-2">
        {shown.length === 0 ? (
          <p className="py-2 text-[12px] text-slate-500 dark:text-slate-400">
            No glyphs match “{query.trim()}”.
          </p>
        ) : (
          shown.map((c) => (
            <section key={c.id} aria-label={c.label}>
              <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {c.label}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {c.glyphs.map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={value === g}
                    aria-label={`${planGlyphLabel(g)} glyph`}
                    className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border transition ${
                      value === g
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                    }`}
                    onClick={() => onChange(g)}
                  >
                    <span className={ACCENT_TEXT} style={accentVars(colour)}>
                      <PlanTypeGlyph glyph={g} size={18} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
