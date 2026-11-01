// Download Your Data's doors on accounts (liveworkspace/docs/specs/003-accounts/data-export.md "The service"):
//   GET  /api/account/data-export                 the signed-in person's export and each team's they administer
//   POST /api/account/data-export {team?}         start theirs, or a team's they administer
//   GET  /api/account/data-export/download        the emailed link: its signature, their session, then the zip
//   POST /api/account/internal/data-export/ready  the export service, EXPORT_KEY_ACCOUNTS: send the email
// The admin check is accounts' own records, never a token's claim, at the start and again at the download.
import {
  exportFileName,
  exportKeyOf,
  EXPORT_STATUS_KEYS_MAX,
  parseExportKey,
  type DataExportState,
  type ExportLinkRefusal,
  type ExportReadyCall,
  type ExportView,
} from '@liveworkspace/data-export';
import { sendEmail } from '../email.ts';
import type { Env } from '../env.ts';
import { readOwnProfile } from '../profiles.ts';
import { sameSecret } from '../secrets.ts';
import { readSettings } from '../settings.ts';
import { exportEmail } from './email.ts';
import { checkLink, linkUrl } from './link.ts';
import { exportService, type ExportService } from './service.ts';

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const error = (status: number, code: string) => json({ error: code }, status);

export type Signed = { id: string; name: string; email: string | null };

type AdminTeam = { id: string; name: string };

// The teams the person administers now, by name: at most one status call's worth beside their own.
export async function adminTeams(db: D1Database, userId: string): Promise<AdminTeam[]> {
  const { results } = await db
    .prepare(
      `SELECT t.id, t.name FROM team_member m JOIN team t ON t.id = m.teamId
       WHERE m.userId = ? AND m.status = 'joined' AND m.role = 'admin' AND t.deletedAt IS NULL
       ORDER BY t.name, t.id LIMIT ?`,
    )
    .bind(userId, EXPORT_STATUS_KEYS_MAX - 1)
    .all<AdminTeam>();
  return results;
}

async function adminOf(db: D1Database, userId: string, teamId: string): Promise<AdminTeam | null> {
  return db
    .prepare(
      `SELECT t.id, t.name FROM team_member m JOIN team t ON t.id = m.teamId
       WHERE m.teamId = ? AND m.userId = ? AND m.status = 'joined' AND m.role = 'admin' AND t.deletedAt IS NULL`,
    )
    .bind(teamId, userId)
    .first<AdminTeam>();
}

// A ready export's view with the link for whoever is looking: the person it was made for, or (a team's) any admin.
async function withLink(
  env: Env,
  viewer: string,
  key: string,
  view: ExportView | null,
  now: number,
) {
  if (!view || view.status !== 'ready' || view.expiresAt === null || view.expiresAt <= now)
    return view;
  const downloadUrl = await linkUrl(env.BASE_URL, env.BETTER_AUTH_SECRET, {
    forPerson: viewer,
    key,
    exportId: view.id,
    expiresAt: view.expiresAt,
  });
  return { ...view, downloadUrl };
}

// The person's profile.json: their account, their profile, their teams and the settings every app shares.
async function profileOf(db: D1Database, actor: Signed): Promise<Record<string, unknown>> {
  const [account, profile, teams, settings] = await Promise.all([
    db
      .prepare('SELECT id, name, email, createdAt FROM "user" WHERE id = ?')
      .bind(actor.id)
      .first<Record<string, unknown>>(),
    readOwnProfile(db, actor.id),
    db
      .prepare(
        `SELECT t.id, t.name, m.role FROM team_member m JOIN team t ON t.id = m.teamId
         WHERE m.userId = ? AND m.status = 'joined' AND t.deletedAt IS NULL ORDER BY t.name`,
      )
      .bind(actor.id)
      .all<Record<string, unknown>>(),
    readSettings(db, actor.id, null),
  ]);
  return { account, profile, teams: teams.results, settings: settings.all };
}

