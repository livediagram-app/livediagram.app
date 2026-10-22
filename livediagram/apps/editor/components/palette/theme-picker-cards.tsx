// Card primitives for the flat theme list (ThemeBrowser): a selectable ThemeCard (swatch + label), a custom
// theme's card with its edit / delete actions, and the "New Theme" card.

import type { CustomTheme } from '@livediagram/api-schema';
import { CopyIcon, PencilIcon, PlusIcon, TrashIcon } from '@livediagram/ui';
import { type ThemeDefinition } from '@/lib/themes';
import { themeDescription } from '@/lib/themes-taxonomy';
import { materialiseCustomTheme } from '@/lib/custom-theme-registry';
import { ThemeSwatch } from '@/components/primitives/ThemeSwatch';

// A single selectable theme tile. Click selects; double-click is the
// commit shortcut (select + Create in one gesture).
export function ThemeCard({
  theme,
  active,
  onSelect,
  onCommit,
  // When provided, a hover "Copy" button (top-right) opens the theme
  // builder seeded with this theme's options (docs/specs/011-theme/custom-themes.md).
  onCopy,
}: {
  theme: ThemeDefinition;
  active: boolean;
  onSelect: () => void;
  onCommit: () => void;
  onCopy?: () => void;
}) {
  const description = themeDescription(theme.id);
  return (
    <div
      className={
        'group relative flex flex-col rounded-lg border text-left transition ' +
        (active
          ? 'border-2 border-brand-400 bg-brand-50 dark:border-brand-500 dark:bg-brand-500/15'
          : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10')
      }
    >
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={onCommit}
        aria-pressed={active}
        className="flex flex-col items-start gap-1.5 p-2 text-left"
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
      {onCopy ? (
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${theme.label} to a new theme`}
          className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-1 text-[10px] font-semibold text-slate-600 opacity-0 shadow-sm transition hover:text-brand-700 focus:opacity-100 group-hover:opacity-100 dark:bg-slate-900/85 dark:text-slate-200 [@media(hover:none)]:opacity-100"
        >
          <CopyIcon size={11} />
          Copy
        </button>
      ) : null}
    </div>
  );
}

// A saved custom theme (docs/specs/011-theme/custom-themes.md) in the Custom category drill-in: its
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
      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${theme.name}`}
          className="rounded bg-white/90 p-0.5 text-slate-500 shadow-sm hover:text-brand-700 dark:bg-slate-800/90 dark:text-slate-300"
        >
          <PencilIcon size={12} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${theme.name}`}
          className="rounded bg-white/90 p-0.5 text-slate-500 shadow-sm hover:text-brand-700 dark:bg-slate-800/90 dark:text-slate-300"
        >
          <TrashIcon size={12} />
        </button>
      </div>
    </div>
  );
}

// The "+ New Theme" tile in the Custom category drill-in: opens the
// theme builder. Laid out like CustomThemeCard (a swatch-height block +
// a label beneath) so it sits consistently in the grid with the saved
// theme tiles, just dashed + a plus where the swatch would be.
export function NewThemeCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-1 rounded-md border border-dashed border-slate-300 p-1.5 text-left transition hover:border-brand-400 hover:bg-brand-50/40 dark:border-slate-600 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10"
    >
      <span className="flex h-20 w-full items-center justify-center rounded-md bg-slate-50 text-slate-400 transition group-hover:text-brand-700 dark:bg-slate-800/60 dark:group-hover:text-brand-300">
        <PlusIcon size={18} />
      </span>
      <span className="w-full truncate text-center text-[10px] font-medium text-slate-600 dark:text-slate-300">
        New Theme
      </span>
    </button>
  );
}
