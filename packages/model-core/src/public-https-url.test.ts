// The shared public https address check (liveworkspace/docs/specs/004-index/webhooks.md "Security").
import { describe, expect, it } from 'vitest';
import { INTERNAL_HOST_SUFFIXES, parsePublicHttpsUrl } from './public-https-url';

describe('parsePublicHttpsUrl', () => {
  it('takes an https URL on 443 with a host name, lowercasing it and dropping a trailing dot', () => {
    const ok = parsePublicHttpsUrl('  https://Status.Example.com:443/api/v2/status.json  ');
    expect(ok).toMatchObject({ ok: true, host: 'status.example.com' });
    expect(parsePublicHttpsUrl('https://example.com./x')).toMatchObject({ host: 'example.com' });
  });

  it.each([
    ['not a string', 42],
    ['empty', '   '],
    ['too long', `https://example.com/${'a'.repeat(2048)}`],
    ['not a URL', 'example.com/health'],
    ['plain HTTP', 'http://example.com/health'],
    ['another scheme', 'javascript:alert(1)'],
    ['credentials', 'https://user:pass@example.com/health'],
    ['a user name', 'https://user@example.com/health'],
    ['another port', 'https://example.com:8443/health'],
  ])('refuses %s as invalid', (_, url) => {
    expect(parsePublicHttpsUrl(url)).toEqual({ ok: false, error: 'invalid' });
  });

  it('holds a URL to the length it is given', () => {
    expect(parsePublicHttpsUrl('https://example.com/abc', 20)).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(parsePublicHttpsUrl('https://example.com/abc', 23).ok).toBe(true);
  });

  it.each([
    'https://127.0.0.1/health',
    'https://0x7f000001/health',
    'https://8.8.8.8/health',
    'https://[::1]/health',
    'https://[2606:4700::1111]/health',
    'https://localhost/health',
    'https://intranet/health',
    'https://printer.local/health',
    'https://db.internal/health',
    'https://nas.home.arpa/health',
    'https://router.lan/health',
    'https://a.localhost/health',
    'https://wiki.intranet/health',
  ])('refuses %s as private: an address, or a name that never leaves a network', (url) => {
    expect(parsePublicHttpsUrl(url)).toEqual({ ok: false, error: 'private' });
  });

  it('names every internal suffix with its leading dot', () => {
    expect(INTERNAL_HOST_SUFFIXES.every((s) => s.startsWith('.'))).toBe(true);
  });
});
