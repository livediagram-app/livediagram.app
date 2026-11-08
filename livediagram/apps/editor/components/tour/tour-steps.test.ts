import { describe, expect, it } from 'vitest';
import { TELEMETRY_TYPE_PATTERN } from '@livediagram/api-schema';
import { ALL_TOPIC_CARDS } from '@/lib/replay/curriculum';
import { TOPICS } from '@/lib/replay/topics';
import { tourStepTelemetryType } from './tour-steps';

// Watch It Built's chapter-view telemetry (docs/specs/007-editor/watch-it-built.md "Telemetry"): every chapter id must
// derive a valid preset `type` token, and the funnel only reads cleanly if the ids stay unique.
describe('tourStepTelemetryType', () => {
  it('derives a valid, unique token for every Watch It Built chapter', () => {
    const types = ALL_TOPIC_CARDS.flatMap((card) =>
      TOPICS[card.id]!.chapters.map((c) => tourStepTelemetryType(c.id)),
    );
    expect(types.slice(0, 4)).toEqual([
      'TourStepAdd',
      'TourStepConnect',
      'TourStepLabel',
      'TourStepStyle',
    ]);
    for (const type of types) expect(type).toMatch(TELEMETRY_TYPE_PATTERN);
    expect(new Set(types).size).toBe(types.length);
  });

  it('camel-cases a kebab id', () => {
    expect(tourStepTelemetryType('selection-modes')).toBe('TourStepSelectionModes');
  });
});
