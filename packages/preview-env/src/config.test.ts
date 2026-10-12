import { readFileSync } from 'node:fs';

import { parse } from 'smol-toml';
import { describe, expect, it } from 'vitest';

import { TIER_APPS, type PreviewApp, type PreviewTier } from './apps.ts';
import { previewConfig, type Table } from './config.ts';
import { parsePrNumber } from './names.ts';

const pr = parsePrNumber(123);
const D1_ID = '0b0e5a4c-1d2f-4a6b-9c8d-7e6f5a4b3c2d';

// The real configs, so a staging block that changes is caught here, not on a PR's deploy.
const source = (app: string): Table =>
  parse(readFileSync(new URL(`../../../apps/${app}/wrangler.toml`, import.meta.url), 'utf8'));

const generate = (app: PreviewApp, tier: PreviewTier, d1Id = D1_ID) =>
  previewConfig(source(app), { app, pr, tier, d1Id });

const previewEnv = (config: Table): Table => (config.env as { preview: Table }).preview;

const services = (config: Table) =>
  ((previewEnv(config).services ?? []) as { binding: string; service: string }[]).map(
    ({ binding, service }) => `${binding}=${service}`,
  );

describe.each(['preview', 'full'] as const)('every %s app', (tier) => {
  it.each(TIER_APPS[tier])('%s gets its PR worker name, no crons, only the preview env', (app) => {
    const config = generate(app, tier);
    expect(Object.keys(config.env as Table)).toEqual(['preview']);
    expect(previewEnv(config).name).toBe(`livediagram-${app}-pr-123`);
    const triggers = previewEnv(config).triggers as { crons: string[] } | undefined;
    if (triggers !== undefined) expect(triggers.crons).toEqual([]);
    // Top-level fields pass through so relative paths and the entry point resolve unchanged.
    expect(config.compatibility_date).toBe(source(app).compatibility_date);
  });
});

describe('a Preview', () => {
  it('routes the router to its own sites and staging api, on the PR host', () => {
    const router = generate('router', 'preview');
    expect(services(router)).toEqual([
      'MARKETING=livediagram-marketing-pr-123',
      'LIVE=livediagram-live-pr-123',
      'API=livediagram-api-staging',
      'TELEMETRY=livediagram-telemetry-pr-123',
      'HELP=livediagram-help-pr-123',
      'COMMUNITY=livediagram-community-pr-123',
    ]);
    expect(previewEnv(router).routes).toEqual([
      { pattern: 'pr-123.livediagram.app', custom_domain: true },
    ]);
    expect((previewEnv(router).vars as Table).DEPLOY_ENV).toBe('preview');
  });

  it('binds community to staging api', () => {
    expect(services(generate('community', 'preview'))).toEqual(['API=livediagram-api-staging']);
  });

  it('never generates an api', () => {
    expect(() => generate('api', 'preview')).toThrow(/^not-in-tier:/);
  });
});

describe('a Full preview', () => {
  it.each(['api', 'router', 'community'] as const)('%s names nothing on staging', (app) => {
    expect(JSON.stringify(previewEnv(generate(app, 'full')))).not.toMatch(/-staging"/);
  });

  it('gives the api its own D1, R2 and origin, and no crons', () => {
    const api = previewEnv(generate('api', 'full'));
    expect(api.d1_databases).toEqual([
      expect.objectContaining({
        binding: 'DB',
        database_name: 'livediagram-pr-123',
        database_id: D1_ID,
        migrations_dir: 'migrations',
      }),
    ]);
    expect(api.r2_buckets).toEqual([
      expect.objectContaining({ binding: 'IMAGES', bucket_name: 'livediagram-images-pr-123' }),
    ]);
    expect((api.vars as Table).AI_ALLOWED_ORIGINS).toBe('https://pr-123.livediagram.app');
    expect((api.vars as Table).APP_BASE_URL).toBe('https://pr-123.livediagram.app');
    expect(api.triggers).toEqual({ crons: [] });
    expect(api.durable_objects).toEqual(
      (source('api').env as { staging: Table }).staging.durable_objects,
    );
  });

  it.each(['', 'not-a-uuid'])('refuses an api without a D1 id (%j)', (d1Id) => {
    expect(() =>
      previewConfig(source('api'), { app: 'api', pr, tier: 'full', d1Id: d1Id || undefined }),
    ).toThrow(/^bad-d1:/);
  });

  it('clears crons a worker would only inherit from the top level', () => {
    const minimal = {
      triggers: { crons: ['0 3 * * *'] },
      env: { staging: { name: 'livediagram-help-staging' } },
    };
    expect(previewEnv(previewConfig(minimal, { app: 'help', pr, tier: 'full' })).triggers).toEqual({
      crons: [],
    });
  });
});

describe('refuses to guess', () => {
  const staging = (block: Table): Table => ({ env: { staging: block } });
  const help = (block: Table) =>
    previewConfig(staging({ name: 'livediagram-help-staging', ...block }), {
      app: 'help',
      pr,
      tier: 'preview',
    });
  const api = (block: Table) =>
    previewConfig(
      staging({
        name: 'livediagram-api-staging',
        vars: { AI_ALLOWED_ORIGINS: 'x' },
        d1_databases: [{ binding: 'DB', database_name: 'x', database_id: 'x' }],
        r2_buckets: [{ binding: 'IMAGES', bucket_name: 'x' }],
        ...block,
      }),
      { app: 'api', pr, tier: 'full', d1Id: D1_ID },
    );

  it('no-staging-env', () => {
    expect(() => previewConfig({}, { app: 'help', pr, tier: 'preview' })).toThrow(
      /^no-staging-env:/,
    );
    expect(() =>
      previewConfig({ env: { staging: 1 } }, { app: 'help', pr, tier: 'preview' }),
    ).toThrow(/^no-staging-env:/);
  });

  it('bad-name', () => {
    expect(() => help({ name: 'livediagram-help' })).toThrow(/^bad-name:/);
  });

  it('unknown-key', () => {
    expect(() => help({ queues: {} })).toThrow(/^unknown-key:/);
  });

  it('has-routes', () => {
    expect(() => help({ routes: [] })).toThrow(/^has-routes:/);
  });

  it('kv-in-preview', () => {
    expect(() => help({ kv_namespaces: [] })).toThrow(/^kv-in-preview:/);
  });

  it('bad-service', () => {
    expect(() => help({ services: [{ binding: 'X', service: 'livediagram-api' }] })).toThrow(
      /^bad-service:/,
    );
  });

  it('missing-var', () => {
    const router = (block: Table) =>
      previewConfig(staging({ name: 'livediagram-router-staging', ...block }), {
        app: 'router',
        pr,
        tier: 'preview',
      });
    expect(() => router({})).toThrow(/^missing-var:/);
    expect(() => router({ vars: {} })).toThrow(/^missing-var:/);
    expect(() => api({ vars: {} })).toThrow(/^missing-var:/);
  });

  it('bad-d1', () => {
    expect(() => api({ d1_databases: [] })).toThrow(/^bad-d1:/);
    expect(() => api({ d1_databases: [{ binding: 'OTHER' }] })).toThrow(/^bad-d1:/);
    expect(() => api({ d1_databases: 'DB' })).toThrow(/^bad-d1:/);
  });

  it('bad-r2', () => {
    expect(() => api({ r2_buckets: [] })).toThrow(/^bad-r2:/);
    expect(() => api({ r2_buckets: [{ binding: 'OTHER' }] })).toThrow(/^bad-r2:/);
  });
});
