// The export service's routes (liveworkspace/docs/specs/003-accounts/data-export.md "The service"): accounts alone
// reaches them, through its EXPORT binding, with EXPORT_KEY_ACCOUNTS. Without the key every path is a plain 404.
//
//   POST   /internal/exports            StartExportCall   start an export: 202 { export } or 409 export_running
//   POST   /internal/exports/status     { keys }          { exports: { [key]: ExportView | null } }
//   GET    /internal/exports/<key>/file                   the zip, streamed from R2
//   DELETE /internal/exports/<key>                        stop it and delete its file

import {
  EXPORT_SERVICE_PATH,
  EXPORT_STATUS_KEYS_MAX,
  parseExportKey,
  type ExportScope,
  type ExportView,
  type StartExportCall,
} from '@liveworkspace/data-export';
import { timingSafeEqual } from '@liveworkspace/index-app/timing-safe';
import { setting } from './env';
import { objectKey } from './job/store';

/** The object's RPC, as the routes call it. */
export interface ExportObject {
  start(
    call: StartExportCall,
  ): Promise<{ ok: true; view: ExportView } | { ok: false; error: 'export_running' }>;
  status(): Promise<ExportView | null>;
  remove(): Promise<void>;
}

export type RouteDeps = {
  key: string | undefined;
  object: (key: string) => ExportObject;
  // The zip's bytes, or null when there is none.
  file: (r2Key: string) => Promise<{ body: ReadableStream; size: number } | null>;
  now: () => number;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
const notFound = () => json({ error: 'not_found' }, 404);
const badRequest = (message: string) => json({ error: 'bad_request', message }, 400);

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const body: unknown = await request.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

const isId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v);

/** A start call's body, checked: the key must name the scope it carries. */
export function parseStart(body: Record<string, unknown> | null): StartExportCall | null {
  if (!body) return null;
  const parsed = parseExportKey(body.key);
  const scope = body.scope as Record<string, unknown> | null | undefined;
  if (!parsed || !scope || !isId(body.requestedBy)) return null;
  let checked: ExportScope;
  if (
    parsed.kind === 'personal' &&
    scope.kind === 'personal' &&
    scope.personId === parsed.personId
  ) {
    checked = { kind: 'personal', personId: parsed.personId };
  } else if (
    parsed.kind === 'team' &&
    scope.kind === 'team' &&
    scope.teamId === parsed.teamId &&
    typeof scope.teamName === 'string'
  ) {
    checked = { kind: 'team', teamId: parsed.teamId, teamName: scope.teamName.slice(0, 200) };
  } else return null;
  const profile = body.profile;
  return {
    key: String(body.key),
    requestedBy: body.requestedBy,
    scope: checked,
    ...(profile && typeof profile === 'object' && !Array.isArray(profile)
      ? { profile: profile as Record<string, unknown> }
      : {}),
  };
}

export async function handle(request: Request, deps: RouteDeps): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(EXPORT_SERVICE_PATH)) return notFound();
  const expected = setting(deps.key);
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!expected) return notFound();
  if (!token || !(await timingSafeEqual(token, expected)))
    return json({ error: 'unauthorized' }, 401);

  const rest = url.pathname.slice(EXPORT_SERVICE_PATH.length).split('/').filter(Boolean);
  if (rest.length === 0 && request.method === 'POST') {
    const call = parseStart(await readJson(request));
    if (!call) return badRequest('invalid start');
    const started = await deps.object(call.key).start(call);
    return started.ok ? json({ export: started.view }, 202) : json({ error: started.error }, 409);
  }
  if (rest.length === 1 && rest[0] === 'status' && request.method === 'POST') {
    const keys = (await readJson(request))?.keys;
    if (
      !Array.isArray(keys) ||
      keys.length > EXPORT_STATUS_KEYS_MAX ||
      !keys.every((k) => parseExportKey(k) !== null)
    ) {
      return badRequest('keys must be export keys');
    }
    const unique = [...new Set(keys as string[])];
    const views = await Promise.all(unique.map((k) => deps.object(k).status()));
    return json({ exports: Object.fromEntries(unique.map((k, i) => [k, views[i]])) });
  }
  const key = rest[0] !== undefined ? decodeURIComponent(rest[0]) : '';
  if (!parseExportKey(key)) return notFound();
  if (rest.length === 2 && rest[1] === 'file' && request.method === 'GET') {
    const view = await deps.object(key).status();
    if (view?.status !== 'ready' || (view.expiresAt ?? 0) <= deps.now()) return notFound();
    const file = await deps.file(objectKey(key, view.id));
    if (!file) return notFound();
    return new Response(file.body, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(file.size),
        'Cache-Control': 'no-store',
        'X-Export-Id': view.id,
      },
    });
  }
  if (rest.length === 1 && request.method === 'DELETE') {
    await deps.object(key).remove();
    return new Response(null, { status: 204 });
  }
  return notFound();
}
