import { DEFAULT_SCHEME_ID, THEMES } from '@liveplanner/project';

// The telemetry `type` for a theme, and the one place that decides it.
//
// docs/specs/017-telemetry/telemetry.md is categorical: `type` is a preset token, never user content. Every theme a
// tab can be given is a built-in, reported by its catalogue label. The fallback (title-casing the id) is for an id
// with no catalogue entry, a theme removed from THEMES while a plan still names it: still a preset token, since
// built-in ids are ours. A `custom:<uuid>` id (custom themes are gone, docs/specs/011-theme/retired-schemes.md) is
// never written by liveplanner; should one arrive it reports Default, never its id. So does a tab with no theme,
// which draws as Default.
export function themeTelemetryLabel(themeId: string | undefined): string {
  if (!themeId || themeId.startsWith('custom:')) return themeTelemetryLabel(DEFAULT_SCHEME_ID);
  const known = THEMES.find((t) => t.id === themeId)?.label;
  return known ?? themeId.charAt(0).toUpperCase() + themeId.slice(1);
}
