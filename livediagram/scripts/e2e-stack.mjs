#!/usr/bin/env node
// E2E stack (docs/specs/003-system-architecture/e2e-smoke.md): the two-process stack the Playwright smoke suite
// runs against — the real static `apps/editor/out` build served with the
// production router/worker rewrites, plus the api worker on a local D1.
// Dependency-free (node builtins) so it adds nothing to install cost.
//
// Boots:
//   1. api — `wrangler dev --local` (apps/api) after applying the D1
//      migrations to a fresh local database, so persistence works.
//   2. live — a static file server for `out/` that reproduces the three
//      things production does (docs/specs/003-system-architecture/e2e-smoke.md): strip the `/live` assetPrefix,
//      rewrite `/document/*` to the single placeholder, and proxy
//      `/api/*` (WebSocket upgrades included) to the api worker so the app
//      is same-origin.
//
// Foregrounds both and stays alive; Playwright's webServer waits on the
// live port. SIGINT/SIGTERM tears the whole tree down.

import { spawn } from 'node:child_process';
import { generateKeyPairSync, randomBytes, randomUUID, sign, verify } from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import {
  cpSync,
  createReadStream,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// The caching rules production's router applies (docs/specs/016-platform/stale-builds.md), run from
// the same file: type-only TypeScript, which Node runs as is.
import {
  HTML_CACHE_CONTROL,
  IMMUTABLE_CACHE_CONTROL,
  cacheRule,
  isBuildAsset,
} from '../apps/router/src/cache-policy.ts';
import { EXPLORER_LANDING_PATH } from '../apps/editor/lib/explorer-landing.ts';
import {
  isWorkspaceFramePath,
  WORKSPACE_FRAME_PAGE,
} from '../apps/editor/lib/workbench/workbench-frame-path.ts';
// Every page enforces Trusted Types in production (docs/specs/016-platform/trusted-types.md), so the suite runs
// against the same header: a violation throws in the page, and the pageErrors fixture fails the spec on it.
import { TRUSTED_TYPES_CSP } from '../packages/ui/src/trusted-types-csp.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// E2E_EDITOR_OUT serves another export of the editor app, e.g. the signed-in `.next/out-signed-in`
// the signed-in specs run against (apps/editor/scripts/build-signed-in.mjs).
const OUT_DIR = path.join(ROOT, 'apps', 'editor', process.env.E2E_EDITOR_OUT ?? 'out');
// The builds a simulated deploy (POST /__e2e/deploy) made: copies whose chunk files carry new
// names, as a real deploy's do. Deploy n is served from deployDirs[n - 1].
const deployDirs = [];
// Production's caching, as a browser meets it (docs/specs/016-platform/stale-builds.md): Cloudflare's
// asset server marks every file `public, max-age=0, must-revalidate` with an ETag, and the router's
// caching rules then make pages `no-store` and build assets immutable. E2E_CACHE_POLICY=off serves
// without the router's rules, as production did before them.
const ASSET_SERVER_CACHE_CONTROL = 'public, max-age=0, must-revalidate';
const CACHE_POLICY = process.env.E2E_CACHE_POLICY !== 'off';
// Set by POST /__e2e/assets-out-of-cache, cleared by the next simulated deploy: build assets go out
// `no-store`, so the browser keeps a page but not its chunks, as a cache that evicted them (or never
// held a lazily loaded one) does.
//
// Both belong to the browser context that asked (a cookie each, which `page.request` shares with
// its page), never to the whole stack: the suite runs in parallel, and a deploy every test saw
// would pull chunks from under pages that never asked for one.
const DEPLOY_COOKIE = 'e2e-deploy';
const OUT_OF_CACHE_COOKIE = 'e2e-assets-out-of-cache';
function cookiesOf(req) {
  const jar = new Map();
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) jar.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  }
  return jar;
}
// The build this request's browser context is served: its latest simulated deploy, else OUT_DIR.
function buildFor(req) {
  return deployDirs[Number(cookiesOf(req).get(DEPLOY_COOKIE)) - 1] ?? OUT_DIR;
}
function assetsOutOfCacheFor(req) {
  return cookiesOf(req).get(OUT_OF_CACHE_COOKIE) === '1';
}

