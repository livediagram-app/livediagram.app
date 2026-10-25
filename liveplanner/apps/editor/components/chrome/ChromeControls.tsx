import { AppearanceToggle } from '@/components/chrome/AppearanceToggle';
import {
  CHROME_BTN,
  CHROME_BTN_LABELLED,
  ChromeLabel,
} from '@liveworkspace/workbench/components/chrome/chrome-button';
import { SettingsIcon, SearchGlyph } from '@/components/chrome/tab-bar-icons';
import { HoverCard } from '@liveplanner/ui';

// The right-hand control cluster shared by the editor's bottom tab bar and
// the Explorer's bottom bar (docs/specs/007-editor/editor-app.md): search, settings, and the
// dark-mode toggle. Each callback-driven control renders only when its handler is supplied; dark-mode is
// shown unless the host withholds it. Keyboard shortcuts live in Settings' Keyboard category. Rendered as a fragment
// so each host drops it straight into its own bar flex row.
export function ChromeControls({
  onOpenSearch,
  onOpenSettings,
  settingsLabel = 'Settings',
  settingsDescription = 'Configure editor behaviour.',
  labelled = false,
  powerUser = false,
  appearance = true,
}: {
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  // The editor's settings are per-project; the Explorer's read the same
  // synced preferences. Let the host phrase the hover card.
  settingsLabel?: string;
  settingsDescription?: string;
  labelled?: boolean;
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
        <HoverCard title="Search" description="Find plans, folders, tabs and elements.">
          <button type="button" onClick={onOpenSearch} aria-label="Search" className={BTN}>
            <SearchGlyph />
            <ChromeLabel show={labelled}>Search</ChromeLabel>
          </button>
        </HoverCard>
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
