// Appearance, the reader's light / dark / system chrome (docs/specs/004-interface-design/appearance.md). Each
// product makes its store with createAppearanceStore and its own storage key, and binds the boot script, the
// hook and the toggle to it (its packages/ui/src/appearance/).
export { DARK_MEDIA_QUERY, appearanceBootScript } from './appearance-storage';
export {
  DEFAULT_APPEARANCE_SETTING,
  applyAppearance,
  createAppearanceStore,
  getServerAppearance,
  getServerAppearanceSetting,
  type Appearance,
  type AppearanceSetting,
  type AppearanceStore,
} from './appearance-store';
export {
  APPEARANCE_LABEL,
  appearanceToggleName,
  nextAppearanceSetting,
  oppositeAppearanceSetting,
  quickAppearanceToggleName,
} from './appearance-cycle';
export { AppearanceIcon } from './AppearanceIcon';
export { useAppearanceStore } from './useAppearanceStore';
export { SiteAppearanceToggle } from './SiteAppearanceToggle';