const EDITOR_PORT = Number(process.env.E2E_EDITOR_PORT ?? 3102);
const API_PORT = Number(process.env.E2E_API_PORT ?? 8687);
// The other sites, for the audits that open them (docs/specs/004-interface-design/blueprints/
// optical-alignment.md, "Ink audit"). Help and the Community sit under their basePath on the
// live origin, as the router mounts them; marketing owns "/" in production, so it gets its own port.
const SITES = [
  { prefix: '/help', dir: path.join(ROOT, 'apps', 'help', 'out') },
  { prefix: '/community', dir: path.join(ROOT, 'apps', 'community', 'out') },
];
const MARKETING_DIR = path.join(ROOT, 'apps', 'marketing', 'out');
const MARKETING_PORT = Number(process.env.E2E_MARKETING_PORT ?? 3113);
// Two switches for trying the editor as a DIFFERENT deployment would run it,
// beside a stack that is already up:
//   E2E_EDITOR_ONLY=1  serve the static editor only, proxying to the api
//                    already listening on E2E_API_PORT (no second worker).
//   E2E_NO_AI=1      answer /api/capabilities with aiEnabled: false, as a
//                    deployment with no AI key does — so the photo import
//                    reads with the in-browser model.
//   E2E_AI_BUDGET_SPENT=1  answer /api/ai/read-notes with 429 `ai_quota`, as a
//                    hosted reader whose free budget is spent does — so the
//                    photo import fails over to the in-browser model.
const EDITOR_ONLY = process.env.E2E_EDITOR_ONLY === '1';
const NO_AI = process.env.E2E_NO_AI === '1';
const AI_BUDGET_SPENT = process.env.E2E_AI_BUDGET_SPENT === '1';
//   E2E_DRIVE=1      the Google Drive mirror e2e (docs/specs/022-drive-mirror/blueprints/
//                    drive-mirror.md, "Testing"): the api worker verifies access
//                    tokens against the accounts stand-in the test serves
//                    (E2E_DRIVE_JWKS_PORT, e2e/drive-support.ts) and
//                    talks OAuth to the fake Google the test serves
//                    (E2E_DRIVE_GOOGLE_PORT). Test values only; the live build
//                    must carry NEXT_PUBLIC_E2E_AUTH=1.
const DRIVE = process.env.E2E_DRIVE === '1';
const DRIVE_JWKS_PORT = Number(process.env.E2E_DRIVE_JWKS_PORT ?? 8795);
const DRIVE_GOOGLE_PORT = Number(process.env.E2E_DRIVE_GOOGLE_PORT ?? 8796);
const DRIVE_E2E_VARS = {
  ACCOUNTS_URL: `http://127.0.0.1:${DRIVE_JWKS_PORT}`,
  API_RESOURCE: 'https://e2e.livediagram.test/api',
  GOOGLE_CLIENT_ID: '123456789012-e2e.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'e2e-client-secret',
  DRIVE_TOKEN_KEY: Buffer.alloc(32, 7).toString('base64'),
  GOOGLE_OAUTH_BASE_URL: `http://127.0.0.1:${DRIVE_GOOGLE_PORT}`,
};
//   E2E_ACCOUNTS_STUB  act as the liveworkspace accounts Worker (on unless set to 0, and off under
//                    E2E_DRIVE, which serves its own): the api keeps no settings or profiles of its
//                    own, so every spec needs one. For the signed-in specs
//                    (docs/specs/003-system-architecture/e2e-smoke.md): a key made at boot, its JWKS
//                    on the issuer's own path (/e2e/accounts/api/auth/jwks) for the api worker to
//                    verify against, and /e2e/token?sub=<id> minting an access token for any test
//                    account, with the issuer and audience the api expects, and its teams claim.
//                    It also answers the account API the api calls with its client credentials
//                    (/api/account/internal: settings, profiles, sightings, milestones, emails,
//                    activity, making a team, the teams change feed and the API token routes) from
//                    its own records, which the signed-in specs fill through /e2e/accounts/__seed/*
//                    (e2e/accounts-stub.ts). Test-only: nothing outside this stack trusts the key
//                    or the records.
//   E2E_WORKBENCH=1  the workbench embed e2e (docs/specs/013-workspace/blueprints/workbench-embeds.md,
//                    "Testing"): the stack acts as the accounts Worker as under E2E_ACCOUNTS_STUB,
//                    for the signed-in pairing page and the api calls the CLI makes, and the api
//                    builds its workbench and pairing URLs on this live origin (APP_BASE_URL). The
//                    live build must carry NEXT_PUBLIC_E2E_AUTH=1, as under E2E_DRIVE.
const WORKBENCH = process.env.E2E_WORKBENCH === '1';
const ACCOUNTS_STUB = WORKBENCH || (!DRIVE && process.env.E2E_ACCOUNTS_STUB !== '0');
//   E2E_GUEST_SIG_ENFORCE  guest signature enforcement, as production runs once armed
//                    (docs/specs/003-system-architecture/e2e-smoke.md "Armed guest signatures").
//                    On unless set to 0: every spec seeds through signed guests. `=1` also selects
//                    the armed project and its own ports (playwright.config.ts).
const GUEST_SIG_ENFORCE = process.env.E2E_GUEST_SIG_ENFORCE !== '0';
const accountsKey = ACCOUNTS_STUB ? generateKeyPairSync('rsa', { modulusLength: 2048 }) : null;
const ACCOUNTS_KID = 'e2e-accounts-stub';
// What the api worker is started with (below): its issuer is `${ACCOUNTS_URL}/api/auth`, and the
// audience is its own API_RESOURCE, exactly as against the real accounts Worker.
const ACCOUNTS_PATH = '/e2e/accounts';
const API_RESOURCE = 'https://e2e.livediagram.test/api';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

