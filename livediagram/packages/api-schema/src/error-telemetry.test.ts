import { describe, expect, it } from 'vitest';
import { apiRouteLabel, errorTypeToken } from './error-telemetry';
import { isValidTelemetryEvent } from './telemetry-schema';

// This api's route labels, and the tokens built on them passing this app's ingest validator. The token helpers
// themselves are tested in @liveworkspace/telemetry (error-tokens.test.ts).

describe('errorTypeToken', () => {
  it('keeps the dots inside a dotted part such as a route label', () => {
    expect(errorTypeToken('Internal', apiRouteLabel('PUT', '/api/documents/x/tabs/y'))).toBe(
      'Internal.Put.Documents.Tabs',
    );
  });

  it('always passes the ingest validator', () => {
    for (const t of [
      errorTypeToken('Internal', 'Put', 'Documents', 'Tabs', 'Comments'),
      errorTypeToken('Render', 'ContextMenu', 'ChunkLoadError'),
      errorTypeToken('Network', 'dismiss timeline events'),
    ]) {
      expect(isValidTelemetryEvent({ category: 'Error', action: 'Api', type: t })).toBe(true);
    }
  });
});

describe('apiRouteLabel', () => {
  it('keeps the resource and route words, drops ids', () => {
    expect(apiRouteLabel('PUT', '/api/documents/0b7c5f9e-1111/tabs/abc123')).toBe(
      'Put.Documents.Tabs',
    );
    expect(
      apiRouteLabel(
        'POST',
        'https://livediagram-router.liveworkspace-easing509.workers.dev/api/documents/x/tabs/y/comments',
      ),
    ).toBe('Post.Documents.Tabs.Comments');
    expect(apiRouteLabel('GET', 'http://localhost:8787/api/teams?cursor=abc')).toBe('Get.Teams');
    expect(apiRouteLabel('GET', '/api/shape-libraries')).toBe('Get.ShapeLibraries');
    expect(apiRouteLabel('POST', '/api/trash/0b7c5f9e-1111/restore')).toBe('Post.Trash.Restore');
    // Explorer Home and the Timeline are the liveworkspace index's now, not this api's resources.
    expect(apiRouteLabel('GET', '/api/home?tz=Europe%2FAmsterdam')).toBe('Get.Unknown');
  });

  it('never echoes a share code or an unknown resource', () => {
    expect(apiRouteLabel('GET', '/api/share/SEKRITCODE')).toBe('Get.Share');
    expect(apiRouteLabel('GET', '/api/whatever/x')).toBe('Get.Unknown');
    expect(apiRouteLabel('GET', '/nope')).toBe('Get.Unknown');
  });
});
