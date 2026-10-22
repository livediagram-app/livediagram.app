import type { MouseEvent } from 'react';
import {
  APPEARANCE_LABEL,
  AppearanceIcon,
  appearanceToggleName,
  HoverCard,
  oppositeAppearanceSetting,
  quickAppearanceToggleName,
} from '@livediagram/ui';
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
//
// In power user mode it is a quick switch instead
// (docs/specs/007-editor/power-user-mode.md#quick-appearance-switch): a click flips to the
// opposite of the painted appearance, and the context menu gesture sets System.

const DESCRIPTION: Record<AppearanceSetting, string> = {
  light: 'The editor chrome is light.',
  dark: 'The editor chrome is dark.',
  system: 'The editor chrome follows your device setting.',
};

export function AppearanceToggle({
  labelled = false,
  quick = false,
}: {
  labelled?: boolean;
  quick?: boolean;
}) {
  const { setting, appearance, set, cycle } = useAppearance();
  const opposite = oppositeAppearanceSetting(appearance);

  const onContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (setting !== 'system') set('system');
  };

  const description = quick
    ? `${DESCRIPTION[setting]} Click for ${APPEARANCE_LABEL[opposite]}${
        setting === 'system' ? '.' : '; right-click to follow your device.'
      }`
    : DESCRIPTION[setting];

  return (
    <HoverCard title={`Appearance: ${APPEARANCE_LABEL[setting]}`} description={description}>
      <button
        type="button"
        onClick={quick ? () => set(opposite) : cycle}
        onContextMenu={quick ? onContextMenu : undefined}
        aria-label={
          quick ? quickAppearanceToggleName(setting, appearance) : appearanceToggleName(setting)
        }
        className={labelled ? `${CHROME_BTN} ${CHROME_BTN_LABELLED}` : CHROME_BTN}
      >
        <AppearanceIcon setting={setting} />
        <ChromeLabel show={labelled}>{APPEARANCE_LABEL[setting]}</ChromeLabel>
      </button>
    </HoverCard>
  );
}
