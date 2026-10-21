import { describe, expect, it } from 'vitest';
import { isLocalhostPair } from './origin-check';

// isLocalhostPair widens the telemetry endpoint's same-origin filter
// to admit cross-port localhost dev (the live editor on :3002 / the
// telemetry dashboard on :3003 posting to the api worker on :8787),
// while keeping the filter strict in production where no Origin
// header should ever be a loopback. Three failure modes matter:
//
//   1. False on either side returning a non-loopback hostname: lets
//      production drive-by cross-site posters through the filter.
//   2. False on malformed input: a thrown URL parse must not leak as
//      `true`, otherwise a missing Origin / a garbage header value
//      could route around the filter.
//   3. True on the recognised loopback hostnames (`localhost`,
//      `127.0.0.1`, IPv6 `[::1]`) so dev actually works.

describe('isLocalhostPair', () => {
  describe('returns true for', () => {
    it('localhost on both sides, different ports', () => {
      expect(isLocalhostPair('http://localhost:3002', 'http://localhost:8787')).toBe(true);
    });

    it('localhost vs 127.0.0.1 (treats the textual + IPv4 loopback aliases as equivalent)', () => {
      // The live editor's Origin header is whatever the browser chose
      // when navigating; users land on either spelling depending on
      // how they typed the URL. The helper must treat them the same
      // or local dev breaks on a coin flip.
      expect(isLocalhostPair('http://localhost:3002', 'http://127.0.0.1:8787')).toBe(true);
      expect(isLocalhostPair('http://127.0.0.1:3002', 'http://localhost:8787')).toBe(true);
    });

    it('IPv6 loopback `[::1]` on either side', () => {
      // node and modern browsers will emit Origin headers with bracketed
      // IPv6 literals, and URL.hostname round-trips the brackets, so
      // the helper compares the bracketed form. Without this branch a
      // dev machine that resolved localhost to ::1 would lose telemetry.
      expect(isLocalhostPair('http://[::1]:3002', 'http://localhost:8787')).toBe(true);
      expect(isLocalhostPair('http://localhost:3002', 'http://[::1]:8787')).toBe(true);
      expect(isLocalhostPair('http://[::1]:3002', 'http://[::1]:8787')).toBe(true);
    });

    it('https loopback URLs (scheme is irrelevant)', () => {
      // The scheme doesn't change the hostname check, but pinning
      // this makes the docs/specs/017-telemetry/telemetry.md invariant explicit: it's about
      // hostname, not protocol.
      expect(isLocalhostPair('https://localhost:8443', 'https://localhost:8444')).toBe(true);
    });
  });

  describe('returns false for', () => {
    it('production hostname on either side', () => {
      // The whole point of the filter: a request from livediagram.app
      // to a victim's local server, or from a malicious site to
      // livediagram.app, must not be granted dev-only escape.
      expect(isLocalhostPair('https://livediagram.app', 'http://localhost:8787')).toBe(false);
      expect(isLocalhostPair('http://localhost:3002', 'https://livediagram.app')).toBe(false);
      expect(isLocalhostPair('https://example.com', 'https://livediagram.app')).toBe(false);
    });

    it('a hostname that contains "localhost" as a substring', () => {
      // Strict equality, not substring match, so a typosquat like
      // `localhost.example.com` doesn't claim dev privileges.
      expect(isLocalhostPair('http://localhost.example.com', 'http://localhost:8787')).toBe(false);
      expect(isLocalhostPair('http://localhost', 'http://mylocalhost')).toBe(false);
    });

    it('an empty string on either side', () => {
      // `new URL('')` throws; the try/catch must catch and return
      // false rather than letting the error propagate or accidentally
      // returning true for an absent Origin.
      expect(isLocalhostPair('', 'http://localhost:8787')).toBe(false);
      expect(isLocalhostPair('http://localhost:3002', '')).toBe(false);
    });

    it('a malformed URL on either side', () => {
      // Same catch path: a `null` header that becomes the literal
      // string "null", or a garbage value, must not slip through.
      expect(isLocalhostPair('not a url', 'http://localhost:8787')).toBe(false);
      expect(isLocalhostPair('http://localhost:3002', 'also not a url')).toBe(false);
      expect(isLocalhostPair('null', 'null')).toBe(false);
    });

    it('IPv4 addresses that look loopback-adjacent but are not 127.0.0.1', () => {
      // 127.0.0.0/8 is technically all loopback, but the helper only
      // recognises the canonical 127.0.0.1 (matching what browsers
      // actually emit). Pinning the strict comparison here so a
      // future "let me accept all of 127/8" change is deliberate.
      expect(isLocalhostPair('http://127.0.0.2', 'http://localhost:8787')).toBe(false);
      expect(isLocalhostPair('http://0.0.0.0', 'http://localhost:8787')).toBe(false);
    });
  });
});
