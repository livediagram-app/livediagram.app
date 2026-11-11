import { describe, expect, it } from 'vitest';
import { isValidTelemetryEvent, TELEMETRY_TYPE_PATTERN } from './telemetry-schema';
import { ALL_TIMING_TYPES } from './timing-telemetry';

// The timing vocabulary is @liveworkspace/api-schema/timing-telemetry's (tested there); this product's
// telemetry schema has to accept every type it can send.
describe('the timing vocabulary', () => {
  it('only ever produces types the token pattern accepts', () => {
    for (const type of ALL_TIMING_TYPES) expect(TELEMETRY_TYPE_PATTERN.test(type)).toBe(true);
  });
});

describe('the ingest validator', () => {
  it('accepts a timing with a known metric and bucket', () => {
    expect(
      isValidTelemetryEvent({
        category: 'Timing',
        action: 'Measured',
        type: 'DocumentLoad.Under500ms',
      }),
    ).toBe(true);
  });

  it('rejects a timing with any other action, an unknown type, or none', () => {
    const base = { category: 'Timing', action: 'Measured' };
    expect(isValidTelemetryEvent({ ...base, action: 'Used', type: 'Save.Under100ms' })).toBe(false);
    expect(isValidTelemetryEvent({ ...base, type: 'Save.Under123ms' })).toBe(false);
    expect(isValidTelemetryEvent({ ...base, type: 'Anything' })).toBe(false);
    expect(isValidTelemetryEvent({ ...base, type: null })).toBe(false);
  });
});
