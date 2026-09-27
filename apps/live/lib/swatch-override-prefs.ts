// Pruning the quick style panel's custom swatches (docs/specs/008-canvas/quick-style-panel.md "Custom
// swatches") when a custom theme is gone: on delete, and when the owner's list
// of custom themes loads without one (deleted on another device). Built-in
// themes are never pruned.
import { readUserPreferences, writeUserPreferences } from './user-preferences';
import { parseSwatchOverrideStore, pruneSwatchOverrideStore } from './swatch-overrides';

const CUSTOM_PREFIX = 'custom:';

export function pruneCustomThemeSwatchOverrides(
  ownerId: string | null,
  customThemeExists: (themeId: string) => boolean,
): void {
  const latest = readUserPreferences();
  if (latest.quickSwatchOverrides === undefined) return;
  const store = parseSwatchOverrideStore(latest.quickSwatchOverrides);
  const pruned = pruneSwatchOverrideStore(
    store,
    (id) => !id.startsWith(CUSTOM_PREFIX) || customThemeExists(id),
  );
  if (pruned === store) return;
  const next = { ...latest };
  if (pruned.length === 0) delete next.quickSwatchOverrides;
  else next.quickSwatchOverrides = pruned;
  console.debug('[swatch-overrides] pruned', store.length - pruned.length);
  writeUserPreferences(next, ownerId);
}
