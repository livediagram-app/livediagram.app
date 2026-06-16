// Module-level registry of the owner's custom themes (spec/44), keyed
// by theme id (`custom:<uuid>`). `getTheme` in themes.ts consults this
// FIRST, so a custom theme resolves through the same synchronous path
// every built-in does — no async hop on the render path, no changes to
// the ~50 getTheme callers. The editor's CustomThemeProvider fetches the
// owner's themes on mount and registers them here (and keeps it in step
// on create / edit / delete); a tab referencing a custom id then renders
// correctly once the fetch lands and the provider re-renders.
//
// The ThemeDefinition import is type-only (erased at runtime), so the
// themes.ts -> registry runtime dependency stays one-way (no import
// cycle): themes.ts calls lookupCustomTheme(); this file only borrows
// the type.

import type { CustomTheme, CustomThemeDefinition } from '@livediagram/api-schema';
import type { ThemeDefinition } from './themes';

const registry = new Map<string, ThemeDefinition>();

// A saved CustomTheme (id + name + themable payload) materialised into a
// full ThemeDefinition: the stored definition fields, with the row's id
// + name becoming the theme id + label. The id cast is the one spot the
// `custom:<uuid>` string meets ThemeDefinition's `ThemeId` union — safe
// because getTheme keys on the string and never narrows it back.
export function materialiseCustomTheme(t: CustomTheme): ThemeDefinition {
  return {
    id: t.id as ThemeDefinition['id'],
    label: t.name,
    ...t.definition,
  };
}

// Inverse of materialiseCustomTheme: a built-in (or any) ThemeDefinition
// stripped to its editable CustomThemeDefinition payload (drops id /
// label / extra). Used by the "Copy" affordance on built-in themes to
// seed the builder with an existing theme's options.
export function customDefinitionFromTheme(theme: ThemeDefinition): CustomThemeDefinition {
  return {
    backgroundColor: theme.backgroundColor,
    backgroundPattern: theme.backgroundPattern,
    patternColor: theme.patternColor,
    backgroundOpacity: theme.backgroundOpacity,
    elementFill: theme.elementFill,
    elementStroke: theme.elementStroke,
    elementText: theme.elementText,
    palette: theme.palette,
    rootColor: theme.rootColor,
    shapeColors: theme.shapeColors,
  };
}

export function registerCustomThemes(themes: CustomTheme[]): void {
  for (const t of themes) registry.set(t.id, materialiseCustomTheme(t));
}

export function registerCustomTheme(theme: CustomTheme): void {
  registry.set(theme.id, materialiseCustomTheme(theme));
}

export function unregisterCustomTheme(id: string): void {
  registry.delete(id);
}

export function lookupCustomTheme(id: string): ThemeDefinition | undefined {
  return registry.get(id);
}

// Test hook: reset between cases so a registered theme from one test
// can't leak into the next.
export function clearCustomThemeRegistry(): void {
  registry.clear();
}

// True when the id is a custom theme id (the `custom:` prefix is minted
// client-side so it can never collide with a built-in ThemeId). Cheap
// "is this a saved theme?" check for the UI without a registry lookup.
export function isCustomThemeId(id: string | undefined): boolean {
  return typeof id === 'string' && id.startsWith('custom:');
}
