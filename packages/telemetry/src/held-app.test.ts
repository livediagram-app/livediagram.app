import { describe, expect, it } from 'vitest';
import {
  HELD_TELEMETRY_APPS,
  isTelemetryApp,
  isTelemetryAppFilter,
  isTelemetrySender,
  TELEMETRY_APP_ORIGINS,
  TELEMETRY_APPS,
  TELEMETRY_SENDERS,
  telemetryAppOfOrigin,
} from './apps';

// Held apps (liveworkspace/docs/specs/008-telemetry/telemetry.md "Adding an app"): none today. livehuddle was held
// until its dashboard was built (Work Tracker #400), and is now listed like every launched app.
describe('held apps', () => {
  it('are none today', () => {
    expect(HELD_TELEMETRY_APPS).toEqual([]);
  });

  it('livehuddle is listed, so the dashboard reads it', () => {
    expect(TELEMETRY_APPS).toEqual([
      'livediagram.app',
      'liveplanner.app',
      'livedocuments.app',
      'livedesign.app',
      'livehuddle.app',
    ]);
    expect(TELEMETRY_SENDERS).toContain('livehuddle.app');
  });

  it('livehuddle is accepted as a sender, by its site and its origins', () => {
    expect(isTelemetryApp('livehuddle.app')).toBe(true);
    expect(isTelemetrySender('livehuddle.app')).toBe(true);
    expect(isTelemetryAppFilter('livehuddle.app')).toBe(true);
    expect(TELEMETRY_APP_ORIGINS['livehuddle.app']).toEqual([
      'https://livehuddle.app',
      'https://www.livehuddle.app',
      'https://staging.livehuddle.app',
    ]);
    expect(telemetryAppOfOrigin('https://www.livehuddle.app')).toBe('livehuddle.app');
    expect(telemetryAppOfOrigin('https://staging.livehuddle.app')).toBe('livehuddle.app');
  });
});
