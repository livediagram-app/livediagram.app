import { describe, expect, it } from 'vitest';
import {
  deepLink,
  errorResult,
  requireToken,
  shareUrl,
  textResult,
  type Extra,
} from './tool-helpers';

// The plumbing every MCP tool goes through (spec/62), and none of it had a
// test. `requireToken` is an auth boundary — it is the check standing between
// an unauthenticated caller and the api. The result helpers decide what an AI
// client actually receives, including whether it can tell a failure from a
// success.
//
// imageResult and its image resolver are deliberately not covered here: they
// need a WASM rasteriser and a fetch double, and what they add over
// renderElementsToSvg (already tested in packages/diagram) is I/O rather than
// logic. Testing them here would mostly assert the mocks.

// `token === undefined` means no authInfo at all; a passed '' really does
// reach requireToken as an empty token, which is the case worth testing.
const extra = (token?: string) =>
  ({ authInfo: token === undefined ? undefined : { token } }) as unknown as Extra;

describe('requireToken', () => {
  it('returns the bearer token when one was presented', () => {
    expect(requireToken(extra('tok_abc'))).toBe('tok_abc');
  });

  it('throws when there is no authInfo at all', () => {
    expect(() => requireToken({} as Extra)).toThrow(/unauthorized/i);
  });

  it('throws when authInfo carries no token', () => {
    expect(() => requireToken(extra())).toThrow(/unauthorized/i);
  });

  it('treats an empty-string token as absent', () => {
    // A blank Authorization header must not read as authenticated. `''` is
    // falsy, so this holds today — pinned because a change to `!== undefined`
    // would look equivalent and let a blank token through to the api.
    expect(() => requireToken(extra(''))).toThrow(/unauthorized/i);
  });

  it('fails closed rather than returning something falsy', () => {
    // The tools use the return value directly as a bearer token. Returning
    // undefined instead of throwing would send `Bearer undefined` to the api
    // and surface as a confusing 401 rather than a clear refusal.
    for (const bad of [{} as Extra, extra(), extra('')]) {
      expect(() => requireToken(bad)).toThrow();
    }
  });
});

describe('textResult', () => {
  it('wraps a value as pretty-printed JSON text', () => {
    const r = textResult({ id: 'd1', name: 'Roadmap' });
    expect(r.content).toHaveLength(1);
    expect(r.content[0]).toMatchObject({ type: 'text' });
    expect(JSON.parse((r.content[0] as { text: string }).text)).toEqual({
      id: 'd1',
      name: 'Roadmap',
    });
  });

  it('is not marked as an error', () => {
    // The MCP client branches on isError; a success that carried it would make
    // every tool call look failed.
    expect(textResult({}).isError).toBeUndefined();
  });
});

describe('errorResult', () => {
  it('marks the result as an error and passes the message through verbatim', () => {
    const r = errorResult('diagram not found');
    expect(r.isError).toBe(true);
    expect(r.content[0]).toEqual({ type: 'text', text: 'diagram not found' });
  });

  it('does not JSON-encode the message', () => {
    // The message is meant to be read by a model as prose. Quoting it would
    // put escaped quotes in front of whoever reads the failure.
    expect((errorResult('nope').content[0] as { text: string }).text).toBe('nope');
  });
});

describe('deepLink', () => {
  it('points at the diagram route on the production host', () => {
    expect(deepLink('abc-123')).toBe('https://livediagram.app/diagram/abc-123');
  });
});

describe('shareUrl', () => {
  it('points at the shared route with the code as a query param', () => {
    expect(shareUrl('AB12CD')).toBe('https://livediagram.app/diagram/shared?s=AB12CD');
  });

  it('escapes the code rather than pasting it into the query raw', () => {
    // Share codes are minted server-side, so this is defence rather than a
    // live bug — but the value lands in a URL a model may hand to a user, and
    // an unescaped `&` would silently truncate the code.
    expect(shareUrl('a&b=c')).toBe('https://livediagram.app/diagram/shared?s=a%26b%3Dc');
    expect(shareUrl('a b')).toBe('https://livediagram.app/diagram/shared?s=a%20b');
  });
});