export type RouteOptions = { now?: number; service?: ExportService | null };

/** `GET` and `POST /api/account/data-export`, for the signed-in person. */
export async function handleDataExport(
  request: Request,
  env: Env,
  actor: Signed,
  options: RouteOptions = {},
): Promise<Response> {
  const service = options.service === undefined ? exportService(env) : options.service;
  if (!service) return error(503, 'export_unavailable');
  const now = options.now ?? Date.now();
  const db = env.AUTH_DB;
  const personal = exportKeyOf({ kind: 'personal', personId: actor.id });
  const teams = await adminTeams(db, actor.id);
  const keys = [personal, ...teams.map((t) => exportKeyOf({ kind: 'team', teamId: t.id }))];

  if (request.method === 'GET') {
    const views = await service.status(keys);
    const state: DataExportState = {
      personal: await withLink(env, actor.id, personal, views[personal] ?? null, now),
      teams: await Promise.all(
        teams.map(async (t) => {
          const key = exportKeyOf({ kind: 'team', teamId: t.id });
          return {
            id: t.id,
            name: t.name,
            export: await withLink(env, actor.id, key, views[key] ?? null, now),
          };
        }),
      ),
    };
    return json(state);
  }

  if (request.method === 'POST') {
    const body: unknown = await request.json().catch(() => ({}));
    const team = body && typeof body === 'object' ? (body as { team?: unknown }).team : undefined;
    if (team !== undefined && (typeof team !== 'string' || !parseExportKey(`team:${team}`))) {
      return error(400, 'invalid_team');
    }
    const admin = typeof team === 'string' ? await adminOf(db, actor.id, team) : null;
    if (typeof team === 'string' && !admin) return error(403, 'not_team_admin');
    // One at a time per person, whichever scope: their own and every team's they administer.
    const views = await service.status(
      admin && !keys.includes(`team:${admin.id}`) ? [...keys, `team:${admin.id}`] : keys,
    );
    if (Object.values(views).some((v) => v?.status === 'running' && v.requestedBy === actor.id)) {
      return error(409, 'export_running');
    }
    const key = admin ? exportKeyOf({ kind: 'team', teamId: admin.id }) : personal;
    const started = await service.start(
      admin
        ? {
            key,
            requestedBy: actor.id,
            scope: { kind: 'team', teamId: admin.id, teamName: admin.name },
          }
        : {
            key,
            requestedBy: actor.id,
            scope: { kind: 'personal', personId: actor.id },
            profile: await profileOf(db, actor),
          },
    );
    if (!started.ok) return error(409, started.error);
    console.log('[data-export] started', { kind: admin ? 'team' : 'personal' });
    return json({ export: started.view }, 202);
  }

  return error(404, 'not_found');
}

export type Session = (request: Request) => Promise<Signed | null>;

/**
 * `GET /api/account/data-export/download`: the emailed link. Signed out, to sign in and back; a link that has lapsed,
 * was changed, was made for someone else or names an export that has been replaced, to Settings, which says why.
 */
