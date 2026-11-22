import { describe, expect, it } from 'vitest';
import { deepLink, shareUrl } from './tool-helpers';

// This product's links. The result shapes and the token guard every product's tools share are
// tested in @liveworkspace/mcp-kit (tool-result.test.ts).

describe('deepLink', () => {
  it('points at the document route on the production host', () => {
    expect(deepLink({}, 'abc-123')).toBe('https://www.liveknowledge.app/document/abc-123');
  });

  it("points at this server's own app on staging", () => {
    const staging = { CONSENT_BASE_URL: 'https://staging.liveknowledge.app' };
    expect(deepLink(staging, 'abc')).toBe('https://staging.liveknowledge.app/document/abc');
    expect(shareUrl(staging, 'AB')).toBe('https://staging.liveknowledge.app/document/shared?s=AB');
  });
});

describe('shareUrl', () => {
  it('points at the shared route with the code as a query param', () => {
    expect(shareUrl({}, 'AB12CD')).toBe('https://www.liveknowledge.app/document/shared?s=AB12CD');
  });

  it('escapes the code rather than pasting it into the query raw', () => {
    // Share codes are minted server-side, so this is defence rather than a
    // live bug — but the value lands in a URL a model may hand to a user, and
    // an unescaped `&` would silently truncate the code.
    expect(shareUrl({}, 'a&b=c')).toBe('https://www.liveknowledge.app/document/shared?s=a%26b%3Dc');
    expect(shareUrl({}, 'a b')).toBe('https://www.liveknowledge.app/document/shared?s=a%20b');
  });
});
