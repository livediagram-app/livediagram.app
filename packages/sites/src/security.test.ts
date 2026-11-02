import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_NAMES } from './index';
import {
  appSecurityPolicy,
  PUBLIC_REPO_URL,
  SECURITY_ADVISORY_URL,
  SECURITY_POLICY_URL,
  SECURITY_TXT_VALIDITY_DAYS,
  securityTxt,
  securityTxtResponse,
} from './security';

// liveworkspace/docs/specs/001-platform-scope/vulnerability-disclosure.md.

const DAY_MS = 24 * 60 * 60 * 1000;
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function fieldsOf(text: string): Record<string, string> {
  return Object.fromEntries(
    text
      .trim()
      .split('\n')
      .map((line) => {
        const i = line.indexOf(': ');
        return [line.slice(0, i), line.slice(i + 2)];
      }),
  );
}

describe('the reporting addresses', () => {
  it('are GitHub private advisories on the one public repository', () => {
    expect(PUBLIC_REPO_URL).toBe('https://github.com/livediagram-app/livediagram.app');
    expect(SECURITY_ADVISORY_URL).toBe(`${PUBLIC_REPO_URL}/security/advisories/new`);
    expect(SECURITY_POLICY_URL).toBe(`${PUBLIC_REPO_URL}/security/policy`);
  });

  it("puts an app's policy in its help centre", () => {
    expect(appSecurityPolicy('https://www.liveplanner.app')).toBe(
      'https://www.liveplanner.app/help/policies/report-a-vulnerability/',
    );
  });
});

describe('securityTxt', () => {
  const site = {
    origin: 'https://www.livediagram.app',
    policy: 'https://www.livediagram.app/help/policies/report-a-vulnerability/',
  };
  const built = new Date('2026-10-06T09:30:15.123Z');
  const text = securityTxt(site, built);
  const fields = fieldsOf(text);

  it('carries exactly the RFC 9116 fields the spec names, in order, ending with a newline', () => {
    expect(Object.keys(fields)).toEqual([
      'Contact',
      'Expires',
      'Policy',
      'Preferred-Languages',
      'Canonical',
    ]);
    expect(text.endsWith('\n')).toBe(true);
  });

  it('points Contact at the private advisory form, and names the policy, language and canonical address', () => {
    expect(fields.Contact).toBe(SECURITY_ADVISORY_URL);
    expect(fields.Policy).toBe(site.policy);
    expect(fields['Preferred-Languages']).toBe('en');
    expect(fields.Canonical).toBe('https://www.livediagram.app/.well-known/security.txt');
  });

  it('expires one year after the build, in RFC 3339 without milliseconds', () => {
    expect(fields.Expires).toBe('2027-10-06T09:30:15Z');
  });

  // The file is built at deploy time, so this is what a deploy today ships. RFC 9116 recommends under a year; under
  // half a year would leave a site that deploys rarely serving a lapsed file.
  it('gives a build today an Expires between half a year and a year ahead', () => {
    const now = new Date();
    const expires = Date.parse(fieldsOf(securityTxt(site, now)).Expires!);
    const days = (expires - now.getTime()) / DAY_MS;
    expect(days).toBeGreaterThanOrEqual(183);
    expect(days).toBeLessThanOrEqual(366);
    expect(SECURITY_TXT_VALIDITY_DAYS).toBeLessThanOrEqual(365);
  });

  it('is answered as UTF-8 plain text', async () => {
    const res = securityTxtResponse(site, built);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(await res.text()).toBe(text);
  });

  it('defaults to the time it is asked', async () => {
    const before = Date.now();
    const expires = Date.parse(fieldsOf(await securityTxtResponse(site).text()).Expires!);
    expect(expires).toBeGreaterThanOrEqual(before + (SECURITY_TXT_VALIDITY_DAYS * DAY_MS - 1000));
  });
});

describe('every site serves it', () => {
  const read = (path: string) => readFileSync(`${ROOT}${path}`, 'utf8');

  it.each(APP_NAMES)(
    '%s: its marketing site, with its own www. address and help-centre policy',
    (app) => {
      const route = read(`${app}/apps/marketing/app/.well-known/security.txt/route.ts`);
      expect(route).toContain(`import { SITE_URL } from '@${app}/ui';`);
      expect(route).toContain(
        'securityTxtResponse({ origin: SITE_URL, policy: appSecurityPolicy(SITE_URL) })',
      );
      expect(route).toContain("export const dynamic = 'force-static';");
      expect(read(`${app}/packages/ui/src/site.ts`)).toContain(
        `export const SITE_URL = 'https://www.${app}.app';`,
      );
    },
  );

  it('liveworkspace.app: the site, with the repository security policy', () => {
    const route = read('liveworkspace/apps/site/app/.well-known/security.txt/route.ts');
    expect(route).toContain(
      'securityTxtResponse({ origin: PRODUCTION_WORKSPACE_ORIGIN, policy: SECURITY_POLICY_URL })',
    );
    expect(route).toContain("export const dynamic = 'force-static';");
  });
});

// Prose can't import SECURITY_ADVISORY_URL, so every copy of it in a tracked file is held to it here: renaming the
// repository is changing PUBLIC_REPO_URL, then fixing what this names.
describe('every advisory link in the repository', () => {
  const TEXT_FILE = /\.(?:ts|tsx|mts|js|mjs|md|mdx|json|toml|ya?ml|txt)$/;
  const files = execFileSync('git', ['ls-files'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\n')
    .filter((f) => TEXT_FILE.test(f) && !f.endsWith('pnpm-lock.yaml') && existsSync(`${ROOT}${f}`));

  it('names the shared advisory form, and no security mailbox', () => {
    const advisory = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/security\/advisories(?:\/new)?/g;
    const mailbox = /\bsecurity@live\w+\.app\b/g;
    const wrong: string[] = [];
    let seen = 0;
    for (const f of files) {
      const text = readFileSync(`${ROOT}${f}`, 'utf8');
      for (const [link] of text.matchAll(advisory)) {
        seen++;
        if (link !== SECURITY_ADVISORY_URL) wrong.push(`${f}: ${link}`);
      }
      for (const [address] of text.matchAll(mailbox)) wrong.push(`${f}: ${address}`);
    }
    expect(wrong).toEqual([]);
    // The root SECURITY.md, each product's, each README and each help article at least.
    expect(seen).toBeGreaterThanOrEqual(10);
  });
});
