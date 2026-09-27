import { APPEARANCE_LABEL, AppearanceIcon, appearanceToggleName, HoverCard } from '@livediagram/ui';
import type { AppearanceSetting } from '@livediagram/ui';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { CHROME_BTN, CHROME_BTN_LABELLED, ChromeLabel } from '@/components/chrome/chrome-button';

// The editor's Appearance control: one button that CYCLES Light → Dark → System
// (docs/specs/004-interface-design/appearance.md), hosted in the tab bar's trailing
// controls. Flips only the editor chrome; a tab's theme is its own setting, except
// for Default, which follows this one (docs/specs/007-editor/live-app.md).
//
// The glyph shows the CURRENT setting, not the next one: with three states, one of
// them deferring to the OS, the only readable thing is where you are, so the
// hover card and accessible name carry where the next click takes you.

const DESCRIPTION: Record<AppearanceSetting, string> = {
  light: 'The editor chrome is light.',
  dark: 'The editor chrome is dark.',
  system: 'The editor chrome follows your device setting.',
};

export function AppearanceToggle({ labelled = false }: { labelled?: boolean }) {
  const { setting, cycle } = useAppearance();
  return (
    <HoverCard
      title={`Appearance: ${APPEARANCE_LABEL[setting]}`}
      description={DESCRIPTION[setting]}
    >
      <button
        type="button"
        onClick={cycle}
        aria-label={appearanceToggleName(setting)}
        className={labelled ? `${CHROME_BTN} ${CHROME_BTN_LABELLED}` : CHROME_BTN}
      >
        <AppearanceIcon setting={setting} />
        <ChromeLabel show={labelled}>{APPEARANCE_LABEL[setting]}</ChromeLabel>
      </button>
    </HoverCard>
  );
}
