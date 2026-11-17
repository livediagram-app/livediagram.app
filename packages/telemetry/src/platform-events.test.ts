import { describe, expect, it } from 'vitest';
import {
  isPlatformOwnTelemetryEvent,
  KIT_TELEMETRY_ACTIONS,
  KIT_TELEMETRY_TYPES,
  PLATFORM_OWN_TELEMETRY_EVENTS,
} from './platform-events';
import { TELEMETRY_TYPE_PATTERN } from './wire';

describe("liveworkspace.app's own events", () => {
  it('takes each kit step with a kit token, and nothing else', () => {
    for (const action of KIT_TELEMETRY_ACTIONS) {
      for (const type of KIT_TELEMETRY_TYPES) {
        expect(isPlatformOwnTelemetryEvent({ category: 'Kit', action, type })).toBe(true);
      }
    }
    expect(isPlatformOwnTelemetryEvent({ category: 'Kit', action: 'Started' })).toBe(false);
    expect(
      isPlatformOwnTelemetryEvent({ category: 'Kit', action: 'Started', type: 'Anything' }),
    ).toBe(false);
    expect(
      isPlatformOwnTelemetryEvent({ category: 'Kit', action: 'Opened', type: 'SoftwareProject' }),
    ).toBe(false);
    expect(isPlatformOwnTelemetryEvent({ category: 'Document', action: 'Created' })).toBe(false);
  });

  it('holds only tokens the wire accepts, one pair per step', () => {
    expect(Object.keys(PLATFORM_OWN_TELEMETRY_EVENTS)).toEqual(
      KIT_TELEMETRY_ACTIONS.map((a) => `Kit·${a}`),
    );
    for (const type of KIT_TELEMETRY_TYPES) expect(type).toMatch(TELEMETRY_TYPE_PATTERN);
  });
});
