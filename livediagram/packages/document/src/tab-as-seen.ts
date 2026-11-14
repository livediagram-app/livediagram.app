// A tab as a person in one appearance sees it (docs/specs/011-theme/light-and-dark.md): one copy for every product,
// @liveworkspace/element-model/tab-as-seen, bound to this model's themes, theme halves, stock colours and label inks.
// The editor's exports (apps/editor/lib/export-as-seen.ts) and the export door's previews draw a tab through it.
import {
  tabAsSeenFor,
  type ResolvedBackdrop as SharedResolvedBackdrop,
} from '@liveworkspace/element-model/tab-as-seen';
import { resolveStockColours } from './stock-colours';
import { themeColourMap, viewBackdropInTheme, viewElementInTheme } from './theme-halves';
import { DEFAULT_SCHEME_ID, DEFAULT_SCHEME_LIGHT, THEMES, type ThemeDefinition } from './themes';
import { withReadableLabelInks } from './label-backdrop';
import type { BackgroundPattern, Element } from './index';

export type ResolvedBackdrop = SharedResolvedBackdrop<BackgroundPattern>;

export const { themeSource, tabBackdropInAppearance, elementAsSeen, tabAsSeen } = tabAsSeenFor<
  Element,
  ThemeDefinition,
  BackgroundPattern
>(() => ({
  themes: THEMES,
  defaultSchemeId: DEFAULT_SCHEME_ID,
  defaultSchemeLight: DEFAULT_SCHEME_LIGHT,
  viewBackdropInTheme,
  themeColourMap,
  viewElementInTheme,
  resolveStockColours,
  withReadableLabelInks,
}));