// The client the api worker is started with (below), as register-client.ts would make it.
const ACCOUNTS_CLIENT = { id: 'e2e-livediagram', secret: 'e2e-client-secret' };

// The stand-in's records, as liveworkspace.app keeps them (liveworkspace/docs/accounts.md "Teams" and
// "API tokens"). Every team and member carries the feed position of its last change, so the change
// feed is "everything after the cursor" and the api follows it as it follows the real one. Positions
// start at the boot time: the api's D1 keeps its cursor from an earlier run of the stack, and a feed
// that started again at 0 would sit behind it.
const accountsRecords = {
  seq: Date.now(),
  teams: new Map(),
  members: new Map(),
  tokens: new Map(),
  // `${owner} ${scope}` → that scope's settings; owner → { name, color, createdAt }.
  settings: new Map(),
  profiles: new Map(),
  sightings: new Set(),
  milestones: new Set(),
};

// A profile as the account API answers one. An account with no profile of its own has no account
// name here either (the stand-in keeps none), so it is left out, as an unknown id is.
function profileOf(id) {
  const own = accountsRecords.profiles.get(id);
  if (!own) return null;
  return { id, ...own, updatedAt: own.createdAt };
}

// The teams an account is in, ordered by team id, as liveworkspace puts them in a token.
function teamsClaim(userId) {
  const claim = [];
  for (const m of accountsRecords.members.values()) {
    if (m.userId !== userId || m.status !== 'joined') continue;
    const team = accountsRecords.teams.get(m.teamId);
    if (team && !team.deleted) claim.push({ id: team.id, name: team.name, role: m.role });
  }
  return claim.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function seedTeam({ id = randomUUID(), name, admin }) {
  const at = Date.now();
  const team = {
    id,
    name,
    deleted: false,
    createdAt: at,
    updatedAt: at,
    seq: ++accountsRecords.seq,
  };
  accountsRecords.teams.set(id, team);
  if (admin) seedMember({ teamId: id, userId: admin.userId, email: admin.email, role: 'admin' });
  return team;
}

// A member joining (or, with another status, leaving) a team. The same person in the same team keeps
// their member id, as on liveworkspace.app.
function seedMember({ teamId, userId = null, email, role = 'member', status = 'joined' }) {
  const at = Date.now();
  const existing = [...accountsRecords.members.values()].find(
    (m) => m.teamId === teamId && (m.email === email || (userId && m.userId === userId)),
  );
  const member = {
    id: existing?.id ?? randomUUID(),
    teamId,
    userId,
    email,
    role,
    status,
    createdAt: existing?.createdAt ?? at,
    updatedAt: at,
    seq: ++accountsRecords.seq,
  };
  accountsRecords.members.set(member.id, member);
  return member;
}

function seedToken({ userId, email = null, name = 'API token', readOnly = false }) {
  const secret = `lwt_${b64url(randomBytes(32))}`;
  const token = {
    id: randomUUID(),
    userId,
    email,
    name,
    readOnly,
    expiresAt: Date.now() + 90 * 24 * 3600 * 1000,
    revoked: false,
  };
  accountsRecords.tokens.set(secret, token);
  return { id: token.id, name, readOnly, expiresAt: token.expiresAt, secret };
}

// The claims of an access token this stack minted and that hasn't expired, or null.
function accessTokenClaims(jwt) {
  const [header, payload, signature] = String(jwt ?? '').split('.');
  if (!signature) return null;
  const signed = verify(
    'sha256',
    Buffer.from(`${header}.${payload}`),
    accountsKey.publicKey,
    Buffer.from(signature, 'base64url'),
  );
  if (!signed) return null;
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  return claims.exp * 1000 > Date.now() ? claims : null;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

const withoutSeq = ({ seq: _seq, ...record }) => record;

// The account API (packages/auth-client/src/account.ts), behind the client's Basic credentials.
async function answerAccountApi(req, route, url, res) {
  const expected = `Basic ${btoa(`${ACCOUNTS_CLIENT.id}:${ACCOUNTS_CLIENT.secret}`)}`;
  if (req.headers.authorization !== expected)
    return sendJson(res, 401, { error: 'invalid_client' });
  if (req.method === 'GET' && route === '/teams/changes') {
    const after = Number(url.searchParams.get('cursor') ?? 0) || 0;
    const since = (records) =>
      [...records.values()].filter((r) => r.seq > after).sort((a, b) => a.seq - b.seq);
    const teams = since(accountsRecords.teams);
    const members = since(accountsRecords.members);
    const last = Math.max(after, ...teams.map((t) => t.seq), ...members.map((m) => m.seq));
    return sendJson(res, 200, {
      teams: teams.map(withoutSeq),
      members: members.map(withoutSeq),
      cursor: String(last),
      more: false,
    });
  }
  if (req.method !== 'POST') return sendJson(res, 404, { error: 'not_found' });
  const body = await readJson(req);
  const scopes = (owner, app) => ({
    all: accountsRecords.settings.get(`${owner} all`) ?? {},
    app: accountsRecords.settings.get(`${owner} ${app}`) ?? {},
    updatedAt: null,
  });
  if (route === '/settings/read') return sendJson(res, 200, scopes(body.owner, body.app));
  if (route === '/settings/write') {
    for (const [scope, values] of [
      ['all', body.patch?.all],
      [body.app, body.patch?.app],
    ]) {
      if (!values) continue;
      const next = { ...(accountsRecords.settings.get(`${body.owner} ${scope}`) ?? {}) };
      for (const [key, value] of Object.entries(values)) {
        if (value === null) delete next[key];
        else next[key] = value;
      }
      accountsRecords.settings.set(`${body.owner} ${scope}`, next);
    }
    return sendJson(res, 200, scopes(body.owner, body.app));
  }
  if (route === '/profiles/read') {
    return sendJson(res, 200, { profiles: (body.ids ?? []).map(profileOf).filter(Boolean) });
  }
  if (route === '/profiles/write') {
    const prior = accountsRecords.profiles.get(body.owner);
    accountsRecords.profiles.set(body.owner, {
      name: 'name' in body ? body.name : (prior?.name ?? null),
      color: 'color' in body ? body.color : (prior?.color ?? null),
      createdAt: prior?.createdAt ?? Date.now(),
    });
    return sendJson(res, 200, { profile: profileOf(body.owner) });
  }
  if (route === '/sightings') {
    const first = !accountsRecords.sightings.has(body.userId);
    accountsRecords.sightings.add(body.userId);
    return sendJson(res, 200, { first });
  }
  if (route === '/milestones/claim') {
    const key = `${body.userId} ${body.milestone}`;
    const claimed =
      accountsRecords.sightings.has(body.userId) && !accountsRecords.milestones.has(key);
    accountsRecords.milestones.add(key);
    return sendJson(res, 200, { claimed });
  }
  // The stand-in keeps no addresses: nobody is emailed.
  if (route === '/emails') return sendJson(res, 200, { emails: {} });
  if (route === '/activity') return sendJson(res, 200, { ok: true });
  if (route === '/teams') {
    const claims = accessTokenClaims(body.accessToken);
    if (!claims) return sendJson(res, 401, { error: 'invalid_token' });
    const name = String(body.name ?? '').trim();
    if (!name) return sendJson(res, 400, { error: 'name_required' });
    const email = claims.email ?? `${claims.sub}@e2e.test`;
    const team = seedTeam({ name, admin: { userId: claims.sub, email } });
    const me = [...accountsRecords.members.values()].find(
      (m) => m.teamId === team.id && m.userId === claims.sub,
    );
    return sendJson(res, 201, {
      id: team.id,
      name,
      organisation: body.organisation ?? null,
      role: 'admin',
      memberCount: 1,
      invitedCount: 0,
      members: [{ id: me.id, name: null, email, role: 'admin' }],
    });
  }
  if (route === '/tokens/verify') {
    const token = accountsRecords.tokens.get(body.token);
    if (!token || token.revoked || token.expiresAt <= Date.now()) {
      return sendJson(res, 404, { error: 'unknown_token' });
    }
    return sendJson(res, 200, {
      tokenId: token.id,
      userId: token.userId,
      name: token.name,
      email: token.email,
      readOnly: token.readOnly,
      expiresAt: token.expiresAt,
      teams: teamsClaim(token.userId),
    });
  }
  if (route === '/tokens') {
    const claims = accessTokenClaims(body.accessToken);
    if (!claims) return sendJson(res, 401, { error: 'invalid_token' });
    const minted = seedToken({
      userId: claims.sub,
      email: claims.email ?? null,
      name: body.name,
      readOnly: Boolean(body.readOnly),
    });
    return sendJson(res, 201, minted);
  }
  if (route === '/tokens/revoke') {
    const token = accountsRecords.tokens.get(body.token);
    if (!token || token.revoked) return sendJson(res, 404, { error: 'unknown_token' });
    token.revoked = true;
    return sendJson(res, 204);
  }
  if (route === '/tokens/live') {
    const live = new Set(
      [...accountsRecords.tokens.values()]
        .filter((t) => !t.revoked && t.expiresAt > Date.now())
        .map((t) => t.id),
    );
    return sendJson(res, 200, { live: (body.ids ?? []).filter((id) => live.has(id)) });
  }
  return sendJson(res, 404, { error: 'not_found' });
}

// The specs' own way in (e2e/accounts-stub.ts): what a person does on liveworkspace.app (making a
// team, joining one, making an API token), done to the records directly.
async function answerSeed(req, route, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
  const body = await readJson(req);
  if (route === 'team') return sendJson(res, 200, withoutSeq(seedTeam(body)));
  if (route === 'member') return sendJson(res, 200, withoutSeq(seedMember(body)));
  if (route === 'token') return sendJson(res, 200, seedToken(body));
  return sendJson(res, 404, { error: 'not_found' });
}

// An RS256 access token shaped like the accounts Worker's: sub, email (verified), iss, aud, and the
// teams the account is in at the moment it is minted.
function mintAccessToken(sub, email) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', kid: ACCOUNTS_KID, typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub,
      iss: `http://127.0.0.1:${EDITOR_PORT}${ACCOUNTS_PATH}/api/auth`,
      aud: API_RESOURCE,
      iat: now,
      nbf: now - 5,
      exp: now + 3600,
      ...(email ? { email, email_verified: true } : {}),
      teams: teamsClaim(sub),
    }),
  );
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), accountsKey.privateKey);
  return `${header}.${payload}.${b64url(signature)}`;
}

