'use client';

// The theme list (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel"): every theme in one grid, Default
// first, then the built-in themes in catalogue order, then the owner's custom themes (docs/specs/011-theme/
// custom-themes.md) and a "New theme" card. No categories: every theme works in light and dark mode alike, so there is
// nothing to sort them by. Hosted by CustomThemePicker, which owns the builder; this list only signals "new" / "edit".
//
// Selection is reported via callbacks; the caller decides what "select" means (apply live). `onCommit` is the
// double-click shortcut (defaults to onSelect when not given).

import type { CustomTheme } from '@livediagram/api-schema';
import { THEMES, type ThemeDefinition } from '@/lib/themes';
import { CustomThemeCard, NewThemeCard, ThemeCard } from '@/components/palette/theme-picker-cards';

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
  return (
    <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${className ?? ''}`}>
      {THEMES.map((t) => (
        <ThemeCard
          key={t.id}
          theme={t}
          active={themeId === t.id}
          onSelect={() => onSelect(t.id)}
          onCommit={() => commit(t.id)}
          onCopy={onCopyTheme ? () => onCopyTheme(t) : undefined}
        />
      ))}
      {onNewCustomTheme
        ? (customThemes ?? []).map((t) => (
            <CustomThemeCard
              key={t.id}
              theme={t}
              active={themeId === t.id}
              onApply={() => onSelect(t.id)}
              onCommit={() => commit(t.id)}
              onEdit={() => onEditCustomTheme?.(t.id)}
              onDelete={() => {
                // Fall the selection back to Default so the host never points at a theme that's about to vanish.
                if (themeId === t.id) onSelect('brand');
                onDeleteCustomTheme?.(t.id);
              }}
            />
          ))
        : null}
      {onNewCustomTheme ? <NewThemeCard onClick={onNewCustomTheme} /> : null}
    </div>
  );
}
