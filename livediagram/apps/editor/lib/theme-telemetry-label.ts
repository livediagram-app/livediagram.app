import { DEFAULT_SCHEME_ID, isRetiredCustomThemeId, THEMES } from '@livediagram/document';

// The telemetry `type` for a theme, and the one place that decides it.
//
// docs/specs/017-telemetry/telemetry.md is categorical: `type` is a preset token, never user content. Every theme a
// tab can be given is a built-in, reported by its catalogue label. The fallback (title-casing the id) is for an id
// with no catalogue entry, a theme removed from THEMES while a document still names it: still a preset token, since
// built-in ids are ours. A `custom:<uuid>` id (custom themes are gone, docs/specs/011-theme/retired-schemes.md) is
// moved to Default on read and so never reaches here; should one slip through it reports Default, the theme the tab
// actually shows, never its id. No theme at all is Default too.
export function themeTelemetryLabel(themeId: string | undefined): string {
  if (!themeId || isRetiredCustomThemeId(themeId)) themeId = DEFAULT_SCHEME_ID;
  const known = THEMES.find((t) => t.id === themeId)?.label;
  return known ?? themeId.charAt(0).toUpperCase() + themeId.slice(1);
}
