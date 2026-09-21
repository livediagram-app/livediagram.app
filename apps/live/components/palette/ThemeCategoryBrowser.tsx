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

import { BackBar } from '@/components/primitives/BackBar';
import { useState } from 'react';
import type { CustomTheme } from '@livediagram/api-schema';
import { isCustomThemeId, materialiseCustomTheme } from '@/lib/custom-theme-registry';
import { darkCategorySchemes, shuffledThemes } from '@/lib/theme-order';
import {
  getTheme,
  THEMES,
  type ThemeCategory,
  type ThemeDefinition,
  type ThemeId,
} from '@/lib/themes';
import { THEME_CATEGORIES, themeCategory } from '@/lib/themes-taxonomy';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { AnimatedHeightBox } from '@/components/primitives/AnimatedHeightBox';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import {
  CustomThemeCard,
  NewThemeCard,
  ThemeCard,
  ThemeCategoryCard,
  ThemeQuickPickCard,
} from '@/components/palette/theme-picker-cards';

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
  initialCategory,
  onNewCustomTheme,
  onEditCustomTheme,
  onDeleteCustomTheme,
  onCopyTheme,
}: {
  // The currently-selected theme: a built-in ThemeId or a custom
  // `custom:<uuid>` id, so it's widened to string.
  themeId: string;
  onSelect: (id: string) => void;
  onCommit?: (id: string) => void;
  className?: string;
  customThemes?: CustomTheme[];
  // Force the drill-in to open on a specific category on mount, overriding
  // the theme-derived default. Used to return to the Custom category after
  // the builder closes even when no custom theme ended up selected.
  initialCategory?: ThemeCategory | 'custom';
  onNewCustomTheme?: () => void;
  onEditCustomTheme?: (id: string) => void;
  onDeleteCustomTheme?: (id: string) => void;
  // Copy a built-in theme into the builder as a new custom theme (spec/44).
  // When set, built-in theme cards show a "Copy" affordance.
  onCopyTheme?: (theme: ThemeDefinition) => void;
}) {
  const customEnabled = !!onNewCustomTheme;
  const custom = customThemes ?? [];
  const themeIsCustom = isCustomThemeId(themeId);

  // Drill-in state: null is the overview. An explicit `initialCategory`
  // wins; otherwise open the active theme's category on mount so it lands
  // highlighted rather than buried (Custom bucket for a custom theme, its
  // colour category otherwise).
  const [openCategory, setOpenCategory] = useState<OpenCategory>(() => {
    if (initialCategory) return initialCategory;
    if (themeIsCustom) return customEnabled ? 'custom' : null;
    return themeId !== 'brand' ? themeCategory(themeId as ThemeId) : null;
  });
  // Rotate which themes greet the user on each open, with the LEADS pinned
  // through it (Default leads both the catalogue and the Dark category —
  // see theme-order.ts). Shuffled once per mount via lazy useState so
  // clicking around never reshuffles it underfoot.
  const [themes] = useState(() => shuffledThemes(THEMES));
  // Re-render this browser when the viewer's chrome changes, so the Default
  // card's preview follows it.
  const { appearance } = useAppearance();
  const commit = onCommit ?? onSelect;
  // The quick-pick card previews Default as THIS viewer sees it: light chrome
  // shows the white canvas, dark chrome the charcoal one (spec/07). The card
  // in the Dark category is the opposite — it always shows the dark half,
  // because it is illustrating the scheme's place among the dark canvases.
  const defaultScheme = getTheme('brand', appearance);
  // Default is pulled OUT of the grouping as the quick-pick (the way Blank is
  // for templates) — except in Dark, which it leads as its dark half, because
  // that is the slot a reader looking for "the neutral dark one" goes to.
  const themeCategoryThemes = (category: ThemeCategory) =>
    category === 'dark'
      ? darkCategorySchemes(themes)
      : themes.filter((t) => t.id !== 'brand' && themeCategory(t.id) === category);

  return (
    <AnimatedHeightBox viewKey={openCategory ?? 'overview'} className={className}>
      {openCategory === 'custom' ? (
        <>
          <BackButton current="Custom" onClick={() => setOpenCategory(null)} />
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
          <BackButton
            current={THEME_CATEGORIES.find((c) => c.id === openCategory)?.label ?? openCategory}
            onClick={() => setOpenCategory(null)}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {themeCategoryThemes(openCategory).map((t) => (
              <ThemeCard
                key={t.id}
                theme={t}
                active={themeId === t.id}
                onSelect={() => onSelect(t.id)}
                onCommit={() => commit(t.id)}
                onCopy={onCopyTheme ? () => onCopyTheme(t) : undefined}
              />
            ))}
          </div>
          <ModeSwitchRow category={openCategory} />
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {defaultScheme ? (
            <ThemeQuickPickCard
              theme={defaultScheme}
              label="Default"
              description="Follows your appearance: light or dark."
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

function BackButton({ current, onClick }: { current?: string; onClick: () => void }) {
  return <BackBar label="All themes" current={current} onClick={onClick} />;
}

// A full-width iOS-style switch prompting the user to match the editor's
// light / dark chrome to the category they're browsing — dark mode for
// the Dark themes, light mode for the light-backdrop ones (spec/07
// covers the UI mode). Only shown when that mode ISN'T already active
// (and never for the colour-agnostic Custom bucket), so it reads as a
// helpful one-tap nudge rather than a persistent control.
function ModeSwitchRow({ category }: { category: ThemeCategory | 'custom' }) {
  const { appearance, set } = useAppearance();
  const target: 'light' | 'dark' | null =
    category === 'custom' ? null : category === 'dark' ? 'dark' : 'light';
  if (!target || appearance === target) return null;
  const label = target === 'dark' ? 'Turn on Dark mode' : 'Turn on Light mode';
  const hint =
    target === 'dark'
      ? 'Match the editor chrome to these dark themes.'
      : 'Switch the editor chrome back to light.';
  return (
    <button
      type="button"
      onClick={() => set(target)}
      className="mt-3 flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-slate-800/80"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">
          {label}
        </span>
        <span className="block text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      </span>
      {/* The row owns the click, so the switch is presentational. It's
          always off here (we only render when the target isn't active). */}
      <ToggleSwitch presentational checked={false} label={label} />
    </button>
  );
}