// Answers the accounts stand-in's routes, or returns false for anything else.
function serveAccountsStandIn(req, pathname, url, res) {
  if (!ACCOUNTS_STUB) return false;
  const internal = `${ACCOUNTS_PATH}/api/account/internal`;
  const seed = `${ACCOUNTS_PATH}/__seed/`;
  if (pathname.startsWith(internal) || pathname.startsWith(seed)) {
    const answer = pathname.startsWith(internal)
      ? answerAccountApi(req, pathname.slice(internal.length), url, res)
      : answerSeed(req, pathname.slice(seed.length), res);
    answer.catch((err) => {
      console.error('[e2e] accounts stand-in failed', err);
      if (!res.headersSent) sendJson(res, 500, { error: 'stand_in_failed' });
    });
    return true;
  }
  if (pathname === `${ACCOUNTS_PATH}/api/auth/jwks`) {
    const jwk = accountsKey.publicKey.export({ format: 'jwk' });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ keys: [{ ...jwk, kid: ACCOUNTS_KID, alg: 'RS256', use: 'sig' }] }));
    return true;
  }
  if (pathname === '/e2e/token') {
    const sub = url.searchParams.get('sub') ?? '';
    if (!/^user_[A-Za-z0-9]+$/.test(sub)) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('sub must look like user_<id>');
      return true;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end(mintAccessToken(sub, url.searchParams.get('email') ?? undefined));
    return true;
  }
  return false;
}

