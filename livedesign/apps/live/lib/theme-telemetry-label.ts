import { THEMES } from '@livedesign/design';

// The telemetry `type` for a theme, and the one place that decides it.
//
// docs/specs/017-telemetry/telemetry.md is categorical: `type` is a preset token, never user content. A theme
// is reported by its catalogue label. An id with no catalogue entry (a theme retired from THEMES while a
// document still names it) is title-cased when it reads like one of our slugs, and is otherwise the fixed
// 'Unknown', so an id that is not ours never leaves the browser.
const SLUG = /^[a-z][a-z0-9-]{0,38}$/;

export function themeTelemetryLabel(themeId: string | undefined): string {
  if (!themeId) return 'Unknown';
  const known = THEMES.find((t) => t.id === themeId)?.label;
  if (known) return known;
  return SLUG.test(themeId) ? themeId.charAt(0).toUpperCase() + themeId.slice(1) : 'Unknown';
}
