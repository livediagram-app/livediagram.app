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
  type ThemeDefinition,
  type ThemeId,
  themeCategory,
} from '@/lib/themes';
import { useUiMode } from '@/hooks/ui/useUiMode';
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
  const { mode, toggle } = useUiMode();
  const target: 'light' | 'dark' | null =
    category === 'custom' ? null : category === 'dark' ? 'dark' : 'light';
  if (!target || mode === target) return null;
  const label = target === 'dark' ? 'Turn on Dark mode' : 'Turn on Light mode';
  const hint =
    target === 'dark'
      ? 'Match the editor chrome to these dark themes.'
      : 'Switch the editor chrome back to light.';
  return (
    <button
      type="button"
      onClick={toggle}
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

// A full-width "go back to the overview" bar. Far more obvious than a
// small pill in the corner — the whole row is the target. Shared shape
// with the template picker's back bar so the two browses match.
export function BackBar({
  label,
  current,
  onClick,
}: {
  label: string;
  // The category the user has drilled into, shown as a chip on the right
  // so it's clear which group they're in (and which their selection is).
  current?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group mb-3 flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-brand-500/60 dark:hover:bg-slate-800/80 dark:hover:text-brand-200"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 transition group-hover:bg-brand-100 group-hover:text-brand-700 dark:bg-slate-700 dark:text-slate-200 dark:group-hover:bg-brand-500/25 dark:group-hover:text-brand-200">
        <svg
          width="13"
          height="13"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
          className="transition-transform duration-150 group-hover:-translate-x-0.5"
        >
          <path
            d="M7.5 2.5 4 6l3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {label}
      {current ? (
        <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
          {current}
        </span>
      ) : null}
    </button>
  );
}
