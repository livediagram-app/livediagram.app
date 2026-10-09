import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import { bytesToBase64 } from '@livediagram/api-schema';
import type { Runtime } from '../types';
import { driveMode, googleOAuthBase } from './config';

const KEY = bytesToBase64(new Uint8Array(32).fill(9));
const env = (vars: Partial<Runtime>) => vars as unknown as Runtime;

describe('driveMode', () => {
  it('is off without a client id, whatever else is set', () => {
    expect(driveMode(env({}))).toBe('off');
    expect(driveMode(env({ GOOGLE_CLIENT_SECRET: 's', DRIVE_TOKEN_KEY: KEY }))).toBe('off');
  });

  it('is browser with a client id alone, or with a secret but no usable key', () => {
    expect(driveMode(env({ GOOGLE_CLIENT_ID: 'id' }))).toBe('browser');
    expect(driveMode(env({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's' }))).toBe('browser');
    expect(
      driveMode(
        env({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's', DRIVE_TOKEN_KEY: 'short' }),
      ),
    ).toBe('browser');
  });

  it('is broker with the client id, the secret and a 32-byte key', () => {
    expect(
      driveMode(env({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's', DRIVE_TOKEN_KEY: KEY })),
    ).toBe('broker');
  });
});

describe('googleOAuthBase', () => {
  it("defaults to Google's endpoint and honours the test override without a trailing slash", () => {
    expect(googleOAuthBase(env({}))).toBe('https://oauth2.googleapis.com');
    expect(googleOAuthBase(env({ GOOGLE_OAUTH_BASE_URL: 'http://127.0.0.1:9000/' }))).toBe(
      'http://127.0.0.1:9000',
    );
    expect(googleOAuthBase(env({ GOOGLE_OAUTH_BASE_URL: 'http://127.0.0.1:9000///' }))).toBe(
      'http://127.0.0.1:9000',
    );
  });

  it('trims trailing slashes in linear time, whatever the value holds', () => {
    const long = `http://h/${'/'.repeat(200_000)}x`;
    let base = '';
    const spent = cpuMsOf(() => {
      base = googleOAuthBase(env({ GOOGLE_OAUTH_BASE_URL: long }));
    });
    expect(base).toBe(long);
    expect(spent).toBeLessThan(50);
  });
});
