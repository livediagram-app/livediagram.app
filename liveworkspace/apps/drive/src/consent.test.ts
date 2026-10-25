// The consent's addresses and the push channel's token (liveworkspace/docs/drive.md "Connecting", "Cadence").
import { describe, expect, it } from 'vitest';
import { channelPerson, channelToken } from './channel-token';
import { safeReturnTo } from './consent';
import type { Env } from './env';
import { TOKEN_KEY } from './test-support';

const env = {
  ENVIRONMENT: 'development',
  DRIVE_PUBLIC_URL: 'http://localhost:3000',
} as unknown as Env;

describe('safeReturnTo', () => {
  it('keeps liveworkspace’s pages and this environment’s apps', () => {
    expect(safeReturnTo(env, '/explorer?tab=1')).toBe('http://localhost:3000/explorer?tab=1');
    expect(safeReturnTo(env, 'http://localhost:3100/live/document/1')).toBe(
      'http://localhost:3100/live/document/1',
    );
  });

  it('sends anything else to the Explorer', () => {
    for (const bad of [
      'https://evil.test/',
      '//evil.test/x',
      'javascript:alert(1)',
      'http://u:p@localhost:3000/',
      42,
      '',
    ]) {
      expect(safeReturnTo(env, bad)).toBe('http://localhost:3000/explorer');
    }
    expect(
      safeReturnTo({ ...env, ENVIRONMENT: 'production' } as Env, 'http://localhost:3100/'),
    ).toBe('http://localhost:3000/explorer');
  });
});

describe('the channel token', () => {
  it('names the person it was made for, and nobody for a forged or another key’s token', async () => {
    const token = await channelToken(TOKEN_KEY, 'user_ada');
    expect(token.length).toBeLessThanOrEqual(256);
    expect(await channelPerson(TOKEN_KEY, token)).toBe('user_ada');
    expect(await channelPerson(TOKEN_KEY, token.replace('user_ada', 'user_bob'))).toBeNull();
    const otherKey = Buffer.alloc(32, 9).toString('base64');
    expect(await channelPerson(otherKey, token)).toBeNull();
    expect(await channelPerson(TOKEN_KEY, null)).toBeNull();
    expect(await channelPerson(TOKEN_KEY, 'x'.repeat(300))).toBeNull();
  });
});
