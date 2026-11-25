// Whose access tokens the browser routes take, as deployed (subscription.md "The subscription Worker"): a page on an
// app's address (the Explorer each app serves, an editor's Settings) asks with that app's token, so every registered
// app's API is an audience here, in production and on staging, as it is for the index, Drive and the Community. An
// app left out reads as signed out on its own address: Work Tracker 1474, where liveknowledge's Explorer showed no Pro
// badge, plan or meter while every other app's did.
import { readFileSync } from 'node:fs';
import { appOrigins, REGISTERED_APP_SITES, type AppSiteId } from '@liveworkspace/sites';
import { beforeAll, describe, expect, it } from 'vitest';
import { audiences } from './env';
import { call, fromPage, signer, type Signer } from './test-kit';
import { testDb } from './test-sqlite-d1';

type Deployed = 'production' | 'staging';
const TABLES: Record<Deployed, string> = { production: 'vars', staging: 'env.staging.vars' };

const tomlOf = (app: string) =>
  readFileSync(new URL(`../../${app}/wrangler.toml`, import.meta.url).pathname, 'utf8');

// A `[vars]`-style table's text, by its header, up to the next table.
function table(toml: string, header: string): string {
  const start = toml.indexOf(`[${header}]\n`);
  expect(start, header).toBeGreaterThanOrEqual(0);
  const rest = toml.slice(start + header.length + 3);
  const next = rest.search(/^\[/m);
  return next === -1 ? rest : rest.slice(0, next);
}

/** The audiences a Worker's wrangler.toml deploys in `environment`, as its env reads them. */
function deployed(app: string, environment: Deployed): string[] {
  const vars = table(tomlOf(app), TABLES[environment]);
  const value = /^INDEX_AUDIENCES = "([^"]*)"$/m.exec(vars)?.[1];
  return audiences({ INDEX_AUDIENCES: value });
}

/** Every registered app's API resource in `environment`: what accounts mints its tokens for. */
const appApis = (environment: Deployed) =>
  REGISTERED_APP_SITES.map((site) => `${appOrigins(site.id as AppSiteId, environment)[0]}/api`);

describe.each(['production', 'staging'] as const)('the audiences deployed to %s', (environment) => {
  it('take every registered app’s API, liveknowledge’s included', () => {
    expect(deployed('subscription', environment).sort()).toEqual(appApis(environment).sort());
    expect(appApis(environment)).toContain(
      environment === 'staging'
        ? 'https://staging.liveknowledge.app/api'
        : 'https://liveknowledge.app/api',
    );
  });

  it('match every other service that checks a person’s token', () => {
    const ours = deployed('subscription', environment).sort();
    for (const service of ['index', 'drive', 'community']) {
      expect(deployed(service, environment).sort(), service).toEqual(ours);
    }
  });
});

describe('a page on each app’s address', () => {
  let keys: Signer;
  beforeAll(async () => {
    keys = await signer();
  });

  it.each(['production', 'staging'] as const)(
    'reads the person’s subscription with that app’s own token (%s)',
    async (environment) => {
      const env = {
        ...testDb().env,
        ...keys.env,
        ENVIRONMENT: environment,
        SITE_ORIGIN:
          environment === 'staging'
            ? 'https://staging.liveworkspace.app'
            : 'https://www.liveworkspace.app',
        INDEX_AUDIENCES: deployed('subscription', environment).join(','),
      };
      for (const site of REGISTERED_APP_SITES) {
        const origin = appOrigins(site.id as AppSiteId, environment)[0]!;
        const token = await keys.token('user_ada', {}, `${origin}/api`);
        const res = await call(env, '/me', fromPage(token, undefined, origin));
        expect(res.status, site.id).toBe(200);
        expect(res.headers.get('Access-Control-Allow-Origin'), site.id).toBe(origin);
      }
    },
  );

  it('reads as signed out to an app whose API is not an audience', async () => {
    const env = {
      ...testDb().env,
      ...keys.env,
      INDEX_AUDIENCES: 'https://livediagram.app/api',
    };
    const token = await keys.token('user_ada', {}, 'https://liveknowledge.app/api');
    const res = await call(env, '/me', fromPage(token));
    expect(res.status).toBe(401);
  });
});
