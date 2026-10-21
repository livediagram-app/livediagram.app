import type { Appearance, AppearanceSetting } from './appearance-store';

// The cycle every Appearance control walks. Light and Dark first (the two picks
// anyone reaching for the control wants), System last as the "you decide" step
// that hands the choice back to the device.
const CYCLE: readonly AppearanceSetting[] = ['light', 'dark', 'system'];

export function nextAppearanceSetting(setting: AppearanceSetting): AppearanceSetting {
  return CYCLE[(CYCLE.indexOf(setting) + 1) % CYCLE.length]!;
}

// The setting's name, as a control and its accessible name say it. Also the
// editor's telemetry `type` preset, so it is closed vocabulary, never user content.
export const APPEARANCE_LABEL: Record<AppearanceSetting, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

// The accessible name of a cycling control: where you are, then where a click goes.
export function appearanceToggleName(setting: AppearanceSetting): string {
  return `Appearance: ${APPEARANCE_LABEL[setting]}. Switch to ${APPEARANCE_LABEL[nextAppearanceSetting(setting)]}.`;
}

// Power user mode's quick switch (docs/specs/007-editor/power-user-mode.md#quick-appearance-switch):
// a click goes to the explicit setting opposite the PAINTED appearance, so it always
// visibly flips, System included; the context menu gesture hands the pick back to System.
export function oppositeAppearanceSetting(appearance: Appearance): AppearanceSetting {
  return appearance === 'dark' ? 'light' : 'dark';
}

export function quickAppearanceToggleName(
  setting: AppearanceSetting,
  appearance: Appearance,
): string {
  return `Appearance: ${APPEARANCE_LABEL[setting]}. Switch to ${APPEARANCE_LABEL[oppositeAppearanceSetting(appearance)]}. Right-click to follow your device.`;
}
