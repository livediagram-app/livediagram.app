import { describe, expect, it } from 'vitest';
import { CONSENT_SCRIPT, consentPage, SIGN_IN_SCRIPT, signInPage, signUpPage } from './pages.ts';

const OPTIONS = { turnstileSiteKey: 'k', google: true };

describe('pages', () => {
  it('escapes the Turnstile site key into its attribute', async () => {
    for (const render of [signInPage, signUpPage]) {
      const html = await render({ turnstileSiteKey: '"><script>x</script>', google: false }).text();
      expect(html).not.toContain('<script>x</script>');
      expect(html).toContain('data-sitekey="&#34;&#62;&#60;script&#62;x&#60;/script&#62;"');
    }
  });

  it('cannot be framed and keeps the signed query out of Referer', () => {
    for (const response of [signInPage(OPTIONS), signUpPage(OPTIONS), consentPage()]) {
      expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('asks for a first and a last name on registration only', async () => {
    const signUp = await signUpPage(OPTIONS).text();
    const emailStep = signUp.slice(
      signUp.indexOf('id="email-step"'),
      signUp.indexOf('id="code-step"'),
    );
    expect(emailStep).toContain('autocomplete="given-name"');
    expect(emailStep).toContain('autocomplete="family-name"');
    expect(emailStep).toContain('data-flow="sign-up"');

    const signIn = await signInPage(OPTIONS).text();
    const signInEmail = signIn.slice(
      signIn.indexOf('id="email-step"'),
      signIn.indexOf('id="code-step"'),
    );
    expect(signInEmail).not.toContain('given-name');
    expect(signInEmail).toContain('data-flow="sign-in"');
  });

  it('never repeats an id, though both forms hold name fields', async () => {
    for (const response of [signInPage(OPTIONS), signUpPage(OPTIONS), consentPage()]) {
      const ids = [...(await response.text()).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('links each account page to the other', async () => {
    expect(await signInPage(OPTIONS).text()).toContain('href="/sign-up"');
    expect(await signUpPage(OPTIONS).text()).toContain('href="/sign-in"');
  });

  it('offers Google above the email form only when the Worker has a Google client', async () => {
    for (const render of [signInPage, signUpPage]) {
      const withGoogle = await render(OPTIONS).text();
      expect(withGoogle).toContain('Continue with Google');
      expect(withGoogle.indexOf('id="google"')).toBeLessThan(withGoogle.indexOf('id="email-step"'));
      expect(await render({ ...OPTIONS, google: false }).text()).not.toContain('id="google"');
    }
  });

  it('ships scripts that parse', () => {
    expect(() => new Function(SIGN_IN_SCRIPT)).not.toThrow();
    expect(() => new Function(CONSENT_SCRIPT)).not.toThrow();
  });
});
