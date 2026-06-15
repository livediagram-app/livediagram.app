'use client';

// The theme picker's two-level category browse: an overview (Basic
// quick-pick + a card per colour-temperament category, plus an optional
// Custom category) that drills into a category's themes with a Back
// affordance. Lifted out of TemplatePicker so the exact same browse
// renders in both the New-diagram picker (spec/14) and the Theme tab of
// the right-click CanvasThemeDialog (spec/42), so the two can't drift.
//
// Custom themes (spec/44) appear as a "Custom" category when the custom
// props are wired: its drill-in lists the owner's saved themes (apply /
// edit / delete) plus a "+ New theme" tile that opens the builder. The
// builder itself is owned by the host (CustomThemePicker); this browser
// only signals "new" / "edit" via callbacks.
//
// Selection is reported via callbacks; the caller decides what "select"
// means (set local state vs apply live). `onCommit` is the double-click
// shortcut (defaults to onSelect when not given).

import { useState } from 'react';
import type { CustomTheme } from '@livediagram/api-schema';
import { isCustomThemeId, materialiseCustomTheme } from '@/lib/custom-theme-registry';
import { shufflePinned } from '@/lib/shuffle';
import {
  THEME_CATEGORIES,
  THEMES,
  type ThemeCategory,
  type ThemeId,
  themeCategory,
} from '@/lib/themes';
import { AnimatedHeightBox } from './AnimatedHeightBox';
import {
  CustomThemeCard,
  NewThemeCard,
  ThemeCard,
  ThemeCategoryCard,
  ThemeQuickPickCard,
} from './theme-picker-cards';

// Drill-in target: a built-in category, the Custom bucket, or the overview.
type OpenCategory = ThemeCategory | 'custom' | null;

export function ThemeCategoryBrowser({
  themeId,
  onSelect,
  onCommit,
  className,
  // Custom themes (spec/44). Passing `onNewCustomTheme` turns on the
  // Custom category; `customThemes` is the owner's saved list.
  customThemes,
  onNewCustomTheme,
  onEditCustomTheme,
  onDeleteCustomTheme,
}: {
  // The currently-selected theme: a built-in ThemeId or a custom
  // `custom:<uuid>` id, so it's widened to string.
  themeId: string;
  onSelect: (id: string) => void;
  onCommit?: (id: string) => void;
  className?: string;
  customThemes?: CustomTheme[];
  onNewCustomTheme?: () => void;
  onEditCustomTheme?: (id: string) => void;
  onDeleteCustomTheme?: (id: string) => void;
}) {
  const customEnabled = !!onNewCustomTheme;
  const custom = customThemes ?? [];
  const themeIsCustom = isCustomThemeId(themeId);

  // Drill-in state: null is the overview. Open the active theme's
  // category on mount so it lands highlighted rather than buried: the
  // Custom bucket for a custom theme, its colour category otherwise.
  const [openCategory, setOpenCategory] = useState<OpenCategory>(() => {
    if (themeIsCustom) return customEnabled ? 'custom' : null;
    return themeId !== 'brand' ? themeCategory(themeId as ThemeId) : null;
  });
  // Rotate which themes greet the user on each open (Basic always pinned
  // first). Shuffled once per mount via lazy useState so clicking around
  // never reshuffles it underfoot.
  const [themes] = useState(() => shufflePinned(THEMES, (t) => t.id === 'brand'));
  const commit = onCommit ?? onSelect;
  const brandTheme = THEMES.find((t) => t.id === 'brand');
  const themeCategoryThemes = (category: ThemeCategory) =>
    themes.filter((t) => t.id !== 'brand' && themeCategory(t.id) === category);

  return (
    <AnimatedHeightBox viewKey={openCategory ?? 'overview'} className={className}>
      {openCategory === 'custom' ? (
        <>
          <BackButton onClick={() => setOpenCategory(null)} />
          <p className="mb-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            Build your own theme: your saved themes appear here and apply to any diagram, just like
            a built-in one.
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {custom.map((t) => (
              <CustomThemeCard
                key={t.id}
                theme={t}
                active={themeId === t.id}
                onApply={() => onSelect(t.id)}
                onCommit={() => commit(t.id)}
                onEdit={() => onEditCustomTheme?.(t.id)}
                onDelete={() => {
                  // Fall the selection back to Basic so the host never
                  // points at a theme that's about to vanish.
                  if (themeId === t.id) onSelect('brand');
                  onDeleteCustomTheme?.(t.id);
                }}
              />
            ))}
            <NewThemeCard onClick={() => onNewCustomTheme?.()} />
          </div>
        </>
      ) : openCategory ? (
        <>
          <BackButton onClick={() => setOpenCategory(null)} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {themeCategoryThemes(openCategory).map((t) => (
              <ThemeCard
                key={t.id}
                theme={t}
                active={themeId === t.id}
                onSelect={() => onSelect(t.id)}
                onCommit={() => commit(t.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {brandTheme ? (
            <ThemeQuickPickCard
              theme={brandTheme}
              label="Basic"
              description="The plain, un-themed default."
              active={themeId === 'brand'}
              onSelect={() => onSelect('brand')}
              onCommit={() => commit('brand')}
            />
          ) : null}
          {THEME_CATEGORIES.map((cat) => {
            const items = themeCategoryThemes(cat.id);
            if (items.length === 0) return null;
            return (
              <ThemeCategoryCard
                key={cat.id}
                label={cat.label}
                description={cat.description}
                count={items.length}
                themes={items}
                selected={
                  !themeIsCustom &&
                  themeId !== 'brand' &&
                  themeCategory(themeId as ThemeId) === cat.id
                }
                onOpen={() => setOpenCategory(cat.id)}
              />
            );
          })}
          {customEnabled ? (
            <ThemeCategoryCard
              label="Custom"
              description="Your saved themes, plus build your own."
              count={custom.length}
              themes={custom.map(materialiseCustomTheme)}
              selected={themeIsCustom}
              onOpen={() => setOpenCategory('custom')}
            />
          ) : null}
        </div>
      )}
    </AnimatedHeightBox>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-2 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path
          d="M7.5 2.5 4 6l3.5 3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      All themes
    </button>
  );
}
