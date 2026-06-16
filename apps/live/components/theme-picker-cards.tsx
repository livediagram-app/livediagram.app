// Card primitives for the theme picker's two-level browse, mirroring
// template-picker-cards: a selectable ThemeCard (swatch + label) and a
// ThemeCategoryCard (a sampler of the category's swatches that drills
// into it). Lifted out of TemplatePicker so the same card renders across
// the overview and the category detail view.

import type { CustomTheme } from '@livediagram/api-schema';
import { type ThemeDefinition, themeDescription } from '@/lib/themes';
import { materialiseCustomTheme } from '@/lib/custom-theme-registry';
import { ThemeSwatch } from './ThemeSwatch';

// A single selectable theme tile. Click selects; double-click is the
// commit shortcut (select + Create in one gesture).
export function ThemeCard({
  theme,
  active,
  onSelect,
  onCommit,
}: {
  theme: ThemeDefinition;
  active: boolean;
  onSelect: () => void;
  onCommit: () => void;
}) {
  const description = themeDescription(theme.id);
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onCommit}
      aria-pressed={active}
      className={
        active
          ? 'flex flex-col items-start gap-1.5 rounded-lg border-2 border-brand-400 bg-brand-50 p-2 text-left dark:border-brand-500 dark:bg-brand-500/15'
          : 'flex flex-col items-start gap-1.5 rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10'
      }
    >
      <div className="w-full">
        <ThemeSwatch theme={theme} size="md" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
          {theme.label}
        </p>
        {description ? (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-300">
            {description}
          </p>
        ) : null}
      </div>
    </button>
  );
}

// The Basic quick-pick on the theme overview, sized + laid out exactly
// like a ThemeCategoryCard (hero swatch + label + description) so it
// doesn't read as an odd small tile next to the category cards. Unlike a
// category card it's directly selectable (click selects; double-click
// commits) and shows an active state.
export function ThemeQuickPickCard({
  theme,
  label,
  description,
  active,
  onSelect,
  onCommit,
}: {
  theme: ThemeDefinition;
  label: string;
  description: string;
  active: boolean;
  onSelect: () => void;
  onCommit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onCommit}
      aria-pressed={active}
      className={
        active
          ? 'flex flex-col items-start gap-1.5 rounded-lg border-2 border-brand-400 bg-brand-50 p-2 text-left dark:border-brand-500 dark:bg-brand-500/15'
          : 'flex flex-col items-start gap-1.5 rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10'
      }
    >
      <div className="w-full">
        {/* Match the category cards' 2×2 sampler height (two h-9 rows +
            gap) so Basic doesn't tower over the other tiles on the row. */}
        <ThemeSwatch theme={theme} heightClass="h-[4.75rem]" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{label}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-300">
          {description}
        </p>
      </div>
    </button>
  );
}

// A saved custom theme (spec/44) in the Custom category drill-in: its
// swatch preview + name, click to apply, with hover Edit / Delete
// affordances. Lives here with the other theme-picker card primitives so
// the browser and any other host render the exact same tile.
export function CustomThemeCard({
  theme,
  active,
  onApply,
  onCommit,
  onEdit,
  onDelete,
}: {
  theme: CustomTheme;
  active: boolean;
  onApply: () => void;
  onCommit: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={
        'group relative flex flex-col gap-1 rounded-md border p-1.5 text-left transition ' +
        (active
          ? 'border-2 border-brand-400 bg-brand-50 dark:border-brand-500 dark:bg-brand-500/15'
          : 'border-slate-200 hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10')
      }
    >
      <button
        type="button"
        onClick={onApply}
        onDoubleClick={onCommit}
        aria-pressed={active}
        className="flex flex-col items-center gap-1"
        aria-label={theme.name}
      >
        <ThemeSwatch theme={materialiseCustomTheme(theme)} size="md" />
        <span className="w-full truncate text-center text-[10px] font-medium text-slate-700 dark:text-slate-300">
          {theme.name}
        </span>
      </button>
      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${theme.name}`}
          className="rounded bg-white/90 p-0.5 text-slate-500 shadow-sm hover:text-brand-600 dark:bg-slate-800/90 dark:text-slate-300"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            aria-hidden
          >
            <path d="M11.5 2.5l2 2L6 12l-3 1 1-3z" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${theme.name}`}
          className="rounded bg-white/90 p-0.5 text-slate-500 shadow-sm hover:text-rose-600 dark:bg-slate-800/90 dark:text-slate-300"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            aria-hidden
          >
            <path
              d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.5 8h5l.5-8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// The "+ New theme" tile in the Custom category drill-in: opens the
// theme builder.
export function NewThemeCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-500/60 dark:hover:text-brand-300"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
      </svg>
      <span className="text-[10px] font-medium">New theme</span>
    </button>
  );
}

// A category tile on the theme overview: a 2×2 sampler of the category's
// swatches as the illustration, plus the label, a count and a one-line
// description. Clicking it drills into the category.
export function ThemeCategoryCard({
  label,
  description,
  count,
  themes,
  selected,
  onOpen,
}: {
  label: string;
  description: string;
  count: number;
  themes: ThemeDefinition[];
  // True when the currently-selected theme lives in this category, so the
  // card reads as "your selection is in here" on the overview.
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Browse ${label} themes`}
      aria-pressed={selected}
      className={
        selected
          ? 'flex flex-col items-start gap-1.5 rounded-lg border-2 border-brand-400 bg-brand-50 p-2 text-left dark:border-brand-500 dark:bg-brand-500/15'
          : 'flex flex-col items-start gap-1.5 rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10'
      }
    >
      {/* Always a full 2×2 sampler so categories with fewer than four
          themes (Formal has one, Custom can have none) keep the same
          footprint + visual weight as Cool / Warm / etc. — empty slots
          render as muted placeholders rather than collapsing the grid. */}
      <div className="grid w-full grid-cols-2 gap-1">
        {Array.from({ length: 4 }, (_, i) => {
          const theme = themes[i];
          return theme ? (
            <ThemeSwatch key={theme.id} theme={theme} size="sm" />
          ) : (
            <span
              key={`placeholder-${i}`}
              aria-hidden
              className="h-9 w-full rounded-md border border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
            />
          );
        })}
      </div>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
            {label}
          </p>
          <span className="shrink-0 text-[11px] font-medium text-slate-400 dark:text-slate-300">
            {count}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-300">
          {description}
        </p>
      </div>
    </button>
  );
}
