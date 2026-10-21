import { describe, expect, it } from 'vitest';

import { SECURITY_TXT_VALIDITY_DAYS, securityTxt } from './security-txt';

// docs/specs/002-project-scope/vulnerability-disclosure.md "security.txt".
describe('securityTxt', () => {
  const built = new Date('2026-10-06T09:30:15.123Z');
  const fields = Object.fromEntries(
    securityTxt(built)
      .trim()
      .split('\n')
      .map((line) => {
        const i = line.indexOf(': ');
        return [line.slice(0, i), line.slice(i + 2)];
      }),
  );

  it('points Contact at the private GitHub advisory form', () => {
    expect(fields.Contact).toBe(
      'https://github.com/livediagram-app/livediagram.app/security/advisories/new',
    );
  });

  it('expires one year after the build, in RFC 3339 without milliseconds', () => {
    expect(SECURITY_TXT_VALIDITY_DAYS).toBe(365);
    expect(fields.Expires).toBe('2027-10-06T09:30:15Z');
  });

  it('links the policy, language and canonical URL', () => {
    expect(fields.Policy).toBe('https://livediagram.app/help/policies/report-a-vulnerability/');
    expect(fields['Preferred-Languages']).toBe('en');
    expect(fields.Canonical).toBe('https://livediagram.app/.well-known/security.txt');
  });

  it('carries exactly the specified fields and ends with a newline', () => {
    expect(Object.keys(fields)).toEqual([
      'Contact',
      'Expires',
      'Policy',
      'Preferred-Languages',
      'Canonical',
    ]);
    expect(securityTxt(built).endsWith('\n')).toBe(true);
  });
});
