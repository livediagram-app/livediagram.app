'use client';

import { useMemo, useRef, useState } from 'react';
import { DialogCloseButton, NoMatches } from '@livedesign/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import {
  SettingsCategoryList,
  SettingsSubcategoryLinks,
} from '@/components/dialogs/settings/SettingsCategoryList';
import { SettingsCategoryPane } from '@/components/dialogs/settings/SettingsCategoryPane';
import { NavChevron } from '@/components/primitives/NavChevron';
import { SearchInput } from '@/components/primitives/SearchInput';
import {
  firstMatchingCategory,
  searchSettings,
} from '@/components/dialogs/settings/settings-search';
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { PAGES_TOUR_KINDS, pagesKindSeen, requestPagesTourRelaunch } from '@/lib/pages-tour';
import { track } from '@/lib/telemetry';
import {
  visibleCategories,
  type SettingsCategorySpec,
} from '@/components/dialogs/settings/settings-catalogue';
import type { SettingsCategoryId } from '@/components/dialogs/settings/settings-icons';
import {
  useRememberedSettingsView,
  useSettingsViewMemory,
} from '@/components/dialogs/settings/useSettingsViewMemory';
import type { UserPreferences } from '@/lib/user-preferences';
import { isPowerUserMode } from '@/lib/power-user-mode';
import { signInEnabled } from '@/lib/auth-config';
import { usePlacementDefaults } from '@/hooks/persistence/usePlacementDefaults';
import { useWorkbenchSession } from '@/components/providers/workbench-session-context';

type SettingsDialogProps = {
  settings: UserPreferences;
  onChange: (next: UserPreferences) => void;
  onClose: () => void;
  aiCapable?: boolean;
  // Where to land. Set when Settings is opened from a search result: the
  // setting IS the destination, so we open its category and ring the row
  // rather than dropping the reader at the dialog's front door.
  focus?: { categoryId: string; rowKey: string } | null;
  // Category to open on without ringing a row, for the `?settings=` deep link
  // that mail and the account menu use.
  initialCategoryId?: string | null;
  // Section of that category to scroll to and focus (settingsSectionId).
  initialSectionId?: string | null;
  // The reader's owner id, for the Designs rows (docs/specs/013-workspace/default-folders.md);
  // the owner the page loaded its default folders for when absent.
  ownerId?: string | null;
};

