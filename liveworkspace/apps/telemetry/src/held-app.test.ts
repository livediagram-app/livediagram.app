import { describe, expect, it } from 'vitest';
import {
  isServerEmittedEvent as isLivehuddleServerEvent,
  isValidTelemetryEvent as isLivehuddleEvent,
} from '@livehuddle/api-schema';
import { appKey } from './env';
import { testEnv } from './test-env';
import { VOCABULARIES } from './vocabularies';

// livehuddle, registered before its launch (liveworkspace/docs/specs/008-telemetry/telemetry.md "Adding an app").
describe('livehuddle in the telemetry service', () => {
  it('has a key of its own, and none while it is unset', () => {
    expect(appKey(testEnv(), 'livehuddle.app')).toBeUndefined();
    expect(appKey(testEnv({ TELEMETRY_KEY_LIVEHUDDLE: 'huddle' }), 'livehuddle.app')).toBe(
      'huddle',
    );
    expect(
      appKey(testEnv({ TELEMETRY_KEY_LIVEDIAGRAM: 'diagram' }), 'livehuddle.app'),
    ).toBeUndefined();
  });

  it("is checked against livehuddle's own api-schema, not livediagram's", () => {
    const vocabulary = VOCABULARIES['livehuddle.app'];
    expect(vocabulary.isValid).toBe(isLivehuddleEvent);
    expect(vocabulary.isServerOnly).toBe(isLivehuddleServerEvent);
    expect(vocabulary.isValid).not.toBe(VOCABULARIES['livediagram.app'].isValid);
    expect(vocabulary.isValid({ category: 'Document', action: 'Created' })).toBe(true);
    expect(vocabulary.isValid({ category: 'Nope', action: 'Nope' })).toBe(false);
  });
});
