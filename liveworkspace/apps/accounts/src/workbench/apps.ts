// Each app's workbench dialect (liveworkspace/docs/workbench.md "Addresses"): the app a request is for, its word for
// an item as the item scope (`project`, `document`, `design`) with `<word>Id` for the item, and where its frame opens.
// The store keeps the scope as `item` or `workspace`; only the wire speaks the app's words.

import {
  APP_ITEMS,
  APP_NAMES,
  appOrigins,
  type AppName,
  type AppSiteId,
} from '@liveworkspace/sites';
import { WORKSPACE_PROXY_HEADER } from '@liveworkspace/sites/workspace-proxy';
import type { Env } from '../env.ts';
import type { WorkbenchScope } from './store.ts';

export const isAppName = (value: unknown): value is AppName =>
  typeof value === 'string' && (APP_NAMES as readonly string[]).includes(value);

// The app a request speaks for: the one whose address forwarded it (its router stamps its name), else the one it
// names in its body or query. Null when it names none.
export function appOfRequest(
  request: Request,
  body: Record<string, unknown> | null = null,
): AppName | null {
  const forwarded = request.headers.get(WORKSPACE_PROXY_HEADER);
  if (isAppName(forwarded)) return forwarded;
  const named = body?.app ?? new URL(request.url).searchParams.get('app');
  return isAppName(named) ? named : null;
}

export type Dialect = {
  app: string;
  // The item scope's word, and the field naming the item.
  noun: string;
  idField: string;
};

// A stored row's app is always one of the four; anything else speaks of a plain `item`.
export function dialectOf(app: string): Dialect {
  const noun = isAppName(app) ? APP_ITEMS[app].apiNoun : 'item';
  return { app, noun, idField: `${noun}Id` };
}

// The scope as the app says it, and back. Absent reads as the item scope, as it always has.
export const wireScope = (dialect: Dialect, scope: WorkbenchScope): string =>
  scope === 'item' ? dialect.noun : 'workspace';

export function scopeOfWire(dialect: Dialect, value: unknown): WorkbenchScope | null {
  if (value === undefined || value === dialect.noun) return 'item';
  if (value === 'workspace') return 'workspace';
  return null;
}

// The app's canonical address in this environment: where its frame and its pages are.
export function appBaseUrl(env: Pick<Env, 'ENVIRONMENT'>, app: AppName): string {
  return appOrigins(APP_ITEMS[app].site as AppSiteId, env.ENVIRONMENT)[0]!;
}
