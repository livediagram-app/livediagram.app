// The pages that may talk to the service and be gone back to (subscription.md "The subscription Worker"): the site
// and every app, on the addresses they answer on in this environment. In development any page on this machine counts,
// as it does for the Community.

import { isLocalhostOrigin } from '@liveworkspace/index-app/worker-http';
import { appOrigins, REGISTERED_APP_SITES, type AppSiteId } from '@liveworkspace/sites';
import { RETURN_TO_MAX } from './config';
import { environmentOf, siteOrigin, type Env, type Environment } from './env';

const SITE_ORIGINS: Record<Environment, readonly string[]> = {
  production: ['https://www.liveworkspace.app', 'https://liveworkspace.app'],
  staging: ['https://staging.liveworkspace.app'],
  development: ['http://localhost:3000', 'http://127.0.0.1:3000'],
};

// Worked out once per environment for the life of the isolate.
const known = new Map<string, ReadonlySet<string>>();

function knownOrigins(env: Env): ReadonlySet<string> {
  const environment = environmentOf(env);
  const site = siteOrigin(env);
  const key = `${environment} ${site}`;
  let origins = known.get(key);
  if (!origins) {
    origins = new Set([
      site,
      ...SITE_ORIGINS[environment],
      ...REGISTERED_APP_SITES.flatMap((app) => appOrigins(app.id as AppSiteId, environment)),
    ]);
    known.set(key, origins);
  }
  return origins;
}

/** Whether `origin` is the site's or an app's in this environment. */
export function isKnownOrigin(env: Env, origin: string): boolean {
  if (knownOrigins(env).has(origin)) return true;
  return environmentOf(env) === 'development' && isLocalhostOrigin(origin);
}

/** A `returnTo` the service will send someone back to: an absolute http(s) URL on the site or a known app, with no
 *  credentials in it. Null for anything else. */
export function safeReturnTo(env: Env, value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > RETURN_TO_MAX) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;
  return isKnownOrigin(env, url.origin) ? url.toString() : null;
}
