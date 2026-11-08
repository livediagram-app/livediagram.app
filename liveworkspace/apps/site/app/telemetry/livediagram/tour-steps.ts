import type { TelemetryCount } from '@livediagram/api-schema';
import { typeLabel } from '../_shared/event-vocab';

// The Diagram tour's chapters (docs/specs/007-editor/watch-it-built.md), in the order Watch It Built plays them, as the
// `UI·View·TourStep<Chapter>` tokens each sends when it starts. The editor derives these from its chapter ids
// (apps/editor lib/replay/watch-it-built-script.ts, tourStepTelemetryType); metric-emitters.test reads that file and
// fails if this list drifts from it.
export const TOUR_STEP_TYPES: readonly string[] = [
  'TourStepAdd',
  'TourStepConnect',
  'TourStepLabel',
  'TourStepStyle',
];

/**
 * One row per tour step, in step order, for the Help tab's funnel. A step no
 * one reached reads 0 rather than dropping out, since where the counts fall
 * away is the point. Empty when no step was viewed at all.
 */
export function tourStepRows(rows: TelemetryCount[]): TelemetryCount[] {
  const count = (type: string) =>
    rows
      .filter((r) => r.category === 'UI' && r.action === 'View' && r.type === type)
      .reduce((sum, r) => sum + r.count, 0);
  const steps = TOUR_STEP_TYPES.map((type): TelemetryCount => ({
    category: 'UI',
    action: 'View',
    type,
    count: count(type),
  }));
  return steps.some((s) => s.count > 0) ? steps : [];
}

// A step's own name for its ranking row: 'TourStepSelectionModes' reads
// 'Selection Modes'.
export const tourStepLabel = (type: string): string => typeLabel(type.replace(/^TourStep/, ''));
