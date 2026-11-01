import { describe, expect, it } from 'vitest';
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

  it("is checked against livediagram's vocabulary, which it is forked from, until its own lands", () => {
    const created = { category: 'Document', action: 'Created' };
    expect(VOCABULARIES['livehuddle.app'].isValid(created)).toBe(
      VOCABULARIES['livediagram.app'].isValid(created),
    );
    expect(VOCABULARIES['livehuddle.app'].isValid({ category: 'Nope', action: 'Nope' })).toBe(
      false,
    );
    expect(VOCABULARIES['livehuddle.app'].isServerOnly).toBe(
      VOCABULARIES['livediagram.app'].isServerOnly,
    );
  });
});
