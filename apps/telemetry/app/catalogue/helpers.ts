// The factory the catalogue's long tail is written with (docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import type { Metric, Rising } from '../metric-series';

// Charts defined once and reused (docs/specs/017-telemetry/telemetry.md). A chart stack references these
// rather than declaring its own copies, so one chart can sit in several
// stacks, on several tabs, or on its own, and its wording stays in one place.

// One chart over a set of types (or every type) of one category and action,
// with optional further actions. Keeps the long tail below readable.
export const chart = (
  category: string,
  action: string,
  title: string,
  blurb: string,
  opts: {
    types?: readonly string[];
    typeIn?: (type: string | null) => boolean;
    actionIn?: readonly string[];
    rising?: Rising;
  } = {},
): Metric => ({
  category,
  action,
  ...(opts.actionIn ? { actionIn: opts.actionIn } : {}),
  ...(opts.typeIn
    ? { typeIn: opts.typeIn }
    : opts.types
      ? { typeIn: (type: string | null) => type !== null && opts.types!.includes(type) }
      : { allTypes: true }),
  title,
  blurb,
  ...(opts.rising ? { rising: opts.rising } : {}),
});