const children = [];
function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
  children.push(child);
  return child;
}
function shutdown(code) {
  for (const dir of deployDirs) rmSync(dir, { recursive: true, force: true });
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {
      // best effort
    }
  }
  process.exit(code ?? 0);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    child.on('error', reject);
  });
}

// A legacy guest (docs/specs/015-api/public-api-and-tokens.md §6): an unsigned id whose profile
// predates GUEST_SIGNING_LIVE_AT (kept by the accounts stand-in), owning one folder, written straight
// into the stack's local D1. With signatures enforced the api cannot make one (an unsigned id writes nothing), and only
// such a guest still runs the one-time upgrade onto a signed id, which e2e/guest-upgrade.spec.ts
// exercises. Ids are server-made UUIDs, so the statement carries no outside input.
async function seedLegacyGuest() {
  const ownerId = randomUUID();
  const folderId = randomUUID();
  accountsRecords.profiles.set(`guest_${ownerId}`, {
    name: 'Legacy guest',
    color: '#336699',
    createdAt: 1,
  });
  const sql =
    `INSERT INTO folders (id, owner_id, name, created_at, updated_at) VALUES ('${folderId}', '${ownerId}', 'Legacy folder', 1, 1);`;
  await waitForExit(
    spawn(
      'pnpm',
      [
        '--filter',
        '@livediagram/api',
        'exec',
        'wrangler',
        'd1',
        'execute',
        'livediagram',
        '--local',
        '--command',
        sql,
      ],
      { cwd: ROOT, stdio: 'ignore' },
    ),
  );
  return { ownerId, folderId, folderName: 'Legacy folder' };
}

// One seed at a time, each retried briefly: parallel workers asking at once would run several
// `wrangler d1 execute` processes against the one local database file, and SQLite refuses the
// writers that lose the lock.
let legacySeedQueue = Promise.resolve();
function queueLegacyGuestSeed() {
  const attempt = async () => {
    for (let tries = 1; ; tries += 1) {
      try {
        return await seedLegacyGuest();
      } catch (err) {
        if (tries >= 3) throw err;
        await new Promise((r) => setTimeout(r, 250 * tries));
      }
    }
  };
  const next = legacySeedQueue.then(attempt, attempt);
  legacySeedQueue = next.catch(() => {});
  return next;
}

