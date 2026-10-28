'use client';

import { BackBar } from '@liveworkspace/ui';
import { typeLabel } from './event-vocab';
import type { Metric } from './metrics';

// The Search view's breadcrumb (docs/specs/017-telemetry/telemetry.md): the shared back bar. It shows over the
// word cloud while drilling (All events, then a category, then an action) and stays over a charted metric, ending
// in the metric itself, so Back steps up to the level of the cloud that holds the metric's siblings.

// A cloud level: [] = categories, [category] = its actions,
// [category, action] = its types.
export type CloudPath = string[];

export type Crumb = { label: string; to: CloudPath | null }; // null = the current page

// The trail for a cloud level, or for a charted metric (which adds itself as
// the current crumb; an untyped metric ends at its action instead).
export function metricCrumbs(path: CloudPath, metric: Metric | null = null): Crumb[] {
  const [category, action] = metric ? [metric.category, metric.action] : path;
  const crumbs: Crumb[] = [{ label: 'All events', to: [] }];
  if (category !== undefined) crumbs.push({ label: category, to: [category] });
  if (action !== undefined) crumbs.push({ label: action, to: [category!, action] });
  if (metric?.type != null) crumbs.push({ label: typeLabel(metric.type), to: null });
  // The last crumb is always where you are, not a link.
  crumbs[crumbs.length - 1]!.to = null;
  return crumbs;
}

export function MetricBreadcrumb({
  crumbs,
  onNavigate,
}: {
  crumbs: Crumb[];
  onNavigate: (path: CloudPath) => void;
}) {
  // The shared back bar (docs/specs/004-interface-design/back-bar.md): the level above as where Back goes, this
  // level as its chip. At the top (All events alone) it stands as a heading in the same shape.
  const here = crumbs[crumbs.length - 1]!;
  const up = crumbs.length > 1 ? crumbs[crumbs.length - 2]! : null;
  return (
    <nav aria-label="Event levels" className="min-w-0 flex-1 sm:max-w-md">
      {up ? (
        <BackBar
          label={up.label}
          current={here.label}
          onClick={() => onNavigate(up.to ?? [])}
          gap="none"
        />
      ) : (
        <BackBar label={here.label} gap="none" />
      )}
    </nav>
  );
}
