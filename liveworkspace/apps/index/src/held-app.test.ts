import { describe, expect, it } from 'vitest';
import { appKey, appOrigin, type Env } from './env';

// livehuddle, registered before its launch (liveworkspace/docs/specs/004-index/one-explorer-contracts.md).
describe('livehuddle in the index service', () => {
  const env = { ENVIRONMENT: 'production', INDEX_DB: {} as D1Database } as Env;

  it('has a key and an origin of its own, and none while they are unset', () => {
    expect(appKey(env, 'livehuddle')).toBeUndefined();
    expect(appOrigin(env, 'livehuddle')).toBeUndefined();
    const set = {
      ...env,
      INDEX_KEY_LIVEHUDDLE: 'huddle',
      APP_ORIGIN_LIVEHUDDLE: 'https://www.livehuddle.app/',
    };
    expect(appKey(set, 'livehuddle')).toBe('huddle');
    expect(appOrigin(set, 'livehuddle')).toBe('https://www.livehuddle.app');
    // Another app's key is never livehuddle's.
    expect(appKey({ ...env, INDEX_KEY_LIVEDIAGRAM: 'diagram' }, 'livehuddle')).toBeUndefined();
  });
});