async function waitForPort(port, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const req = http.request({ host: '127.0.0.1', port, method: 'HEAD', path: '/' }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.end();
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} did not come up on :${port} within ${timeoutMs}ms`);
}

// --- Static file serving with the production rewrites --------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  // Cloudflare serves it so; streaming compilation needs it.
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
};

// What production sends for a response: the asset server's caching, then the router's rules.
function cacheControlFor(req, pathname, status, contentType) {
  if (assetsOutOfCacheFor(req) && isBuildAsset(pathname)) {
    return { cacheControl: 'no-store', missing: false };
  }
  if (!CACHE_POLICY) return { cacheControl: ASSET_SERVER_CACHE_CONTROL, missing: false };
  const rule = cacheRule(pathname, status, contentType);
  if (rule === 'no-store') return { cacheControl: HTML_CACHE_CONTROL, missing: false };
  if (rule === 'immutable') return { cacheControl: IMMUTABLE_CACHE_CONTROL, missing: false };
  if (rule === 'missing-asset') return { cacheControl: HTML_CACHE_CONTROL, missing: true };
  return { cacheControl: ASSET_SERVER_CACHE_CONTROL, missing: false };
}

function serveFile(req, res, filePath, pathname) {
  const ext = path.extname(filePath);
  const contentType = MIME[ext] ?? 'application/octet-stream';
  const { size, mtimeMs } = statSync(filePath);
  const etag = `W/"${size}-${Math.floor(mtimeMs)}"`;
  const headers = {
    'Content-Type': contentType,
    ETag: etag,
    'Cache-Control': cacheControlFor(req, pathname, 200, contentType).cacheControl,
    ...(contentType.startsWith('text/html')
      ? { 'Content-Security-Policy': TRUSTED_TYPES_CSP }
      : {}),
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  res.writeHead(200, headers);
  createReadStream(filePath).pipe(res);
}

// A missing file: the site's HTML 404 page, as Cloudflare's `not_found_handling = "404-page"`
// answers, unless the router's rules make a missing build asset a plain-text 404.
function serveNotFound(req, res, pathname, notFoundPage) {
  const html = 'text/html; charset=utf-8';
  const { cacheControl, missing } = cacheControlFor(req, pathname, 404, html);
  if (missing || !notFoundPage || !existsSync(notFoundPage)) {
    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end('Not found');
    return;
  }
  res.writeHead(404, {
    'Content-Type': html,
    'Cache-Control': cacheControl,
    'Content-Security-Policy': TRUSTED_TYPES_CSP,
  });
  createReadStream(notFoundPage).pipe(res);
}

// A deploy, simulated: a copy of the build a context is served whose chunk files are renamed,
// every reference to them rewritten, and the copy served to that context from now on. The old
// names are gone for it, exactly as after a real deploy, while a page the browser kept still
// names them.
const TEXT_FILES = new Set(['.html', '.txt', '.js', '.css', '.json', '.map']);
function filesUnder(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) filesUnder(p, out);
    else out.push(p);
  }
  return out;
}
function simulateDeploy(from) {
  const next = mkdtempSync(path.join(tmpdir(), 'livediagram-e2e-deploy-'));
  const n = deployDirs.push(next);
  cpSync(from, next, { recursive: true });
  const renames = new Map();
  for (const file of filesUnder(path.join(next, '_next', 'static', 'chunks'))) {
    const ext = path.extname(file);
    const name = path.basename(file);
    const renamed = `${name.slice(0, -ext.length)}-d${n}${ext}`;
    renames.set(name, renamed);
    renameSync(file, path.join(path.dirname(file), renamed));
  }
  const escaped = [...renames.keys()].map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(?<![A-Za-z0-9_-])(${escaped.join('|')})`, 'g');
  for (const file of filesUnder(next)) {
    if (!TEXT_FILES.has(path.extname(file))) continue;
    const text = readFileSync(file, 'utf8');
    const rewritten = text.replace(pattern, (m) => renames.get(m) ?? m);
    if (rewritten !== text) writeFileSync(file, rewritten);
  }
  console.log(`[e2e] simulated deploy ${n}: ${renames.size} chunks renamed, serving ${next}`);
  return n;
}

