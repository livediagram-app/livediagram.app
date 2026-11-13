import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePositiveCap } from './limits';

// The hosted profile (docs/specs/016-platform/deployment.md "Hosted profile"):
// the vars livedesign.app's deploys add, and a fork's do not. Two promises
// hang on it: a fork deploying the repo as documented is telemetry-off and
// uncapped, and the hosted deployment's image caps survive every deploy. The commands and their
// checks are tested once, in @liveworkspace/api-kit's scripts/hosted-vars.test.ts.

type Profile = {
  shared: Record<string, string>;
  environments: Record<'production' | 'staging', Record<string, string>>;
};

interface HostedVarsModule {
  readHostedProfile: () => Profile;
}

// Computed URL so tsc doesn't try to resolve the untyped build script.
const scriptUrl = new URL('../scripts/hosted-vars.mjs', import.meta.url).href;
const load = async () => (await import(scriptUrl)) as HostedVarsModule;

const readApiFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url).href), 'utf8');

/** The `KEY = ...` names declared directly under one wrangler.toml table header. */
function tomlTableKeys(toml: string, header: string): string[] {
  const lines = toml.split('\n');
  const start = lines.findIndex((l) => l.trim() === `[${header}]`);
  if (start < 0) return [];
  const keys: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim().startsWith('[')) break;
    const m = /^([A-Z][A-Z0-9_]*)\s*=/.exec(line.trim());
    if (m) keys.push(m[1]!);
  }
  return keys;
}

describe('hosted profile', () => {
  it('turns telemetry on and points each environment at its media and Community services', async () => {
    const { shared, environments } = (await load()).readHostedProfile();
    expect(shared.TELEMETRY_ENABLED).toBe('true');
    expect(environments.production.MEDIA_URL).toBe('https://www.liveworkspace.app/api/media');
    expect(environments.staging.MEDIA_URL).toBe('https://staging.liveworkspace.app/api/media');
    expect(environments.production.COMMUNITY_URL).toBe(
      'https://www.liveworkspace.app/api/community',
    );
    expect(environments.staging.COMMUNITY_URL).toBe(
      'https://staging.liveworkspace.app/api/community',
    );
    expect(parsePositiveCap(shared.PHOTO_MAX_BYTES_PER_TAB)).toBe(512 * 1024 * 1024);
  });

  it('names only vars the worker reads', async () => {
    const types = readApiFile('src/types.ts');
    const { shared, environments } = (await load()).readHostedProfile();
    const names = [...Object.keys(shared), ...Object.keys(environments.production)];
    for (const name of names) {
      expect(types, `${name} is not on Env`).toMatch(new RegExp(`\\b${name}\\?: string;`));
    }
  });

  it('is never a committed default, so a fork is telemetry-off and uncapped', async () => {
    const { shared, environments } = (await load()).readHostedProfile();
    const hosted = [
      ...Object.keys(shared),
      ...Object.keys(environments.production),
      ...Object.keys(environments.staging),
    ];
    const toml = readApiFile('wrangler.toml');
    for (const table of ['vars', 'env.staging.vars']) {
      const declared = tomlTableKeys(toml, table).filter((k) => hosted.includes(k));
      expect(declared, `[${table}] declares hosted-only vars`).toEqual([]);
    }
    // Vacuity guard: the table reader must still see what IS committed.
    expect(tomlTableKeys(toml, 'vars')).toContain('INDEX_ORIGIN');
    expect(tomlTableKeys(toml, 'env.staging.vars')).toContain('INDEX_ORIGIN');
  });
});
