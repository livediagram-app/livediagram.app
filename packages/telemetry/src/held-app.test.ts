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

// livehuddle, registered before its launch (liveworkspace/docs/specs/008-telemetry/telemetry.md "Adding an app"): its
// events are taken, and the dashboard, which lists TELEMETRY_APPS and TELEMETRY_SENDERS, shows none of it.
describe('a held app (livehuddle)', () => {
  it('is accepted as a sender, by its site and its origins', () => {
    expect(HELD_TELEMETRY_APPS).toEqual(['livehuddle.app']);
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

  it('is in no list the dashboard reads', () => {
    expect(TELEMETRY_APPS).toEqual([
      'livediagram.app',
      'liveplanner.app',
      'livedocuments.app',
      'livedesign.app',
    ]);
    expect(TELEMETRY_SENDERS).not.toContain('livehuddle.app');
  });
});
