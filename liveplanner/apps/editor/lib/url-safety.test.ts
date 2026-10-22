import { describe, expect, it } from 'vitest';
import { isSafeFollowUrl, normaliseUrl } from './url-safety';

describe('normaliseUrl (link scheme allowlist)', () => {
  it('prepends https:// to a bare host', () => {
    expect(normaliseUrl('example.com/path')).toBe('https://example.com/path');
    expect(normaliseUrl('  example.com  ')).toBe('https://example.com');
  });

  it('keeps http / https / mailto as-is', () => {
    expect(normaliseUrl('http://example.com')).toBe('http://example.com');
    expect(normaliseUrl('https://example.com')).toBe('https://example.com');
    expect(normaliseUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
  });

  it('rejects javascript / data / vbscript / file schemes', () => {
    expect(normaliseUrl('javascript:alert(1)')).toBeNull();
    expect(normaliseUrl('JaVaScRiPt:alert(1)')).toBeNull();
    expect(normaliseUrl('data:text/html,<script>x</script>')).toBeNull();
    expect(normaliseUrl('vbscript:msgbox(1)')).toBeNull();
    expect(normaliseUrl('file:///etc/passwd')).toBeNull();
    expect(normaliseUrl('')).toBeNull();
    expect(normaliseUrl('   ')).toBeNull();
  });
});

describe('isSafeFollowUrl (follow-time guard)', () => {
  it('allows http / https / mailto', () => {
    expect(isSafeFollowUrl('https://example.com')).toBe(true);
    expect(isSafeFollowUrl('mailto:a@b.com')).toBe(true);
  });
  it('blocks javascript / data and unparseable', () => {
    expect(isSafeFollowUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeFollowUrl('data:text/html,x')).toBe(false);
    expect(isSafeFollowUrl('not a url')).toBe(false);
  });
});
