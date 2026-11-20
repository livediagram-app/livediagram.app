import { describe, expect, it } from 'vitest';
import {
  isPlatformHelpTelemetryEvent,
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

describe("the All Apps help's events", () => {
  it('takes article views and votes by id, search outcomes and scope moves', () => {
    for (const event of [
      { category: 'Help', action: 'View', type: 'using-tabs' },
      { category: 'Help', action: 'Helpful', type: 'tips-format-painter' },
      { category: 'Help', action: 'Unhelpful', type: 'sharing' },
      { category: 'Help', action: 'Searched', type: 'NoResults' },
      { category: 'Help', action: 'Changed', type: 'Scope.livediagram' },
    ])
      expect(isPlatformOwnTelemetryEvent(event), JSON.stringify(event)).toBe(true);
  });

  it('refuses anything else, never a query or a free word', () => {
    for (const event of [
      { category: 'Help', action: 'View' },
      { category: 'Help', action: 'Searched', type: 'share link' },
      { category: 'Help', action: 'Changed', type: 'Scope.liveworkspace' },
      { category: 'Help', action: 'Opened', type: 'using-tabs' },
      { category: 'Help', action: 'View', type: 'Using Tabs' },
    ])
      expect(isPlatformHelpTelemetryEvent(event), JSON.stringify(event)).toBe(false);
  });
});
