'use client';

// The theme list (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel"): every theme in one carousel, nine
// to a page (PagedCarousel), Default first, then the built-in themes in catalogue order, then the owner's custom themes (docs/specs/011-theme/
// custom-themes.md) and a "New Theme" card. No categories: every theme works in light and dark mode alike, so there is
// nothing to sort them by. Hosted by CustomThemePicker, which owns the builder; this list only signals "new" / "edit".
//
// Selection is reported via callbacks; the caller decides what "select" means (apply live). `onCommit` is the
// double-click shortcut (defaults to onSelect when not given).

import type { CustomTheme } from '@liveplanner/api-schema';
import { PagedCarousel } from '@/components/primitives/PagedCarousel';
import { THEMES, type ThemeDefinition } from '@/lib/themes';
import { CustomThemeCard, NewThemeCard, ThemeCard } from '@/components/palette/theme-picker-cards';

// The seasonal themes are worn only through the seasonal looks, so the picker leaves them out.
const PICKER_THEMES = THEMES.filter((t) => !t.seasonal);

/** How many theme tiles one carousel page holds: a 3 x 3 grid. */
const THEMES_PER_PAGE = 9;

type Item =
  | { kind: 'built-in'; theme: ThemeDefinition }
  | { kind: 'custom'; theme: CustomTheme }
  | { kind: 'new' };

const headingClass =
  'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

export function ThemeBrowser({
  themeId,
  onSelect,
  onCommit,
  className,
  customThemes,
  onNewCustomTheme,
  onEditCustomTheme,
  onDeleteCustomTheme,
  onCopyTheme,
}: {
  // The currently-selected theme: a built-in ThemeId or a custom `custom:<uuid>` id.
  themeId: string;
  onSelect: (id: string) => void;
  onCommit?: (id: string) => void;
  className?: string;
  // Custom themes: passing `onNewCustomTheme` turns them on; `customThemes` is the owner's saved list.
  customThemes?: CustomTheme[];
  onNewCustomTheme?: () => void;
  onEditCustomTheme?: (id: string) => void;
  onDeleteCustomTheme?: (id: string) => void;
  // Copy a built-in theme into the builder as a new custom theme. When set, built-in cards show "Copy".
  onCopyTheme?: (theme: ThemeDefinition) => void;
}) {
  const commit = onCommit ?? onSelect;
  // Every tile in one list, paged nine at a time: the built-ins, then the owner's own and the New card.
  const items: Item[] = [
    ...PICKER_THEMES.map((theme): Item => ({ kind: 'built-in', theme })),
    ...(onNewCustomTheme
      ? [
          ...(customThemes ?? []).map((theme): Item => ({ kind: 'custom', theme })),
          { kind: 'new' } as Item,
        ]
      : []),
  ];
  return (
    <div className={className}>
      <PagedCarousel
        items={items}
        perPage={THEMES_PER_PAGE}
        label="Themes"
        heading={<h3 className={headingClass}>Themes</h3>}
        gridClass="grid grid-cols-3 gap-2"
        // Open on the page holding the current theme.
        initialIndex={items.findIndex((it) => it.kind !== 'new' && it.theme.id === themeId)}
        renderItem={(it) =>
          it.kind === 'built-in' ? (
            <ThemeCard
              key={it.theme.id}
              theme={it.theme}
              active={themeId === it.theme.id}
              onSelect={() => onSelect(it.theme.id)}
              onCommit={() => commit(it.theme.id)}
              onCopy={onCopyTheme ? () => onCopyTheme(it.theme) : undefined}
            />
          ) : it.kind === 'custom' ? (
            <CustomThemeCard
              key={it.theme.id}
              theme={it.theme}
              active={themeId === it.theme.id}
              onApply={() => onSelect(it.theme.id)}
              onCommit={() => commit(it.theme.id)}
              onEdit={() => onEditCustomTheme?.(it.theme.id)}
              // The host asks first, and falls the selection back to Default only once the delete is confirmed:
              // switching here would leave the tab on Default after a Cancel.
              onDelete={() => onDeleteCustomTheme?.(it.theme.id)}
            />
          ) : (
            <NewThemeCard key="new" onClick={() => onNewCustomTheme?.()} />
          )
        }
      />
    </div>
  );
}
