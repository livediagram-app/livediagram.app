// The card for the flat theme list (ThemeBrowser): a selectable ThemeCard (swatch + label).

import { type ThemeDefinition } from '@/lib/themes';
import { themeDescription } from '@/lib/themes-taxonomy';
import { ThemeSwatch } from '@/components/primitives/ThemeSwatch';

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
    </div>
  );
}
