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

describe('aiEnabled (docs/specs/007-editor/ai-assistance.md)', () => {
  it('is off with no model key', async () => {
    expect((await capabilities({})).aiEnabled).toBe(false);
  });

  it('is on with one key', async () => {
    expect((await capabilities({ GOOGLE_AI_STUDIO_API_KEY: 'g' })).aiEnabled).toBe(true);
  });

  it('stays on with both named keys: they split the features, they do not cancel out', async () => {
    const both = { GOOGLE_AI_STUDIO_API_KEY: 'g', OPENAI_API_KEY: 'o' };
    expect((await capabilities(both)).aiEnabled).toBe(true);
  });
});

describe('the route', () => {
  it('is only GET', () => {
    const res = handleCapabilities(
      makeTestRouteContext('POST', '/api/capabilities', { env: {} as Env }),
    );
    expect(res.status).toBe(405);
  });

  it('has nothing beneath it', () => {
    const res = handleCapabilities(
      makeTestRouteContext('GET', '/api/capabilities/extra', { env: {} as Env }),
    );
    expect(res.status).toBe(404);
  });
});
