import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS, withHelpHeaders } from './help-scope';

// What every product's help app guarded for itself (appearance-boot and trusted-types-sinks in each packages/ui), once,
// on the one help centre: its root layout boots Trusted Types and the pre-paint appearance script, and its Worker
// sends the Trusted Types header on every page.
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const layout = read('../app/layout.tsx');

describe('the help centre root layout', () => {
  it('boots the default Trusted Types policy before any other script', () => {
    const head = layout.slice(layout.search(/^\s*<head>$/m));
    const first = head.indexOf('<script');
    expect(head.slice(first, head.indexOf('/>', first))).toContain('htmlProps(TRUSTED_TYPES_BOOT)');
  });

  it('serves its own scripts under the /help asset prefix the build uses', () => {
    expect(layout).toMatch(/const TRUSTED_TYPES_BOOT = trustedTypesBootScript\(\s*'\/help'[,)]/);
    expect(read('../next.config.ts')).toMatch(/\bwithHelpSite\(/);
  });

  it('inlines the appearance script', () => {
    expect(layout).toMatch(/\{\.\.\.htmlProps\(APPEARANCE_BOOT_SCRIPT\)\}/);
  });

  it('stays a server component, so the script runs before hydration', () => {
    expect(layout).not.toMatch(/^\s*['"]use client['"]/m);
  });

  it('lets the pre-paint class differ from the static HTML', () => {
    expect(layout).toMatch(/<html[^>]*suppressHydrationWarning/);
  });

  it('paints a dark body under the dark class', () => {
    expect(layout).toMatch(/<body[^>]*className="[^"]*dark:bg-slate-950/);
  });
});

describe('the help Worker', () => {
  it('sends the Trusted Types header on every response', () => {
    const csp = withHelpHeaders(new Response('ok')).headers.get('content-security-policy');
    expect(csp).toBe(SECURITY_HEADERS['Content-Security-Policy']);
    expect(csp).toContain("require-trusted-types-for 'script'");
  });
});
