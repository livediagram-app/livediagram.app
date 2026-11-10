import { describe, expect, it } from 'vitest';
import {
  addAudienceCount,
  addAudienceDay,
  emptyAudienceCounts,
  type TelemetryAudience,
} from './audience';
import { TELEMETRY_SENDERS, type TelemetrySender } from './apps';

// A database row can name anything, so these cast a non-sender in the way a bad row would arrive.
const proto = '__proto__' as TelemetrySender;

describe('audience counts', () => {
  it('skips a row that names no sender, leaving the prototype alone', () => {
    const bucket = {};
    addAudienceCount(bucket, proto, 'signUps', 3);
    expect(Object.keys(bucket)).toEqual([]);
    expect(({} as Record<string, unknown>).signUps).toBeUndefined();
  });

  it('skips a day row that names no sender', () => {
    const audience = { daily: {} } as TelemetryAudience;
    addAudienceDay(audience, proto, 'signUps', 0, 2, 3);
    expect(Object.keys(audience.daily)).toEqual([]);
  });

  it('still counts a real sender', () => {
    const bucket: Parameters<typeof addAudienceCount>[0] = {};
    addAudienceCount(bucket, TELEMETRY_SENDERS[0]!, 'signUps', 3);
    expect(bucket[TELEMETRY_SENDERS[0]!]).toEqual({ ...emptyAudienceCounts(), signUps: 3 });
  });
});
