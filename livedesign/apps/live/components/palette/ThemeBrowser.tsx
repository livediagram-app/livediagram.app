'use client';

// The theme list (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel"): every built-in theme in one
// carousel, nine to a page (PagedCarousel), Default first, then the rest in catalogue order. No categories: every
// theme works in light and dark mode alike, so there is nothing to sort them by.
//
// Selection is reported via callbacks; the caller decides what "select" means (apply live). `onCommit` is the
// double-click shortcut (defaults to onSelect when not given).

import { PagedCarousel } from '@/components/primitives/PagedCarousel';
import { getTheme, THEMES } from '@/lib/themes';
import { ThemeCard } from '@/components/palette/theme-picker-cards';

// The seasonal themes are worn only through the seasonal looks, so the picker leaves them out.
const PICKER_THEMES = THEMES.filter((t) => !t.seasonal);

/** How many theme tiles one carousel page holds: a 3 x 3 grid. */
const THEMES_PER_PAGE = 9;

const headingClass =
  'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

export function ThemeBrowser({
  themeId,
  onSelect,
  onCommit,
  className,
}: {
  // The currently-selected theme id. One that names no theme (a removed custom theme's `custom:<uuid>`) renders as
  // Default, so Default's card shows as selected.
  themeId: string;
  onSelect: (id: string) => void;
  onCommit?: (id: string) => void;
  className?: string;
}) {
  const commit = onCommit ?? onSelect;
  const current = getTheme(themeId).id;
  return (
    <div className={className}>
      <PagedCarousel
        items={PICKER_THEMES}
        perPage={THEMES_PER_PAGE}
        label="Themes"
        heading={<h3 className={headingClass}>Themes</h3>}
        gridClass="grid grid-cols-3 gap-2"
        // Open on the page holding the current theme.
        initialIndex={PICKER_THEMES.findIndex((theme) => theme.id === current)}
        renderItem={(theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            active={current === theme.id}
            onSelect={() => onSelect(theme.id)}
            onCommit={() => commit(theme.id)}
          />
        )}
      />
    </div>
  );
}
