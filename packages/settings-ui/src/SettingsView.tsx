'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { NavChevron } from './glyphs';
import { useSettingsUiKit } from './kit';
import type { SettingsCategory } from './model';
import { SettingsCategoryList, SettingsSubcategoryLinks } from './SettingsCategoryList';
import { SettingsCategoryPane } from './SettingsCategoryPane';
import { firstMatchingCategory, searchSettings } from './settings-search';
import { useRememberedSettingsView, useSettingsViewMemory } from './useSettingsViewMemory';

export type SettingsFocus = { categoryId: string; rowKey: string };

// The Settings dialog's view (each app's docs/specs/007-editor/user-preferences.md), shaped like
// the iOS Settings app, in both of that app's shapes, on the viewport each belongs to:
//   - phone: a root list of categories that pushes a pane, with a back bar.
//   - desktop: the iPad split view, categories in a rail, the pane beside them, so the whole map
//     stays visible and nothing has to be pushed.
// One model and one pane feed both, so the two layouts cannot disagree about what a category
// contains.
//
// It draws the header, the rail and pane, and the footer, as the children of the caller's dialog
// frame: each app's Settings and liveworkspace.app's "Your apps" dialog render it in their own.
export function SettingsView({
  categories,
  isMobile,
  onClose,
  title = 'Settings',
  leading,
  footer,
  placeholder,
  focus = null,
  initialCategoryId = null,
  initialSectionId = null,
  memoryKey = null,
  onCategoryOpened,
}: {
  categories: readonly SettingsCategory[];
  isMobile: boolean;
  onClose: () => void;
  // The header's title on the front screen (a pushed pane is titled by its category).
  title?: string;
  // Before the title on the front screen: liveworkspace.app's app mark.
  leading?: ReactNode;
  footer?: ReactNode;
  // Shown in place of the rail and pane (loading, a failed load).
  placeholder?: ReactNode;
  // Where to land: a category and the row to ring in it.
  focus?: SettingsFocus | null;
  // Category to open on without ringing a row.
  initialCategoryId?: string | null;
  // Section of that category to scroll to and focus (settingsSectionId).
  initialSectionId?: string | null;
  // Where the dialog remembers the category and scroll position it was left on; null keeps none.
  memoryKey?: string | null;
  // A category the reader picked, for the caller's telemetry.
  onCategoryOpened?: (categoryId: string) => void;
}) {
  const { SearchInput, CloseButton, NoMatches } = useSettingsUiKit();

  // The category the reader chose; null is the phone's root list. Desktop reads null as "the first
  // category" (see `selected` below), so one piece of state serves both layouts, across a resize
  // or rotate too. A targeted open wins, including on a phone, where it lands on the pushed pane
  // rather than the root list. Without one, the dialog reopens where it was last left.
  const target = focus?.categoryId ?? initialCategoryId ?? null;
  const remembered = useRememberedSettingsView(memoryKey);
  const restore = target ? null : remembered;
  const [selectedId, setSelectedId] = useState<string | null>(
    target ?? restore?.categoryId ?? null,
  );

  const [query, setQuery] = useState('');
  // The row to ring: a targeted open's, or one the power user preset readout went to.
  const [goTo, setGoTo] = useState<SettingsFocus | null>(focus);
  const result = useMemo(() => searchSettings(categories, query), [categories, query]);

  // While searching, the rail shows every category (with a match badge) and the pane shows only
  // what matched.
  //
  // Following the results with the selection is a DESKTOP-only fix, for the pane sitting empty
  // beside a rail full of hits. On a phone there is no pane until you tap one, so doing it there
  // would push a category open the moment you started typing and hide the badges you were
  // searching for.
  const effectiveId = isMobile ? selectedId : firstMatchingCategory(result, selectedId);
  // Desktop never shows an empty pane beside the rail: no selection, or one not (yet) among the
  // visible categories (a remembered one whose capability has not loaded), shows the first
  // category without forgetting the choice.
  const selected: SettingsCategory | null =
    result.categories.find((c) => c.id === effectiveId) ??
    (isMobile || result.searching ? null : (result.categories[0] ?? null));

  const { paneRef, onPaneScroll, forgetRestore } = useSettingsViewMemory({
    categoryId: selected?.id ?? null,
    restore,
    storageKey: memoryKey,
  });

  const select = useCallback(
    (id: string) => {
      forgetRestore();
      setSelectedId(id);
      onCategoryOpened?.(id);
    },
    [forgetRestore, onCategoryOpened],
  );
  // Stable, so the pane's memoised rows keep their memo across a keystroke.
  const goToRow = useCallback(
    (categoryId: string, rowKey: string) => {
      setQuery('');
      select(categoryId);
      setGoTo({ categoryId, rowKey });
    },
    [select],
  );
  const openCategory = useCallback(
    (categoryId: string) => {
      setQuery('');
      select(categoryId);
      setGoTo(null);
    },
    [select],
  );

  // The phone shows the root list until a category is picked; desktop always shows the split.
  // Only the phone's pushed pane gets a back control, and a sub-category's goes back to its
  // parent's pane, the screen that pushed it.
  const showBack = isMobile && selected !== null && !placeholder;
  const backTo = categories.find((c) => c.id === selected?.parent) ?? null;

  return (
    <>
      <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        {showBack ? (
          <button
            type="button"
            onClick={() => setSelectedId(backTo?.id ?? null)}
            className="-ml-1.5 flex items-center gap-0.5 rounded-md py-1 pr-2 pl-1 text-sm font-medium text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15"
          >
            <NavChevron direction="back" />
            {backTo?.label ?? title}
          </button>
        ) : (
          leading
        )}
        <h2 className="flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
          {showBack ? selected?.label : title}
        </h2>
        <CloseButton onClick={onClose} />
      </header>

      {placeholder ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{placeholder}</div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* The rail. On the phone it IS the root screen, so it takes the
              whole width and disappears once a category is pushed. */}
          {!isMobile || !selected ? (
            <div
              className={
                isMobile
                  ? 'w-full overflow-y-auto p-4'
                  : 'w-48 shrink-0 overflow-y-auto border-r border-slate-200 dark:border-slate-800'
              }
            >
              {/* Above the first category, in both layouts: the rail IS the
                  root screen on a phone, so one placement serves both. */}
              <div className={isMobile ? 'mb-3' : 'px-2 pt-2'}>
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Search settings"
                  ariaLabel="Search settings"
                  clearAriaLabel="Clear the settings search"
                  clearDescription="Clear the settings search and show every category."
                />
              </div>
              <SettingsCategoryList
                categories={result.categories}
                selected={isMobile ? null : (selected?.id ?? null)}
                onSelect={select}
                variant={isMobile ? 'root' : 'sidebar'}
                searching={result.searching}
              />
              {isMobile && result.searching && result.totalMatches === 0 ? (
                <NoMatches
                  size="regular"
                  className="mt-4"
                  things="settings"
                  query={query}
                  onClear={() => setQuery('')}
                />
              ) : null}
            </div>
          ) : null}

          {selected ? (
            <div
              // Remount the scroller on category change so a pane always starts
              // at the top rather than inheriting the previous one's offset.
              key={selected.id}
              ref={paneRef}
              onScroll={onPaneScroll}
              data-settings-pane
              className="min-w-0 flex-1 overflow-y-auto px-4 py-4"
            >
              <SettingsCategoryPane
                category={selected}
                isMobile={isMobile}
                focusRowKey={goTo?.categoryId === selected.id ? goTo.rowKey : null}
                focusSectionId={selected.id === initialCategoryId ? initialSectionId : null}
                onGoToRow={goToRow}
                onOpenCategory={openCategory}
              />
              {/* A phone's way down to a parent's sub-categories: the root
                  list has no accordion to open, so the pane lists them. */}
              {isMobile ? (
                <SettingsSubcategoryLinks
                  parent={selected}
                  categories={categories}
                  onSelect={select}
                />
              ) : null}
            </div>
          ) : result.searching && !isMobile ? (
            <div className="flex min-w-0 flex-1 items-center justify-center px-6 py-10">
              <NoMatches
                size="regular"
                things="settings"
                query={query}
                onClear={() => setQuery('')}
              />
            </div>
          ) : null}
        </div>
      )}

      {footer ? (
        <footer className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          {footer}
        </footer>
      ) : null}
    </>
  );
}
