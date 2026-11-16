import { AppearanceToggle } from '@/components/chrome/AppearanceToggle';
import {
  CHROME_BTN,
  CHROME_BTN_LABELLED,
  ChromeLabel,
} from '@liveworkspace/workbench/components/chrome/chrome-button';
import { TourOfferButton } from '@liveworkspace/workbench/components/tour/TourOfferButton';
import { SettingsIcon, GithubIcon, SearchGlyph } from '@/components/chrome/tab-bar-icons';
import { REPO_URL, HoverCard } from '@livehuddle/ui';
import { useSnapshotsToolsItem } from '@liveworkspace/snapshots/ui';
import {
  ChromeToolsMenu,
  type ChromeToolsItem,
} from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';

// The right-hand control cluster shared by the editor's bottom tab bar and
// the Explorer's bottom bar (docs/specs/007-editor/editor-app.md): search, the open-source GitHub
// link, settings, and the dark-mode toggle. Each callback-driven control
// renders only when its handler is supplied; dark-mode is always shown, and
// GitHub unless the host opts out. Keyboard shortcuts live in Settings' Keyboard category. Rendered as a fragment
// so each host drops it straight into its own bar flex row.
export function ChromeControls({
  onOpenSearch,
  onOpenSettings,
  settingsLabel = 'Settings',
  labelled = false,
  github = true,
}: {
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  // The editor's settings are per-document; the Explorer's read the same
  // synced preferences. Let the host phrase the hover card.
  settingsLabel?: string;
  settingsDescription?: string;
  labelled?: boolean;
  // The editor moved its GitHub link into the Explorer panel's ⋯ menu
  // (docs/specs/013-workspace/folders.md); the full-page Explorer's bar keeps it.
  github?: boolean;
}) {
  const BTN = labelled ? `${CHROME_BTN} ${CHROME_BTN_LABELLED}` : CHROME_BTN;
  const snapshots = useSnapshotsToolsItem();
  // Search, first in Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md).
  const search: ChromeToolsItem | null = onOpenSearch
    ? { id: 'search', group: 'find', label: 'Search', description: 'Find spaces, tabs and elements.', icon: <SearchGlyph />, onSelect: () => onOpenSearch() }
    : null;
  return (
    <>
      {/* The Get Started button, first in the cluster and left of Tools: the one way into a tour,
          drawn only while one is on offer (docs/specs/007-editor/editor-tour.md "Where it appears"). Leading the cluster, it comes and
          goes without moving the controls beside it. */}
      <TourOfferButton labelled={labelled} />
      {/* Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md): the tools that work on the
          whole item, in one menu, drawn only while it holds one. */}
      <ChromeToolsMenu labelled={labelled} items={[search, snapshots]} />
      {github ? (
        <>
          {/* Open-source repo link (the codebase is public + MIT, docs/specs/002-project-scope/open-source-and-business-model.md). An
          external <a>, not a callback, so it needs no wiring.

          Hidden below sm: the bottom bar is tight on a phone and this is the
          one control here that leaves the app entirely — the others (search,
          settings, dark mode) are things you reach for mid-edit.
          Still reachable from the marketing site and the help centre. */}
          {/* A wrapper, not the HoverCard's className: the HoverCard's own
          inline-flex outranks a `hidden` passed alongside it. */}
          <span className="hidden sm:contents">
            <HoverCard
              title="Source on GitHub"
              description="View livehuddle's open-source code on GitHub."
            >
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Source on GitHub"
                className={BTN}
              >
                <GithubIcon />
                <ChromeLabel show={labelled}>GitHub</ChromeLabel>
              </a>
            </HoverCard>
          </span>
        </>
      ) : null}
      {onOpenSettings ? (
        <button type="button" onClick={onOpenSettings} aria-label={settingsLabel} className={BTN}>
          <SettingsIcon />
          <ChromeLabel show={labelled}>Settings</ChromeLabel>
        </button>
      ) : null}
      <AppearanceToggle />
    </>
  );
}
