// Card primitives for the theme picker's two-level browse, mirroring
// template-picker-cards: a selectable ThemeCard (swatch + label) and a
// ThemeCategoryCard (a sampler of the category's swatches that drills
// into it). Lifted out of TemplatePicker so the same card renders across
// the overview and the category detail view.

import type { ThemeDefinition } from '@/lib/themes';
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
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onCommit}
      aria-pressed={active}
      className={
        active
          ? 'flex flex-col items-center gap-1 rounded-md border-2 border-brand-400 bg-brand-50 p-1.5 text-[10px] font-medium text-brand-800 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-200'
          : 'flex flex-col items-center gap-1 rounded-md border border-slate-200 bg-white p-1.5 text-[10px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10'
      }
    >
      <ThemeSwatch theme={theme} size="md" />
      <span>{theme.label}</span>
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
        <ThemeSwatch theme={theme} size="lg" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{label}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
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
      <div className="grid w-full grid-cols-2 gap-1">
        {themes.slice(0, 4).map((t) => (
          <ThemeSwatch key={t.id} theme={t} size="sm" />
        ))}
      </div>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
            {label}
          </p>
          <span className="shrink-0 text-[11px] font-medium text-slate-400 dark:text-slate-400">
            {count}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
    </button>
  );
}
