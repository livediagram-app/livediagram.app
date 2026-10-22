import { describe, expect, it } from 'vitest';
import { consentPage, SIGN_IN_SCRIPT, signInPage } from './pages.ts';

describe('pages', () => {
  it('escapes the Turnstile site key into its attribute', async () => {
    const html = await signInPage('"><script>x</script>').text();
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('data-sitekey="&#34;&#62;&#60;script&#62;x&#60;/script&#62;"');
  });

  it('cannot be framed and keeps the signed query out of Referer', () => {
    for (const response of [signInPage('k'), consentPage()]) {
      expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('ships a script that parses', () => {
    expect(() => new Function(SIGN_IN_SCRIPT)).not.toThrow();
  });
});
