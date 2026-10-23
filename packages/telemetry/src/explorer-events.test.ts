import { describe, expect, it } from 'vitest';
import { EXPLORER_TELEMETRY_EVENTS, isExplorerTelemetryEvent } from './explorer-events';
import { TELEMETRY_TYPE_PATTERN } from './wire';

describe("the Explorer's events", () => {
  it('takes a known pair with one of its own tokens, and nothing else', () => {
    expect(
      isExplorerTelemetryEvent({ category: 'Explorer', action: 'Selected', type: 'OpensIn' }),
    ).toBe(true);
    expect(isExplorerTelemetryEvent({ category: 'Activity', action: 'Opened' })).toBe(true);
    expect(isExplorerTelemetryEvent({ category: 'Activity', action: 'Opened', type: 'X' })).toBe(
      false,
    );
    expect(
      isExplorerTelemetryEvent({ category: 'Explorer', action: 'Selected', type: 'Free text' }),
    ).toBe(false);
    expect(isExplorerTelemetryEvent({ category: 'Project', action: 'Created' })).toBe(false);
  });

  it('holds only tokens the wire accepts', () => {
    for (const types of Object.values(EXPLORER_TELEMETRY_EVENTS)) {
      for (const type of types) if (type !== null) expect(type).toMatch(TELEMETRY_TYPE_PATTERN);
    }
  });
});
