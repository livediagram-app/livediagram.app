'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { SettingsCategoryList } from '@/components/dialogs/settings/SettingsCategoryList';
import { SettingsCategoryPane } from '@/components/dialogs/settings/SettingsCategoryPane';
import { NavChevron } from '@/components/primitives/NavChevron';
import { SearchInput } from '@/components/primitives/SearchInput';
import {
  firstMatchingCategory,
  searchSettings,
} from '@/components/dialogs/settings/settings-search';
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { markTourPending, requestTourRelaunch } from '@/lib/tour-pending';
import { track } from '@/lib/telemetry';
import {
  visibleCategories,
  type SettingsCategorySpec,
} from '@/components/dialogs/settings/settings-catalogue';
import type { SettingsCategoryId } from '@/components/dialogs/settings/settings-icons';
import type { UserPreferences } from '@/lib/user-preferences';

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
};

// The Settings dialog (spec/20), shaped like the iOS Settings app because it
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
}: SettingsDialogProps) {
  const isMobile = useIsMobileViewport();
  // Email rows need Resend configured AND a signed-in account: a guest has
  // no address, so those switches could never apply (spec/64).
  const { emailEnabled } = useCapabilities();
  const { clerkUserId, isSignedIn } = useClerkApiBootstrap();
  const signedIn = Boolean(isSignedIn && clerkUserId);
  const categories = useMemo(
    () => visibleCategories(aiCapable === true, { emailEnabled, signedIn }),
    [aiCapable, emailEnabled, signedIn],
  );

  // On desktop a category is ALWAYS open (the pane can't be empty beside the
  // rail); on the phone, null is the root list. Which is why this is one
  // piece of state read two ways rather than two.
  // A targeted open wins over both defaults, including on a phone, where it
  // lands on the pushed pane rather than the root list.
  const target = (focus?.categoryId ?? initialCategoryId ?? null) as SettingsCategoryId | null;
  const [selectedId, setSelectedId] = useState<SettingsCategoryId | null>(
    target ?? (isMobile ? null : (categories[0]?.id ?? null)),
  );

  // Crossing the breakpoint mid-session (a resize, a rotate) must not strand
  // the dialog: desktop needs a pane, the phone root screen needs none.
  useEffect(() => {
    setSelectedId((current) => {
      if (!isMobile) return current ?? categories[0]?.id ?? null;
      return current;
    });
  }, [isMobile, categories]);

  const [query, setQuery] = useState('');
  const result = useMemo(() => searchSettings(categories, query), [categories, query]);

  // While searching, the rail shows every category (with a match badge) and
  // the pane shows only what matched.
  //
  // Following the results with the selection is a DESKTOP-only fix, for the
  // pane sitting empty beside a rail full of hits. On a phone there is no
  // pane until you tap one, so doing it there would push a category open the
  // moment you started typing and hide the badges you were searching for.
  const effectiveId = isMobile ? selectedId : firstMatchingCategory(result, selectedId);
  const selected: SettingsCategorySpec | null =
    result.categories.find((c) => c.id === effectiveId) ?? null;

  const select = (id: SettingsCategoryId) => {
    setSelectedId(id);
    // Which categories people actually open is the signal for whether this
    // reorganisation helped, and for what belongs on the first screen next.
    track('UI', 'Opened', `Settings${id.charAt(0).toUpperCase()}${id.slice(1)}`);
  };

  // "Show Welcome Tour" (spec/79). The row is ON when the tour has not been
  // resolved, and promises it will be offered, so closing the dialog has to
  // MAKE that true. `tourSeen !== true` alone never was: TourHost also needs
  // the per-tab pending flag, which only /new sets for a brand-new user. A
  // reader who had simply never taken the tour therefore saw the row sitting
  // on, promising a tour that would never arrive.
  //
  // Marking pending is idempotent, so leaving the row alone just re-arms the
  // offer it already claims. Turning it on from off additionally relaunches
  // in place, which is the "run it again" case the row's copy describes.
  const tourSeen = settings.tourSeen === true;
  const tourSeenAtOpen = useRef(tourSeen);
  const close = () => {
    if (!tourSeen) {
      markTourPending();
      if (tourSeenAtOpen.current) requestTourRelaunch();
    }
    onClose();
  };

  // The phone shows the root list until a category is picked; desktop always
  // shows the split. Only the phone's pushed pane gets a back control.
  const showBack = isMobile && selected !== null;

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
      // behind it (panel layout, opacity, the minimap), so blurring that
      // canvas out hides the very thing you are adjusting.
      backdrop="desktop-light"
      // Capped on desktop: unbounded, a category with a dozen rows stretched
      // the dialog from the top of the screen to the bottom, which reads as a
      // page rather than a modal. The pane scrolls inside instead. The phone
      // layout still fills its screen, which is what a pushed pane wants.
      className="max-h-[calc(100%-2rem)] sm:max-h-[min(42rem,calc(100%-6rem))]"
    >
      <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        {showBack ? (
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="-ml-1.5 flex items-center gap-0.5 rounded-md py-1 pr-2 pl-1 text-sm font-medium text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15"
          >
            <NavChevron direction="back" />
            Settings
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
              selected={isMobile ? null : effectiveId}
              onSelect={select}
              variant={isMobile ? 'root' : 'sidebar'}
              searching={result.searching}
            />
            {isMobile && result.searching && result.totalMatches === 0 ? (
              <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
                No settings match “{query.trim()}”.
              </p>
            ) : null}
          </div>
        ) : null}

        {selected ? (
          <div className="min-w-0 flex-1 overflow-y-auto px-4 py-4">
            <SettingsCategoryPane
              // Remount on category change so a pane always scrolls from the
              // top rather than inheriting the previous one's offset.
              key={selected.id}
              category={selected}
              settings={settings}
              onChange={onChange}
              focusRowKey={focus?.categoryId === selected.id ? focus.rowKey : null}
            />
          </div>
        ) : result.searching && !isMobile ? (
          <div className="flex min-w-0 flex-1 items-center justify-center px-6 py-10">
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              No settings match “{query.trim()}”.
            </p>
          </div>
        ) : null}
      </div>

      <footer className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          Settings sync to your account and apply to every diagram you open, on every device you
          sign in from.
        </p>
      </footer>
    </Dialog>
  );
}
