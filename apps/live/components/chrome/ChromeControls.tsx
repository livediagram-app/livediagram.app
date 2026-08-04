import { Tooltip } from '@/components/primitives/Tooltip';
import { UiModeToggle } from '@/components/chrome/UiModeToggle';
import { GearIcon, GithubIcon, KeyboardIcon, SearchGlyph } from '@/components/chrome/tab-bar-icons';

// The right-hand control cluster shared by the editor's bottom tab bar and
// the Explorer's bottom bar (spec/07): search, keyboard shortcuts, the
// open-source GitHub link, settings, and the dark-mode toggle. Each
// callback-driven control renders only when its handler is supplied
// (the editor wires all; the Explorer skips canvas-only ones like
// shortcuts); GitHub + dark-mode are always shown. Rendered as a fragment
// so each host drops it straight into its own bar flex row.
const BTN =
  'ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:ml-1 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';

export function ChromeControls({
  onOpenSearch,
  onOpenShortcuts,
  onOpenSettings,
  settingsLabel = 'Settings',
  settingsDescription = 'Configure editor behaviour.',
}: {
  onOpenSearch?: () => void;
  onOpenShortcuts?: () => void;
  onOpenSettings?: () => void;
  // The editor's settings are per-diagram; the Explorer's read the same
  // synced preferences. Let the host phrase the tooltip.
  settingsLabel?: string;
  settingsDescription?: string;
}) {
  return (
    <>
      {onOpenSearch ? (
        <Tooltip title="Search" description="Find diagrams, folders, tabs and elements.">
          <button type="button" onClick={onOpenSearch} aria-label="Search" className={BTN}>
            <SearchGlyph />
          </button>
        </Tooltip>
      ) : null}
      {onOpenShortcuts ? (
        <span className="hidden sm:contents">
          <Tooltip
            title="Keyboard shortcuts"
            description="See every shortcut. Toggle them off if they get in the way."
          >
            <button
              type="button"
              onClick={onOpenShortcuts}
              aria-label="Keyboard shortcuts"
              className={BTN}
            >
              <KeyboardIcon />
            </button>
          </Tooltip>
        </span>
      ) : null}
      {/* Open-source repo link (the codebase is public + MIT, spec/03). An
          external <a>, not a callback, so it needs no wiring.

          Hidden below sm: the bottom bar is tight on a phone and this is the
          one control here that leaves the app entirely — the others (search,
          shortcuts, settings, dark mode) are things you reach for mid-edit.
          Still reachable from the marketing site and the help centre. */}
      <Tooltip
        title="Source on GitHub"
        description="View livediagram's open-source code on GitHub."
        className="hidden sm:inline-flex"
      >
        <a
          href="https://github.com/livediagram-app/livediagram.app"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Source on GitHub"
          className={BTN}
        >
          <GithubIcon />
        </a>
      </Tooltip>
      {onOpenSettings ? (
        <Tooltip title={settingsLabel} description={settingsDescription}>
          <button type="button" onClick={onOpenSettings} aria-label={settingsLabel} className={BTN}>
            <GearIcon />
          </button>
        </Tooltip>
      ) : null}
      <UiModeToggle />
    </>
  );
}
