import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import config from '../playwright.config';

// docs/specs/003-system-architecture/e2e-smoke.md "When it runs": the smoke shards build only live, so a spec that
// opens another app's build (help, telemetry, marketing) runs in the `sites` project, whose job builds them, and
// never in `chromium`. marketing-header-fit.spec.ts once ran in the shards, against a marketing they never built.
const dir = fileURLToPath(new URL('.', import.meta.url));
const OTHER_BUILD = /E2E_(MARKETING|HELP|TELEMETRY)_(URL|PORT)/;

const project = (name: string) => config.projects!.find((p) => p.name === name)!;
const matches = (pattern: string | RegExp | (string | RegExp)[] | undefined, file: string) =>
  [pattern ?? []].flat().some((p) => (typeof p === 'string' ? file.includes(p) : p.test(file)));

describe('specs that open another build', () => {
  const specs = readdirSync(dir).filter(
    (f) => f.endsWith('.spec.ts') && OTHER_BUILD.test(readFileSync(`${dir}/${f}`, 'utf8')),
  );

  it('are found', () => {
    expect(specs).toContain('marketing-header-fit.spec.ts');
  });

  it.each(specs)('%s runs in sites, not in the smoke shards', (spec) => {
    expect(matches(project('sites').testMatch, spec)).toBe(true);
    expect(matches(project('chromium').testIgnore, spec)).toBe(true);
  });
});