export async function handleDataExportDownload(
  request: Request,
  env: Env,
  session: Session,
  options: RouteOptions = {},
): Promise<Response> {
  const url = new URL(request.url);
  const base = env.BASE_URL.replace(/\/+$/, '');
  const actor = await session(request);
  if (!actor) {
    const back = `${url.pathname}${url.search}`;
    return Response.redirect(`${base}/sign-in?return=${encodeURIComponent(back)}`, 302);
  }
  const refuse = (reason: ExportLinkRefusal) =>
    Response.redirect(`${base}/explorer?settings=data&export=${reason}`, 302);
  const service = options.service === undefined ? exportService(env) : options.service;
  if (!service) return error(503, 'export_unavailable');
  const now = options.now ?? Date.now();

  const key = url.searchParams.get('key') ?? '';
  const exportId = url.searchParams.get('id') ?? '';
  const expiresAt = Number(url.searchParams.get('exp'));
  const scope = parseExportKey(key);
  if (!scope || !exportId || !Number.isSafeInteger(expiresAt)) return refuse('missing');
  const signed = await checkLink(
    env.BETTER_AUTH_SECRET,
    { forPerson: actor.id, key, exportId, expiresAt },
    url.searchParams.get('sig') ?? '',
  );
  // Made for someone else, or changed on the way: either way not this person's to open.
  if (!signed) return refuse('other-account');
  if (expiresAt <= now) return refuse('expired');
  if (scope.kind === 'personal' && scope.personId !== actor.id) return refuse('other-account');
  if (scope.kind === 'team' && !(await adminOf(env.AUTH_DB, actor.id, scope.teamId))) {
    return refuse('other-account');
  }
  const file = await service.file(key);
  if (!file) return refuse('expired');
  // A newer export has replaced the one the link names.
  if (file.exportId !== exportId) {
    await file.body.cancel();
    return refuse('missing');
  }
  console.log('[data-export] downloaded', { kind: scope.kind, bytes: file.size });
  return new Response(file.body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(file.size),
      'Content-Disposition': `attachment; filename="${exportFileName(now)}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function parseReady(body: unknown): ExportReadyCall | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (!parseExportKey(b.key) || typeof b.exportId !== 'string' || typeof b.requestedBy !== 'string')
    return null;
  if (b.status !== 'ready' && b.status !== 'failed') return null;
  const expiresAt = typeof b.expiresAt === 'number' ? b.expiresAt : null;
  if (b.status === 'ready' && expiresAt === null) return null;
  return {
    key: b.key as string,
    exportId: b.exportId,
    requestedBy: b.requestedBy,
    status: b.status,
    bytes: typeof b.bytes === 'number' ? b.bytes : 0,
    expiresAt,
    teamName: typeof b.teamName === 'string' ? b.teamName : null,
  };
}

/** `POST /api/account/internal/data-export/ready`: the export service says an export finished; the email goes. */
export async function handleDataExportReady(request: Request, env: Env): Promise<Response> {
  const expected = env.EXPORT_KEY_ACCOUNTS?.trim();
  const sent = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (request.method !== 'POST' || !expected) return error(404, 'not_found');
  if (!sent || !(await sameSecret(sent, expected))) return error(401, 'unauthorized');
  const call = parseReady(await request.json().catch(() => null));
  if (!call) return error(400, 'invalid_body');
  const user = await env.AUTH_DB.prepare('SELECT email, emailVerified FROM "user" WHERE id = ?')
    .bind(call.requestedBy)
    .first<{ email: string; emailVerified: number | boolean }>();
  // Gone, or no address to send to: there is no one to tell.
  if (!user || !user.emailVerified) return new Response(null, { status: 204 });
  const to = user.email.toLowerCase();
  const email =
    call.status === 'ready'
      ? exportEmail(env.BASE_URL, {
          status: 'ready',
          teamName: call.teamName,
          bytes: call.bytes,
          to,
          link: await linkUrl(env.BASE_URL, env.BETTER_AUTH_SECRET, {
            forPerson: call.requestedBy,
            key: call.key,
            exportId: call.exportId,
            expiresAt: call.expiresAt!,
          }),
        })
      : exportEmail(env.BASE_URL, { status: 'failed', teamName: call.teamName });
  await sendEmail(env, { to, ...email });
  return new Response(null, { status: 204 });
}

/** Closing an account: its personal export and file go. Best effort, after the answer; never throws. */
export async function removePersonalExport(
  env: Pick<Env, 'EXPORT' | 'EXPORT_KEY_ACCOUNTS'>,
  userId: string,
): Promise<void> {
  const service = exportService(env);
  if (!service) return;
  try {
    await service.remove(exportKeyOf({ kind: 'personal', personId: userId }));
  } catch (err) {
    console.warn('[data-export] removing a closed account’s export failed', {
      error: err instanceof Error ? err.name : 'unknown',
    });
  }
}
