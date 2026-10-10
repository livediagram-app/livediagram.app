import { AppearanceToggle } from '@/components/chrome/AppearanceToggle';
import { CHROME_BTN, CHROME_BTN_LABELLED, ChromeLabel } from '@/components/chrome/chrome-button';
import { SettingsIcon, GithubIcon, SearchGlyph } from '@/components/chrome/tab-bar-icons';
import { REPO_URL, HoverCard } from '@livediagram/ui';

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
  settingsDescription = 'Configure editor behaviour.',
  labelled = false,
  github = true,
  powerUser = false,
  appearance = true,
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
  // Power user mode: the Appearance control becomes a quick switch
  // (docs/specs/007-editor/power-user-mode.md#quick-appearance-switch).
  powerUser?: boolean;
  // The Appearance control; withheld where the host sets the scheme itself (a workbench frame,
  // docs/specs/013-workspace/blueprints/workbench-embeds.md, WB15).
  appearance?: boolean;
}) {
  const BTN = labelled ? `${CHROME_BTN} ${CHROME_BTN_LABELLED}` : CHROME_BTN;
  return (
    <>
      {onOpenSearch ? (
        <HoverCard title="Search" description="Find documents, folders, tabs and elements.">
          <button type="button" onClick={onOpenSearch} aria-label="Search" className={BTN}>
            <SearchGlyph />
            <ChromeLabel show={labelled}>Search</ChromeLabel>
          </button>
        </HoverCard>
      ) : null}
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
            </HoverCard>
          </span>
        </>
      ) : null}
      {onOpenSettings ? (
        <HoverCard title={settingsLabel} description={settingsDescription}>
          <button type="button" onClick={onOpenSettings} aria-label={settingsLabel} className={BTN}>
            <SettingsIcon />
            <ChromeLabel show={labelled}>Settings</ChromeLabel>
          </button>
        </HoverCard>
      ) : null}
      {appearance ? <AppearanceToggle labelled={labelled} quick={powerUser} /> : null}
    </>
  );
}
