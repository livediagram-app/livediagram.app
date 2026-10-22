import { TELEMETRY_APPS } from '@liveworkspace/telemetry';
import { describe, expect, it } from 'vitest';
import { appKey } from './env';
import { testEnv } from './test-env';

describe('appKey', () => {
  it('gives each app its own key, and none to an app whose key is unset', () => {
    const env = testEnv({
      TELEMETRY_KEY_LIVEDIAGRAM: 'diagram',
      TELEMETRY_KEY_LIVEPLANNER: 'planner',
    });
    expect(appKey(env, 'livediagram.app')).toBe('diagram');
    expect(appKey(env, 'liveplanner.app')).toBe('planner');
    expect(appKey(env, 'livedocuments.app')).toBeUndefined();
    expect(appKey(env, 'livedesign.app')).toBeUndefined();
    const keys = TELEMETRY_APPS.map((app) =>
      appKey(
        { ...env, TELEMETRY_KEY_LIVEDOCUMENTS: 'docs', TELEMETRY_KEY_LIVEDESIGN: 'design' },
        app,
      ),
    );
    expect(new Set(keys).size).toBe(TELEMETRY_APPS.length);
  });
});
