import { describe, expect, it } from 'vitest';
import { bytesToBase64 } from '@livediagram/api-schema';
import type { Env } from '../types';
import { handleCapabilities } from './capabilities';
import { makeTestRouteContext } from './test-route-context';

// GET /api/capabilities reports the optional features the deployment has
// configured, so the app can hide the rest.

async function capabilities(env: Partial<Env>) {
  const res = handleCapabilities(
    makeTestRouteContext('GET', '/api/capabilities', { env: env as Env }),
  );
  return (await res.json()) as Record<string, unknown>;
}

describe('driveMode (docs/specs/022-drive-mirror/drive-mirror.md)', () => {
  it('is off, browser or broker by the Google env the worker holds', async () => {
    expect((await capabilities({})).driveMode).toBe('off');
    expect((await capabilities({ GOOGLE_CLIENT_ID: 'c' })).driveMode).toBe('browser');
    expect(
      (
        await capabilities({
          GOOGLE_CLIENT_ID: 'c',
          GOOGLE_CLIENT_SECRET: 's',
          DRIVE_TOKEN_KEY: bytesToBase64(new Uint8Array(32)),
        })
      ).driveMode,
    ).toBe('broker');
  });
});
