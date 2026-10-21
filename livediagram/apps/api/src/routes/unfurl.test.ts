import { describe, expect, it } from 'vitest';
import { buildUnfurlResult, isBlockedHost, parsePublicHttpUrl } from './unfurl';

describe('isBlockedHost (SSRF guard)', () => {
  it('blocks loopback / localhost / .local / metadata + private ranges', () => {
    for (const h of [
      'localhost',
      'app.localhost',
      'printer.local',
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254', // cloud metadata
      '100.64.0.1', // CGNAT
      '0.0.0.0',
      '::1',
      '::',
      'fd00::1',
      'fe80::1',
      // IPv4-mapped IPv6: dotted + the hex form WHATWG URL normalises to.
      '::ffff:127.0.0.1',
      '::ffff:7f00:1', // 127.0.0.1
      '::ffff:a9fe:a9fe', // 169.254.169.254 (metadata)
      '::ffff:c0a8:1', // 192.168.0.1
      '[::ffff:7f00:1]', // bracketed (as a URL hostname arrives)
    ]) {
      expect(isBlockedHost(h), h).toBe(true);
    }
  });

  it('allows public hosts + public IPs', () => {
    for (const h of [
      'example.com',
      'sub.example.co.uk',
      '8.8.8.8',
      '172.32.0.1',
      '93.184.216.34',
      '::ffff:808:808', // 8.8.8.8 mapped — public, allowed
    ]) {
      expect(isBlockedHost(h), h).toBe(false);
    }
  });
});

describe('parsePublicHttpUrl', () => {
  it('accepts public http(s) urls', () => {
    expect(parsePublicHttpUrl('https://example.com/page')?.hostname).toBe('example.com');
    expect(parsePublicHttpUrl('http://example.com')?.protocol).toBe('http:');
  });

  it('rejects non-http schemes, garbage, and blocked hosts', () => {
    expect(parsePublicHttpUrl('file:///etc/passwd')).toBeNull();
    expect(parsePublicHttpUrl('javascript:alert(1)')).toBeNull();
    expect(parsePublicHttpUrl('ftp://example.com')).toBeNull();
    expect(parsePublicHttpUrl('not a url')).toBeNull();
    expect(parsePublicHttpUrl('http://localhost:3000')).toBeNull();
    expect(parsePublicHttpUrl('http://169.254.169.254/latest/meta-data')).toBeNull();
  });
});

describe('buildUnfurlResult', () => {
  const final = 'https://example.com/blog/post';

  it('prefers og:* over the bare tags and resolves relative image/favicon', () => {
    const out = buildUnfurlResult(
      {
        title: '<title> fallback',
        ogTitle: 'OG Title',
        ogSiteName: 'Example',
        ogDescription: 'desc',
        ogImage: '/img/cover.png',
        iconHref: '/assets/favicon.ico',
      },
      final,
    );
    expect(out).toEqual({
      url: final,
      title: 'OG Title',
      siteName: 'Example',
      description: 'desc',
      image: 'https://example.com/img/cover.png',
      favicon: 'https://example.com/assets/favicon.ico',
    });
  });

  it('falls back to <title> and /favicon.ico, and absolutises an already-absolute image', () => {
    const out = buildUnfurlResult(
      { title: 'Just a title', ogImage: 'https://cdn.example.com/x.jpg' },
      final,
    );
    expect(out.title).toBe('Just a title');
    expect(out.image).toBe('https://cdn.example.com/x.jpg');
    expect(out.favicon).toBe('https://example.com/favicon.ico');
    expect(out.siteName).toBeUndefined();
  });

  it('returns just the url when nothing was collected (favicon fallback still set)', () => {
    const out = buildUnfurlResult({}, final);
    expect(out.url).toBe(final);
    expect(out.title).toBeUndefined();
    expect(out.image).toBeUndefined();
    expect(out.favicon).toBe('https://example.com/favicon.ico');
  });
});