// Resolve a request path to a file in out/, mirroring the editor worker
// (apps/editor/src/worker.ts) + the static export's file layout.
function resolveStatic(pathname, out) {
  // The build references assets as `/live/_next/*` (assetPrefix); the
  // files live at out/_next/*.
  let p = pathname.startsWith('/live/') ? pathname.slice('/live'.length) : pathname;
  // /document and everything under it share one placeholder HTML.
  if (p === '/document' || p.startsWith('/document/')) p = '/document/placeholder';
  // So does every form link, /form/<code> (apps/editor/lib/form-path.ts, as the editor worker rewrites it): without this
  // the stack answered a published form's link with the 404 page, so no spec could open one.
  if (p === '/form' || p.startsWith('/form/')) p = '/form/placeholder';
  // So does every place inside a workspace frame, as the editor worker serves them (lib/workbench/workbench-frame-path.ts).
  if (isWorkspaceFramePath(p)) p = WORKSPACE_FRAME_PAGE;
  if (p === '/') p = '/index';
  const candidates = [
    path.join(out, p), // exact file (assets)
    path.join(out, `${p}.html`), // clean route → new.html
    path.join(out, p, 'index.html'),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

// A basePath site's file for a request under its prefix, or null. A missing build is not an
// error here: only the audits need these sites, and they fail loudly on the 404.
function resolveSite(pathname) {
  for (const site of SITES) {
    if (pathname !== site.prefix && !pathname.startsWith(`${site.prefix}/`)) continue;
    const p = pathname.slice(site.prefix.length) || '/';
    return resolveIn(site.dir, p === '/' ? '/index' : p) ?? { notFound: site.dir };
  }
  return null;
}

// A clean-route static file in `dir`: the exact file, `<p>.html`, or `<p>/index.html`.
function resolveIn(dir, p) {
  for (const c of [
    path.join(dir, p),
    path.join(dir, `${p}.html`),
    path.join(dir, p, 'index.html'),
  ]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

function proxyApi(req, res) {
  const proxyReq = http.request(
    { host: '127.0.0.1', port: API_PORT, method: req.method, path: req.url, headers: req.headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'api_unreachable' }));
  });
  req.pipe(proxyReq);
}

// The realtime room is a WebSocket on /api/documents/<id>/ws. Production routes
// the upgrade through the router like any other /api request; without this the
// browser's socket was never answered here, so no e2e test could see a room op.
// Relays the raw upgrade to the api worker and pipes both directions.
function proxyApiUpgrade(req, socket, head) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (!pathname.startsWith('/api/')) {
    socket.destroy();
    return;
  }
  const upstream = net.connect(API_PORT, '127.0.0.1', () => {
    const headerLines = [];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      headerLines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    }
    upstream.write(
      `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headerLines.join('\r\n')}\r\n\r\n`,
    );
    if (head.length > 0) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
}

function startLiveServer() {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const liveOut = buildFor(req);
    if (NO_AI && pathname === '/api/capabilities') {
      // Everything else about the real answer stands; only the AI is off.
      http
        .get({ host: '127.0.0.1', port: API_PORT, path: '/api/capabilities' }, (up) => {
          let body = '';
          up.on('data', (c) => (body += c));
          up.on('end', () => {
            let caps = {};
            try {
              caps = JSON.parse(body);
            } catch {
              /* the api answered something else: report AI off regardless */
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ...caps, aiEnabled: false }));
          });
        })
        .on('error', () => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'api_unreachable' }));
        });
      return;
    }
    if (AI_BUDGET_SPENT && pathname === '/api/ai/read-notes') {
      // Drain the body first, as a real server would, then refuse for quota.
      req.resume();
      req.on('end', () => {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'ai_quota' }));
      });
      return;
    }
    if (serveAccountsStandIn(req, pathname, new URL(req.url, 'http://localhost'), res)) return;
    if (pathname === '/__e2e/assets-out-of-cache' && req.method === 'POST') {
      res.writeHead(204, {
        'Cache-Control': 'no-store',
        'Set-Cookie': `${OUT_OF_CACHE_COOKIE}=1; Path=/; SameSite=Lax`,
      });
      res.end();
      return;
    }
    if (pathname === '/__e2e/legacy-guest' && req.method === 'POST') {
      queueLegacyGuestSeed().then(
        (body) => {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify(body));
        },
        (err) => {
          console.error('[e2e] seeding a legacy guest failed', err);
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('seeding a legacy guest failed');
        },
      );
      return;
    }
    if (pathname === '/__e2e/deploy' && req.method === 'POST') {
      const deploy = simulateDeploy(liveOut);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Set-Cookie': [
          `${DEPLOY_COOKIE}=${deploy}; Path=/; SameSite=Lax`,
          `${OUT_OF_CACHE_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`,
        ],
      });
      res.end(JSON.stringify({ deploy }));
      return;
    }
    if (pathname === '/api' || pathname.startsWith('/api/')) return proxyApi(req, res);
    // Match the worker's /explorer → Home redirect, from the same constant.
    if (pathname === '/explorer' || pathname === '/explorer/') {
      res.writeHead(302, { Location: EXPLORER_LANDING_PATH });
      res.end();
      return;
    }
    // Cloudflare's assets layer (`html_handling` defaults to
    // "auto-trailing-slash") answers `/new/` — whose file is `new.html`, not
    // `new/index.html` — with a redirect to `/new`, query intact. Without
    // this the stack answered 404, the page recovered client-side without its
    // query string, and `?truth=1` typed on `/new/` armed nothing.
    const bare = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : null;
    if (bare && !bare.startsWith('/document') && existsSync(path.join(liveOut, `${bare}.html`))) {
      const search = new URL(req.url, 'http://localhost').search;
      res.writeHead(307, { Location: `${bare}${search}` });
      res.end();
      return;
    }
    const site = resolveSite(pathname);
    if (typeof site === 'string') return serveFile(req, res, site, pathname);
    if (site) {
      console.warn(`[e2e] ${pathname}: no build at ${site.notFound}`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Not built: ${site.notFound}`);
      return;
    }
    const file = resolveStatic(pathname, liveOut);
    if (file) return serveFile(req, res, file, pathname);
    serveNotFound(req, res, pathname, path.join(liveOut, '404.html'));
  });
  server.on('upgrade', proxyApiUpgrade);
  server.listen(EDITOR_PORT, () => console.log(`[e2e] live static server on :${EDITOR_PORT}`));
  startMarketingServer();
}

// Marketing on its own port, clean routes, the same caching as production. Absent build: a logged 404.
function startMarketingServer() {
  if (!existsSync(MARKETING_DIR)) {
    console.warn(`[e2e] marketing not built (${MARKETING_DIR}); :${MARKETING_PORT} answers 404`);
  }
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const p = pathname === '/' ? '/index' : pathname.replace(/\/$/, '');
    const file = existsSync(MARKETING_DIR) ? resolveIn(MARKETING_DIR, p) : null;
    if (file) return serveFile(req, res, file, pathname);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(existsSync(MARKETING_DIR) ? 'Not found' : `Not built: ${MARKETING_DIR}`);
  });
  server.listen(MARKETING_PORT, () =>
    console.log(`[e2e] marketing static server on :${MARKETING_PORT}`),
  );
}

// --- Boot ---------------------------------------------------------------
async function main() {
  if (!existsSync(OUT_DIR)) {
    console.error(
      `[e2e] ${OUT_DIR} missing — run \`pnpm --filter @livediagram/editor build\` first`,
    );
    process.exit(1);
  }
  if (EDITOR_ONLY) {
    console.log(
      `[e2e] static editor only, proxying to the api on :${API_PORT}${NO_AI ? ', AI reported off' : ''}${AI_BUDGET_SPENT ? ', AI budget spent' : ''}`,
    );
    startLiveServer();
    return;
  }
  console.log('[e2e] applying local D1 migrations…');
  await waitForExit(
    run('pnpm', ['--filter', '@livediagram/api', 'run', 'db:migrate:local'], { cwd: ROOT }),
  );
  console.log('[e2e] starting api worker…');
  run(
    'pnpm',
    [
      '--filter',
      '@livediagram/api',
      'exec',
      'wrangler',
      'dev',
      '--local',
      '--port',
      String(API_PORT),
      // Production's origin allow-list lives in wrangler.toml [vars], which
      // `wrangler dev` reads too; it would 403 every AI call from this
      // localhost editor. Blank it, as `pnpm dev` does (docs/specs/021-event-storming/note-reader.md).
      '--var',
      'AI_ALLOWED_ORIGINS:',
      ...(DRIVE ? Object.entries(DRIVE_E2E_VARS).flatMap(([k, v]) => ['--var', `${k}:${v}`]) : []),
      // Guest ids are signed as in production (docs/specs/014-identity/auth-and-guest-access.md), so
      // the signed-id upgrade a fresh guest goes through runs here too. A test-only secret.
      '--var',
      'GUEST_ID_HMAC_SECRET:e2e-guest-signing-secret',
      // Enforced by default (E2E_GUEST_SIG_ENFORCE above), as production runs once armed
      // (docs/specs/015-api/public-api-and-tokens.md §4): every entry path must mint a signed id
      // before its first api call, and the specs seed through signed ids (fixtures.ts
      // mintSignedGuest / ownerHeaders / pageOwnerHeaders). Explicit, because production's
      // [vars] value can be blank while it is not armed.
      '--var',
      `GUEST_SIG_ENFORCE_AFTER:${GUEST_SIG_ENFORCE ? '1' : ''}`,
      // Only a profile older than this counts as a legacy guest: the one
      // /__e2e/legacy-guest writes (created_at 1), never one the app makes during a run.
      '--var',
      'GUEST_SIGNING_LIVE_AT:1000',
      // Verify access tokens against the stack's own key (E2E_ACCOUNTS_STUB above), never a real
      // accounts Worker a developer's .dev.vars may name.
      ...(ACCOUNTS_STUB
        ? [
            '--var',
            `ACCOUNTS_URL:http://127.0.0.1:${EDITOR_PORT}${ACCOUNTS_PATH}`,
            '--var',
            `API_RESOURCE:${API_RESOURCE}`,
            '--var',
            `ACCOUNTS_CLIENT_ID:${ACCOUNTS_CLIENT.id}`,
            '--var',
            `ACCOUNTS_CLIENT_SECRET:${ACCOUNTS_CLIENT.secret}`,
          ]
        : []),
      ...(WORKBENCH ? ['--var', `APP_BASE_URL:http://localhost:${EDITOR_PORT}`] : []),
    ],
    {
      cwd: ROOT,
    },
  );
  await waitForPort(API_PORT, 'api worker');
  console.log('[e2e] api worker up; starting live static server…');
  startLiveServer();
}

main().catch((err) => {
  console.error('[e2e] stack failed:', err);
  shutdown(1);
});
