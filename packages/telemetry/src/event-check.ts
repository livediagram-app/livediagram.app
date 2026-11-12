// The check every app's ingest runs on one event (liveworkspace/docs/specs/008-telemetry/telemetry.md "Sending
// events"), over that app's own closed vocabulary. Each app's api-schema binds it once to its categories,
// actions and its three special categories' own checks (a page view's path, a CTA's source, a timing's
// metric), so the rule is one copy and the words stay each app's.

import { TELEMETRY_TYPE_PATTERN } from './wire';

// One event in an app's vocabulary.
export type TelemetryEventOf<Category extends string, Action extends string> = {
  category: Category;
  action: Action;
  // One short, app-defined reference token (a shape kind, a share
  // role like 'Edit', an export format, a template id, a theme name).
  // Optional. Bounded by TELEMETRY_TYPE_PATTERN below so the public
  // dashboard can never render user-generated content even if a caller
  // misuses it.
  type?: string | null;
};

// What an app's check reads: its vocabulary, and the checks for the categories whose `type` is not a free token.
export type TelemetryVocabulary<Category extends string, Action extends string> = {
  categories: readonly Category[];
  actions: readonly Action[];
  isValidPageViewPath: (path: string) => boolean;
  isCtaSource: (value: unknown) => boolean;
  isTimingType: (type: unknown) => boolean;
};

// Validate one event against the closed vocabulary. The worker filters
// the ingest batch through this so only known, safe rows ever land in
// D1 / the public dashboard.
export function telemetryEventCheck<Category extends string, Action extends string>(
  vocabulary: TelemetryVocabulary<Category, Action>,
): (value: unknown) => value is TelemetryEventOf<Category, Action> {
  const { categories, actions, isValidPageViewPath, isCtaSource, isTimingType } = vocabulary;
  return (value: unknown): value is TelemetryEventOf<Category, Action> => {
    if (typeof value !== 'object' || value === null) return false;
    const e = value as Record<string, unknown>;
    if (!categories.includes(e.category as Category)) return false;
    if (!actions.includes(e.action as Action)) return false;
    // A page view is only a page view with a path (docs/specs/017-telemetry/page-view-telemetry.md).
    if (e.category === 'Page') {
      return e.action === 'View' && typeof e.type === 'string' && isValidPageViewPath(e.type);
    }
    // A CTA event is only ever one of our own buttons (docs/specs/019-marketing/landing-funnel.md).
    if (e.category === 'Cta') {
      return (e.action === 'Opened' || e.action === 'Created') && isCtaSource(e.type);
    }
    // A timing is only ever a known metric with one of its own buckets (docs/specs/017-telemetry/timing-telemetry.md).
    if (e.category === 'Timing') return e.action === 'Measured' && isTimingType(e.type);
    if (e.type === undefined || e.type === null) return true;
    return typeof e.type === 'string' && TELEMETRY_TYPE_PATTERN.test(e.type);
  };
}
