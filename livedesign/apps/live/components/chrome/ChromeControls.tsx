import { AppearanceToggle } from '@/components/chrome/AppearanceToggle';
import {
  CHROME_BTN,
  CHROME_BTN_LABELLED,
  ChromeLabel,
} from '@liveworkspace/workbench/components/chrome/chrome-button';
import { TourOfferButton } from '@liveworkspace/workbench/components/tour/TourOfferButton';
import { SettingsIcon, GithubIcon, SearchGlyph } from '@/components/chrome/tab-bar-icons';
import { REPO_URL, HoverCard } from '@livedesign/ui';
import {
  ChromeToolsMenu,
  type ChromeToolsItem,
} from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';

// The right-hand control cluster shared by the editor's bottom tab bar and
// the Explorer's bottom bar (docs/specs/007-editor/live-app.md): search, the open-source GitHub
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
  appearance = true,
  extraTools = [],
}: {
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  // The editor's settings are per-design; the Explorer's read the same
  // synced preferences. Let the host phrase the hover card.
  settingsLabel?: string;
  settingsDescription?: string;
  labelled?: boolean;
  // The editor moved its GitHub link into the Explorer panel's ⋯ menu
  // (docs/specs/013-workspace/folders.md); the full-page Explorer's bar keeps it.
  github?: boolean;
  // The Appearance control; withheld where the host sets the scheme itself (a workbench frame,
  // docs/specs/013-workspace/blueprints/workbench-embeds.md, WB15).
  appearance?: boolean;
  // More rows for Tools (the editor's Editing Mode tool).
  extraTools?: readonly (ChromeToolsItem | null)[];
}) {
  const BTN = labelled ? `${CHROME_BTN} ${CHROME_BTN_LABELLED}` : CHROME_BTN;
  // Search, first in Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md).
  const search: ChromeToolsItem | null = onOpenSearch
    ? {
        id: 'search',
        group: 'find',
        // The ellipsis: it opens outside Tools (footer-tools-menu.md "Opening a tool inside Tools").
        label: 'Search…',
        description: 'Find designs, tabs and elements.',
        icon: <SearchGlyph />,
        onSelect: () => onOpenSearch(),
      }
    : null;
  return (
    <>
      {/* The Get Started button, first in the cluster and left of Tools: the one way into a tour,
          drawn only while one is on offer (docs/specs/007-editor/pages-tour.md "Where it appears"). Leading the cluster, it comes and
          goes without moving the controls beside it. */}
      <TourOfferButton labelled={labelled} />
      {/* Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md): the tools that work on the
          whole item, in one menu, drawn only while it holds one. */}
      <ChromeToolsMenu labelled={labelled} items={[search, ...extraTools]} />
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
              description="View livedesign's open-source code on GitHub."
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
      {appearance ? <AppearanceToggle /> : null}
    </>
  );
}
