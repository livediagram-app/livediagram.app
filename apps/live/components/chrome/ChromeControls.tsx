import { Tooltip } from '@/components/primitives/Tooltip';
import { AppearanceToggle } from '@/components/chrome/AppearanceToggle';
import { CHROME_BTN, CHROME_BTN_LABELLED, ChromeLabel } from '@/components/chrome/chrome-button';
import { GearIcon, GithubIcon, SearchGlyph } from '@/components/chrome/tab-bar-icons';
import { REPO_URL } from '@livediagram/ui';

// The right-hand control cluster shared by the editor's bottom tab bar and
// the Explorer's bottom bar (spec/07): search, the open-source GitHub
// link, settings, and the dark-mode toggle. Each callback-driven control
// renders only when its handler is supplied; dark-mode is always shown, and
// GitHub unless the host opts out. Keyboard shortcuts live in Settings' Keyboard category. Rendered as a fragment
// so each host drops it straight into its own bar flex row.
export function ChromeControls({
  onOpenSearch,
  onOpenSettings,
  settingsLabel = 'Settings',
  settingsDescription = 'Configure editor behaviour.',
  labelled = false,
  github = true,
}: {
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  // The editor's settings are per-diagram; the Explorer's read the same
  // synced preferences. Let the host phrase the tooltip.
  settingsLabel?: string;
  settingsDescription?: string;
  labelled?: boolean;
  // The editor moved its GitHub link into the Explorer panel's ⋯ menu
  // (spec/15); the full-page Explorer's bar keeps it.
  github?: boolean;
}) {
  const BTN = labelled ? `${CHROME_BTN} ${CHROME_BTN_LABELLED}` : CHROME_BTN;
  return (
    <>
      {onOpenSearch ? (
        <Tooltip title="Search" description="Find diagrams, folders, tabs and elements.">
          <button type="button" onClick={onOpenSearch} aria-label="Search" className={BTN}>
            <SearchGlyph />
            <ChromeLabel show={labelled}>Search</ChromeLabel>
          </button>
        </Tooltip>
      ) : null}
      {github ? (
        <>
          {/* Open-source repo link (the codebase is public + MIT, spec/03). An
          external <a>, not a callback, so it needs no wiring.

          Hidden below sm: the bottom bar is tight on a phone and this is the
          one control here that leaves the app entirely — the others (search,
          settings, dark mode) are things you reach for mid-edit.
          Still reachable from the marketing site and the help centre. */}
          {/* A wrapper, not the Tooltip's className: the Tooltip's own
          inline-flex outranks a `hidden` passed alongside it. */}
          <span className="hidden sm:contents">
            <Tooltip
              title="Source on GitHub"
              description="View livediagram's open-source code on GitHub."
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
            </Tooltip>
          </span>
        </>
      ) : null}
      {onOpenSettings ? (
        <Tooltip title={settingsLabel} description={settingsDescription}>
          <button type="button" onClick={onOpenSettings} aria-label={settingsLabel} className={BTN}>
            <GearIcon />
            <ChromeLabel show={labelled}>Settings</ChromeLabel>
          </button>
        </Tooltip>
      ) : null}
      <AppearanceToggle labelled={labelled} />
    </>
  );
}
