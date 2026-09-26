import type { TelemetryCount } from '@livediagram/api-schema';
import { typeLabel } from './event-vocab';

// The welcome tour's steps (docs/specs/007-editor/editor-tour.md), in the order the tour shows them, as
// the `UI·View·TourStep<Step>` tokens each sends when it comes on screen. The
// welcome card itself sends none (its decision is Tours Started / Declined).
// The editor derives these from its step ids (apps/live tour-steps.ts,
// tourStepTelemetryType); metric-emitters.test reads that file and fails if
// this list drifts from it.
export const TOUR_STEP_TYPES: readonly string[] = [
  'TourStepPalette',
  'TourStepSelectionModes',
  'TourStepCategories',
  'TourStepExplorer',
  'TourStepContextMenu',
  'TourStepTabs',
  'TourStepThemeCanvas',
  'TourStepSearch',
  'TourStepOutro',
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
