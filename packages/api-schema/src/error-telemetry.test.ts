import { describe, expect, it } from 'vitest';
import {
  apiRouteLabel,
  errorNameToken,
  errorPageToken,
  errorTypeToken,
  pascalToken,
} from './error-telemetry';
import { isValidTelemetryEvent } from './telemetry-schema';

// Error telemetry tokens (docs/specs/017-telemetry/telemetry.md): every Error source builds its `type`
// through these, so a token that failed TELEMETRY_TYPE_PATTERN would be
// dropped at ingest with nothing to notice. Pin the shape.

describe('pascalToken', () => {
  it('PascalCases words split on anything non-alphanumeric', () => {
    expect(pascalToken('save tab')).toBe('SaveTab');
    expect(pascalToken('room-ticket')).toBe('RoomTicket');
    expect(pascalToken('find_diagrams')).toBe('FindDiagrams');
    expect(pascalToken('PUT')).toBe('PUT');
  });

  it('drops separators that could smuggle a path or id shape', () => {
    expect(pascalToken('a/b:c?d')).toBe('ABCD');
  });
});

describe('errorTypeToken', () => {
  it('joins parts with a dot and skips empties', () => {
    expect(errorTypeToken('Http403', 'save tab')).toBe('Http403.SaveTab');
    expect(errorTypeToken('Uncaught', null, 'TypeError')).toBe('Uncaught.TypeError');
    expect(errorTypeToken('Http500', '')).toBe('Http500');
  });

  it('keeps the dots inside a dotted part such as a route label', () => {
    expect(errorTypeToken('Internal', apiRouteLabel('PUT', '/api/diagrams/x/tabs/y'))).toBe(
      'Internal.Put.Diagrams.Tabs',
    );
  });

  it('caps at 40 characters without leaving a trailing dot', () => {
    const t = errorTypeToken('UnhandledRejection', 'SsoCallback', 'QuotaExceededError');
    expect(t.length).toBeLessThanOrEqual(40);
    expect(t.startsWith('UnhandledRejection.SsoCallback')).toBe(true);
    expect(t.endsWith('.')).toBe(false);
  });

  it('always passes the ingest validator', () => {
    for (const t of [
      errorTypeToken('Internal', 'Put', 'Diagrams', 'Tabs', 'Comments'),
      errorTypeToken('Render', 'ContextMenu', 'ChunkLoadError'),
      errorTypeToken('Network', 'dismiss timeline events'),
    ]) {
      expect(isValidTelemetryEvent({ category: 'Error', action: 'Api', type: t })).toBe(true);
    }
  });
});

describe('errorNameToken', () => {
  it('keeps known constructor names', () => {
    expect(errorNameToken(new TypeError('x'))).toBe('TypeError');
    expect(errorNameToken(new Error('x'))).toBe('Error');
    const chunk = new Error('Loading chunk 12 failed');
    chunk.name = 'ChunkLoadError';
    expect(errorNameToken(chunk)).toBe('ChunkLoadError');
  });

  it('never forwards an arbitrary name', () => {
    const e = new Error('x');
    e.name = 'alice@example.com';
    expect(errorNameToken(e)).toBe('Other');
  });

  it('marks a thrown non-Error', () => {
    expect(errorNameToken('boom')).toBe('NonError');
    expect(errorNameToken(undefined)).toBe('NonError');
  });
});

describe('errorPageToken', () => {
  it('names the page by its first segment', () => {
    expect(errorPageToken('/diagram')).toBe('Diagram');
    expect(errorPageToken('/explorer/team')).toBe('Explorer');
    expect(errorPageToken('/sso-callback')).toBe('SsoCallback');
    expect(errorPageToken('/help/canvas/the-canvas')).toBe('Help');
    expect(errorPageToken('/')).toBe('Home');
  });

  it('is null when the path could not be normalised', () => {
    expect(errorPageToken(null)).toBeNull();
  });
});

describe('apiRouteLabel', () => {
  it('keeps the resource and route words, drops ids', () => {
    expect(apiRouteLabel('PUT', '/api/diagrams/0b7c5f9e-1111/tabs/abc123')).toBe(
      'Put.Diagrams.Tabs',
    );
    expect(apiRouteLabel('POST', 'https://livediagram.app/api/diagrams/x/tabs/y/comments')).toBe(
      'Post.Diagrams.Tabs.Comments',
    );
    expect(apiRouteLabel('GET', 'http://localhost:8787/api/timeline?cursor=abc')).toBe(
      'Get.Timeline',
    );
    expect(apiRouteLabel('GET', '/api/custom-themes')).toBe('Get.CustomThemes');
  });

  it('never echoes a share code or an unknown resource', () => {
    expect(apiRouteLabel('GET', '/api/share/SEKRITCODE')).toBe('Get.Share');
    expect(apiRouteLabel('GET', '/api/whatever/x')).toBe('Get.Unknown');
    expect(apiRouteLabel('GET', '/nope')).toBe('Get.Unknown');
  });
});