// The Settings dialog (docs/specs/007-editor/user-preferences.md), shaped like the iOS Settings app because it
// had outgrown a single scrolling accordion: six groups of long paragraphs
// stacked on one screen, where finding a setting meant opening groups until
// one of them held it.
//
// It takes BOTH of that app's shapes, on the viewport each belongs to:
//   - phone: a root list of categories that pushes a pane, with a back bar.
//   - desktop: the iPad split view, categories in a rail, the pane beside
//     them, so the whole map stays visible and nothing has to be pushed.
// One catalogue and one pane component feed both, so the two layouts cannot
// disagree about what a category contains.
export function SettingsDialog({
  settings,
  onChange,
  onClose,
  aiCapable,
  focus,
  initialCategoryId,
  initialSectionId = null,
  ownerId = null,
}: SettingsDialogProps) {
  const isMobile = useIsMobileViewport();
  // Email rows need Resend configured AND a signed-in account: a guest has
  // no address, so those switches could never apply (docs/specs/014-identity/transactional-email.md).
  const { emailEnabled } = useCapabilities();
  const { accountUserId, isSignedIn } = useAccountBootstrap();
  const signedIn = Boolean(isSignedIn && accountUserId);
  // A workbench's Settings reach nothing beyond its one design (docs/specs/013-workspace/
  // blueprints/workbench-embeds.md, Surface table).
  const workbench = useWorkbenchSession() !== null;
  // Loads the reader's default folders when the page has not (a no-op when it has).
  const defaultsOwner = usePlacementDefaults(workbench ? null : ownerId).ownerId;
  const readerId = ownerId ?? defaultsOwner;
  const owner = useMemo(
    () => (readerId ? { ownerId: readerId, accountUserId: accountUserId ?? null } : null),
    [readerId, accountUserId],
  );
  // Power-user-only rows appear the moment the mode's own row switches on
  // (docs/specs/007-editor/power-user-mode.md), so this reads the live settings, not a snapshot.
  const powerUserMode = isPowerUserMode(settings);
  // Live settings too: a panel's rows follow its Enable switch the same way.
  const categories = useMemo(
    () =>
      visibleCategories(aiCapable === true, {
        emailEnabled,
        signedIn,
        authEnabled: signInEnabled,
        powerUserMode,
        preferences: settings,
        workbench,
      }),
    [aiCapable, emailEnabled, signedIn, powerUserMode, settings, workbench],
  );

  // The category the reader chose; null is the phone's root list. Desktop
  // reads null as "the first category" (see `selected` below), so one piece
  // of state serves both layouts, across a resize or rotate too.
  // A targeted open wins, including on a phone, where it lands on the pushed
  // pane rather than the root list. Without one, the dialog reopens where it
  // was last left.
  const target = (focus?.categoryId ?? initialCategoryId ?? null) as SettingsCategoryId | null;
  const remembered = useRememberedSettingsView();
  const restore = target ? null : remembered;
  const [selectedId, setSelectedId] = useState<SettingsCategoryId | null>(
    target ?? (restore?.categoryId as SettingsCategoryId | null | undefined) ?? null,
  );

  const [query, setQuery] = useState('');
  // The row to ring: a targeted open's, or one the power user preset readout
  // went to (docs/specs/007-editor/power-user-mode.md#in-settings).
  const [goTo, setGoTo] = useState(focus ?? null);
  const offeredRowKeys = useMemo(
    () => new Set(categories.flatMap((c) => c.rows.map((r) => r.key))),
    [categories],
  );
  const result = useMemo(() => searchSettings(categories, query), [categories, query]);

  // While searching, the rail shows every category (with a match badge) and
  // the pane shows only what matched.
  //
  // Following the results with the selection is a DESKTOP-only fix, for the
  // pane sitting empty beside a rail full of hits. On a phone there is no
  // pane until you tap one, so doing it there would push a category open the
  // moment you started typing and hide the badges you were searching for.
  const effectiveId = isMobile ? selectedId : firstMatchingCategory(result, selectedId);
  // Desktop never shows an empty pane beside the rail: no selection, or one
  // not (yet) among the visible categories (a remembered one whose capability
  // has not loaded), shows the first category without forgetting the choice.
  const selected: SettingsCategorySpec | null =
    result.categories.find((c) => c.id === effectiveId) ??
    (isMobile || result.searching ? null : (result.categories[0] ?? null));

  const { paneRef, onPaneScroll, forgetRestore } = useSettingsViewMemory({
    categoryId: selected?.id ?? null,
    restore,
  });

  const select = (id: SettingsCategoryId) => {
    forgetRestore();
    setSelectedId(id);
    // Which categories people actually open is the signal for whether this
    // reorganisation helped, and for what belongs on the first screen next.
    track('UI', 'Opened', `Settings${id.charAt(0).toUpperCase()}${id.slice(1)}`);
  };

  // Tours › "Wireframe Tour", "Logo Tour" and "Photo Tour" (docs/specs/007-editor/pages-tour.md): no handoff flag to arm, as the
  // Pages tour offers itself on working with each kind of page; turning a kind's row on from off reruns it in place.
  const pagesOwed = PAGES_TOUR_KINDS.filter((k) => !pagesKindSeen(settings, k));
  const pagesOwedAtOpen = useRef(pagesOwed);
  const close = () => {
    if (pagesOwed.some((k) => !pagesOwedAtOpen.current.includes(k))) requestPagesTourRelaunch();
    onClose();
  };

  // The phone shows the root list until a category is picked; desktop always
  // shows the split. Only the phone's pushed pane gets a back control, and a
  // sub-category's goes back to its parent's pane, the screen that pushed it.
  const showBack = isMobile && selected !== null;
  const backTo = categories.find((c) => c.id === selected?.parent) ?? null;

  return (
    <Dialog
      open
      onClose={close}
      ariaLabel="Settings"
      // Wide enough for the rail plus a readable pane. Below `sm:` the Dialog
      // goes edge-to-edge for every size at or above `md`, which is exactly
      // what the phone layout wants.
      size="2xl"
      // The existing see-through backdrop rather than the default dim+blur:
      // Settings is where you flip things whose effect is ON the canvas
      // behind it (panel opacity, UI scale, the minimap), so blurring that
      // canvas out hides the very thing you are adjusting.
      backdrop="desktop-light"
      // One fixed height on desktop, not a cap: sized to content, the frame
      // jumped between categories as the reader moved down the rail. 42rem
      // holds every short category whole and keeps a long one a modal rather
      // than a page; the pane scrolls inside. The phone layout still fills
      // its screen, which is what a pushed pane wants.
      className="max-h-[calc(100%-2rem)] sm:h-[min(42rem,calc(100%-6rem))] sm:max-h-[min(42rem,calc(100%-6rem))]"
    >
      <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        {showBack ? (
          <button
            type="button"
            onClick={() => setSelectedId(backTo?.id ?? null)}
            className="-ml-1.5 flex items-center gap-0.5 rounded-md py-1 pr-2 pl-1 text-sm font-medium text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15"
          >
            <NavChevron direction="back" />
            {backTo?.label ?? 'Settings'}
          </button>
        ) : null}
        <h2 className="flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
          {showBack ? selected?.label : 'Settings'}
        </h2>
        <DialogCloseButton compact onClick={close} />
      </header>

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
              owner={owner}
              settings={settings}
              onChange={onChange}
              focusRowKey={goTo?.categoryId === selected.id ? goTo.rowKey : null}
              focusSectionId={selected.id === initialCategoryId ? initialSectionId : null}
              offeredRowKeys={offeredRowKeys}
              onGoToRow={(categoryId, rowKey) => {
                setQuery('');
                select(categoryId);
                setGoTo({ categoryId, rowKey });
              }}
              onOpenCategory={(categoryId) => {
                setQuery('');
                select(categoryId);
                setGoTo(null);
              }}
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

      <footer className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          {/* A guest has no account to sync to: their settings follow them in this browser only. */}
          {signedIn
            ? 'Settings sync to your account and apply to every design you open, on every device you sign in from.'
            : 'Settings are kept in this browser and apply to every design you open. Sign in to have them on your other devices too.'}
        </p>
      </footer>
    </Dialog>
  );
}
