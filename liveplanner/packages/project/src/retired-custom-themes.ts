// Custom themes are gone (docs/specs/011-theme/retired-schemes.md "Custom themes"). A tab saved on one still names it
// as `custom:<uuid>`, and a file exported while they were here can carry one, so the id is let go on read: the tab
// moves to the Default scheme, its canvas with it. Nothing is rewritten in storage; every read does this again.
//
// Only the tab's own fields change, so it costs the same whatever the tab holds: one prefix test, and for a tab on a
// custom theme one shallow copy. Element colours stay as they are: with the theme's definition gone nothing can tell a
// colour it painted from one somebody picked, so each reads as picked, which is how it already looked.
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_PATTERN_COLOR } from './canvas-colors';
import { DEFAULT_SCHEME_ID } from './themes';
import type { Tab } from './index';

const CUSTOM_PREFIX = 'custom:';

/** True for a theme id that named a custom theme (`custom:<uuid>`). */
export function isRetiredCustomThemeId(id: unknown): boolean {
  return typeof id === 'string' && id.startsWith(CUSTOM_PREFIX);
}

type ThemedTab = Pick<Tab, 'theme' | 'backgroundColor' | 'patternColor'>;

/** Move a stored tab off a custom theme onto Default. The same tab when it is not on one. */
export function dropCustomTheme<T extends ThemedTab>(tab: T): T {
  if (!isRetiredCustomThemeId(tab.theme)) return tab;
  const { backgroundOpacity: _opacity, ...rest } = tab as T & { backgroundOpacity?: number };
  return {
    ...(rest as T),
    theme: DEFAULT_SCHEME_ID,
    backgroundColor: DEFAULT_BACKGROUND_COLOR,
    patternColor: DEFAULT_PATTERN_COLOR,
    backgroundPattern: 'grid',
  };
}
