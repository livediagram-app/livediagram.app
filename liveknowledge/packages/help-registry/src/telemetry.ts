// This product's help telemetry ids (docs/specs/017-telemetry/telemetry.md `Help`,
// docs/specs/018-help/contextual-help-links.md): the article's slug, except for the articles below,
// whose slug another article already uses. How an id is worked out is @liveworkspace/help-registry's
// (createHelpTelemetryIds); a test in apps/help fails if two articles ever resolve to the same id.

import { createHelpTelemetryIds } from '@liveworkspace/help-registry/telemetry';

export { articlePath } from '@liveworkspace/help-registry/telemetry';

/**
 * Explicit tokens for articles whose slug another article already uses,
 * keyed by the article's full path (`categorySlug/slug`). Never rename a
 * value: it is the stored series name on the public dashboard.
 */
export const TELEMETRY_ID_OVERRIDES: Readonly<Record<string, string>> = {
  'tips-and-tricks/format-painter': 'tips-format-painter',
  'tips-and-tricks/command-palette': 'tips-command-palette',
};

export const { articleTelemetryId, helpPathTelemetryId } =
  createHelpTelemetryIds(TELEMETRY_ID_OVERRIDES);
