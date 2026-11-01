import { isMediaApp, MEDIA_APPS } from '@liveworkspace/media';
import { describe, expect, it } from 'vitest';
import { appDoor, appKey, indexAppOf, keyedApps, type Env } from './env';

// livehuddle, registered before its launch (liveworkspace/docs/specs/006-media/media.md).
describe('livehuddle in the media service', () => {
  it('is a media app, the index knowing it as livehuddle', () => {
    expect(MEDIA_APPS).toContain('livehuddle.app');
    expect(isMediaApp('livehuddle.app')).toBe(true);
    expect(indexAppOf('livehuddle.app')).toBe('livehuddle');
  });

  it('uses the service only once given its key, and has its export door with its origin', () => {
    const env = { MEDIA_DB: {} as D1Database } as Env;
    expect(appKey(env, 'livehuddle.app')).toBeUndefined();
    expect(keyedApps(env)).toEqual([]);
    expect(
      appDoor({ ...env, APP_ORIGIN_LIVEHUDDLE: 'https://www.livehuddle.app' }, 'livehuddle'),
    ).toBeNull();
    const keyed = {
      ...env,
      MEDIA_KEY_LIVEHUDDLE: 'huddle',
      APP_ORIGIN_LIVEHUDDLE: 'https://www.livehuddle.app/',
    };
    expect(keyedApps(keyed)).toEqual(['livehuddle.app']);
    expect(appDoor(keyed, 'livehuddle')).toEqual({
      origin: 'https://www.livehuddle.app',
      key: 'huddle',
    });
  });
});
