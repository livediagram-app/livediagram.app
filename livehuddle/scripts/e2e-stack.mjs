#!/usr/bin/env node
// E2E stack (docs/specs/003-system-architecture/e2e-smoke.md): the four-process stack the Playwright smoke suite
// runs against — the real static `apps/editor/out` build served with the
// production router/worker rewrites, the api worker with local Durable Objects, and liveworkspace's index
// (liveworkspace/apps/index, liveworkspace/docs/specs/004-index/one-explorer.md) on its own local D1.
// Dependency-free (node builtins) so it adds nothing to install cost.
//
// Boots:
//   1. index — `wrangler dev --local` (liveworkspace/apps/index) on E2E_INDEX_PORT (8119), its D1 kept apart from
//      a developer's own local index, trusting this stack's accounts stand-in and calling this api.
//   2. media — liveworkspace's media service (liveworkspace/apps/media, its scripts/e2e-media.mjs) under
//      `wrangler dev --local` on E2E_MEDIA_PORT (8120), its D1 and R2 fresh each run, so uploads and the gallery
//      run end to end.
//   3. api — `wrangler dev --local` (apps/api): each canvas's content in its own local Durable Object, its images
//      in the stack's media.
//   4. live — a static file server for `out/` that reproduces what production
//      does (docs/specs/003-system-architecture/e2e-smoke.md): strip the `/live` assetPrefix,
//      rewrite `/document/*` to the single placeholder, forward `/api/index/*` to the index and
//      `/api/previews/*` to media, serve
//      liveworkspace's Explorer at `/explorer` when its site is built, and proxy the rest of
//      `/api/*` (WebSocket upgrades included) to the api worker so the app is same-origin.
//
// Foregrounds both and stays alive; Playwright's webServer waits on the
// live port. SIGINT/SIGTERM tears the whole tree down.

import { spawn } from 'node:child_process';
import { generateKeyPairSync, randomUUID, sign, verify } from 'node:crypto';
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
import { createTokenStandIn } from '../../packages/auth-client/src/e2e-token-stand-in.ts';
import {
  isWorkspaceFramePath,
  WORKSPACE_FRAME_PAGE,
} from '../apps/editor/lib/workbench/workbench-frame-path.ts';
// Every page enforces Trusted Types in production (docs/specs/016-platform/trusted-types.md), so the suite runs
// against the same header: a violation throws in the page, and the pageErrors fixture fails the spec on it.
import { TRUSTED_TYPES_CSP } from '../packages/ui/src/trusted-types-csp.ts';
// The media service's stand-in boot, shared by the products' stacks (liveworkspace/apps/media/scripts/e2e-media.mjs).
import {
  e2eMediaKey,
  MEDIA_DIR,
  startE2EMedia,
} from '../../liveworkspace/apps/media/scripts/e2e-media.mjs';

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

const EDITOR_PORT = Number(process.env.E2E_EDITOR_PORT ?? 3502);
const API_PORT = Number(process.env.E2E_API_PORT ?? 9087);
const INDEX_PORT = Number(process.env.E2E_INDEX_PORT ?? 8119);
const MEDIA_PORT = Number(process.env.E2E_MEDIA_PORT ?? 8120);
// The media service's local D1 and R2 for this stack, apart from a developer's `wrangler dev` state.
const MEDIA_STATE = path.join(MEDIA_DIR, '.wrangler', `e2e-state-${MEDIA_PORT}`);
const MEDIA_APP = 'livehuddle.app';
// The key the api and the index share (the api's INDEX_KEY, the index's INDEX_KEY_LIVEHUDDLE). Test-only.
const INDEX_KEY = 'e2e-index-key';
// Accounts' key at the index (its MERGE_KEY): what the index's "teams as they are now" call carries to the
// stand-in (POST /api/account/index/teams). Test-only.
const MERGE_KEY = 'e2e-merge-key';
const INDEX_DIR = path.resolve(ROOT, '..', 'liveworkspace', 'apps', 'index');
// The index's local D1 for this stack, apart from a developer's `wrangler dev` state.
const INDEX_STATE = path.join(INDEX_DIR, '.wrangler', 'e2e-state');
// The stack's own wrangler dev registry, so a service binding (media's INDEX) reaches this stack's Workers, never a
// developer's or another stack's registered under the same name. Every wrangler the stack starts inherits it. Fresh
// each run: a previous run's entries point at Workers that are gone, and a binding to one loses its connection.
const WRANGLER_REGISTRY = path.join(INDEX_DIR, '.wrangler', `e2e-registry-${MEDIA_PORT}`);
rmSync(WRANGLER_REGISTRY, { recursive: true, force: true });
process.env.WRANGLER_REGISTRY_PATH = WRANGLER_REGISTRY;
// liveworkspace's site, whose Explorer production serves at livehuddle's own /explorer (the router's
// routeToWorkspace, @liveworkspace/sites/workspace-proxy): its static export, when built.
// E2E_WORKSPACE_SITE_OUT serves another export of it: the signed-in specs' `.next/out-e2e`
// (liveworkspace/apps/site/scripts/build-e2e.mjs), which reads the specs' session as the editor's signed-in build does.
const WORKSPACE_SITE_DIR = path.resolve(
  ROOT,
  '..',
  'liveworkspace',
  'apps',
  'site',
  process.env.E2E_WORKSPACE_SITE_OUT ?? 'out',
);
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
//   The accounts stand-in: the stack acts as the liveworkspace accounts Worker, always, and the api and the
//                    index both trust it: the api keeps no settings or profiles of its own, and the index
//                    lets in only tokens an accounts it trusts signed. For the signed-in specs
//                    (docs/specs/003-system-architecture/e2e-smoke.md): a key made at boot, its JWKS
//                    on the issuer's own path (/e2e/accounts/api/auth/jwks) for the api worker to
//                    verify against, the guest handoff (/e2e/accounts/api/auth/guest) answering every
//                    visitor a guest token (docs/specs/014-identity/auth-and-guest-access.md),
//                    /e2e/token?sub=<id> minting an access token for any test account, with its teams
//                    claim, and /e2e/guest-token minting a guest token, all with the issuer and audience
//                    the api expects.
//                    It also answers the account API the api calls with its client credentials
//                    (/api/account/internal: settings, profiles, sightings, milestones, emails,
//                    activity, making a team, the teams change feed and the API token routes) from
//                    its own records, which the signed-in specs fill through /e2e/accounts/__seed/*
//                    (e2e/accounts-stub.ts). Test-only: nothing outside this stack trusts the key
//                    or the records.
//   E2E_WORKBENCH=1  the workbench embed e2e (docs/specs/013-workspace/blueprints/workbench-embeds.md,
//                    "Testing"): the stack acts as the accounts Worker (its stand-in, above),
//                    for the signed-in pairing page and the api calls the CLI makes, and the api
//                    builds its workbench and pairing URLs on this live origin (APP_BASE_URL). The
//                    live build must carry NEXT_PUBLIC_E2E_AUTH=1.
const WORKBENCH = process.env.E2E_WORKBENCH === '1';
const accountsKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
const ACCOUNTS_KID = 'e2e-accounts-stub';
// What the api worker is started with (below): its issuer is `${ACCOUNTS_URL}/api/auth`, and the
// audience is its own API_RESOURCE, exactly as against the real accounts Worker.
const ACCOUNTS_PATH = '/e2e/accounts';
const API_RESOURCE = 'https://e2e.livehuddle.test/api';
// The accounts origin the api and the index both trust: the stand-in on this live origin.
const ACCOUNTS_ORIGIN = `http://127.0.0.1:${EDITOR_PORT}${ACCOUNTS_PATH}`;

const b64url = (buf) => Buffer.from(buf).toString('base64url');

// The client the api worker is started with (below), as register-client.ts would make it.
const ACCOUNTS_CLIENT = { id: 'e2e-livehuddle', secret: 'e2e-client-secret' };

// The stand-in's records, as liveworkspace.app keeps them (liveworkspace/docs/specs/003-accounts/accounts.md "Teams" and
// "API tokens"). Every team and member carries the feed position of its last change, so the change
// feed is "everything after the cursor" and the api follows it as it follows the real one. Positions
// start at the boot time, so a feed reader never sees positions go backwards between runs of the stack.
const accountsRecords = {
  seq: Date.now(),
  teams: new Map(),
  members: new Map(),
  // `${owner} ${scope}` → that scope's settings. Profiles are the shared stand-in's (accountTokens, below).
  settings: new Map(),
  sightings: new Set(),
  milestones: new Set(),
};

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

// The account's API tokens, with each token's teams claim (packages/auth-client e2e-token-stand-in.ts, shared with
// the other apps' stacks).
const accountTokens = createTokenStandIn(ACCOUNTS_PATH, teamsClaim);

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
  if (route === '/tokens') {
    const claims = accessTokenClaims(body.accessToken);
    if (!claims) return sendJson(res, 401, { error: 'invalid_token' });
    const minted = accountTokens.seed({
      userId: claims.sub,
      email: claims.email ?? null,
      name: body.name,
      readOnly: Boolean(body.readOnly),
    });
    return sendJson(res, 201, minted);
  }
  // API tokens and profiles: the stand-in every app's stack shares.
  const shared = accountTokens.answer(route, body);
  if (shared) return sendJson(res, shared.status, shared.body);
  return sendJson(res, 404, { error: 'not_found' });
}

// The specs' own way in (e2e/accounts-stub.ts): what a person does on liveworkspace.app (making a
// team, joining one, making an API token), done to the records directly.
async function answerSeed(req, route, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
  const body = await readJson(req);
  if (route === 'team') return sendJson(res, 200, withoutSeq(seedTeam(body)));
  if (route === 'member') return sendJson(res, 200, withoutSeq(seedMember(body)));
  if (route === 'token') return sendJson(res, 200, accountTokens.seed(body));
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

// A guest token shaped like the accounts Worker's (liveworkspace/apps/accounts/src/guests.ts): a year long,
// told apart from an access token by `kind: "guest"`.
const GUEST_TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60;
function mintGuestToken(guestId = `guest_${randomUUID()}`) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', kid: ACCOUNTS_KID, typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub: guestId,
      kind: 'guest',
      iss: `http://127.0.0.1:${EDITOR_PORT}${ACCOUNTS_PATH}/api/auth`,
      aud: API_RESOURCE,
      iat: now,
      exp: now + GUEST_TOKEN_TTL_SECONDS,
    }),
  );
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), accountsKey.privateKey);
  return { token: `${header}.${payload}.${b64url(signature)}`, guestId };
}

// Answers the accounts stand-in's routes, or returns false for anything else.
function serveAccountsStandIn(req, pathname, url, res) {
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
  // The index asking for a person's teams as they are now (liveworkspace/apps/index/src/fresh-teams.ts): a team
  // made or joined after their access token was minted is usable at once, as in production.
  if (pathname === `${ACCOUNTS_PATH}/api/account/index/teams` && req.method === 'POST') {
    if (req.headers.authorization !== `Bearer ${MERGE_KEY}`) {
      sendJson(res, 401, { error: 'unauthorized' });
      return true;
    }
    readJson(req)
      .then((body) => sendJson(res, 200, { teams: teamsClaim(String(body.userId ?? '')) }))
      .catch(() => sendJson(res, 400, { error: 'invalid_json' }));
    return true;
  }
  if (pathname === `${ACCOUNTS_PATH}/api/auth/guest`) {
    // A new guest for every handoff: each browser context is its own visitor, and the app keeps the token.
    const redirectUri = url.searchParams.get('redirect_uri') ?? '';
    const state = url.searchParams.get('state') ?? '';
    if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+\/auth\/guest$/.test(redirectUri)) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('redirect_uri must be this stack');
      return true;
    }
    const fragment = new URLSearchParams({ guest_token: mintGuestToken().token, state });
    res.writeHead(302, { Location: `${redirectUri}#${fragment}`, 'Cache-Control': 'no-store' });
    res.end();
    return true;
  }
  if (pathname === '/e2e/guest-token') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(mintGuestToken()));
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
function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    child.on('error', reject);
  });
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
  const next = mkdtempSync(path.join(tmpdir(), 'livehuddle-e2e-deploy-'));
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

// The router's forwards (apps/router/src/index.ts): `/api/index/*` is the index's, and `/api/previews/*`
// liveworkspace's previews in the media service (routeToPreviews), each the same request at its origin minus this
// site's cookies.
const isIndexPath = (pathname) => pathname === '/api/index' || pathname.startsWith('/api/index/');
const isPreviewsPath = (pathname) =>
  pathname === '/api/previews' || pathname.startsWith('/api/previews/');

function proxyApi(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const toIndex = isIndexPath(pathname);
  const toPreviews = isPreviewsPath(pathname);
  const port = toIndex ? INDEX_PORT : toPreviews ? MEDIA_PORT : API_PORT;
  const headers = { ...req.headers };
  if (toIndex || toPreviews) {
    delete headers.cookie;
    headers.host = `127.0.0.1:${port}`;
  }
  const proxyReq = http.request(
    {
      host: '127.0.0.1',
      port,
      method: req.method,
      path: req.url,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: toIndex
          ? 'index_unreachable'
          : toPreviews
            ? 'previews_unreachable'
            : 'api_unreachable',
      }),
    );
  });
  req.pipe(proxyReq);
}

// The router's routeToWorkspace (@liveworkspace/sites/workspace-proxy): the Explorer is liveworkspace's page, shown
// at livehuddle's own /explorer with the address unchanged, its build assets under /_liveworkspace. Served from
// the site's static export when it is built; otherwise a logged 404, so only the specs that open the Explorer page
// need the build.
const isWorkspacePath = (pathname) =>
  pathname === '/explorer' ||
  pathname.startsWith('/explorer/') ||
  pathname.startsWith('/_liveworkspace/');

function serveWorkspace(req, res, pathname) {
  if (!existsSync(WORKSPACE_SITE_DIR)) {
    console.warn(`[e2e] ${pathname}: liveworkspace's site is not built (${WORKSPACE_SITE_DIR})`);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Not built: ${WORKSPACE_SITE_DIR}`);
    return;
  }
  // The export's own layout: each Explorer view a page of its own, its assets under out/_liveworkspace.
  const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const file = resolveIn(WORKSPACE_SITE_DIR, p);
  if (file) return serveFile(req, res, file, pathname);
  serveNotFound(req, res, pathname, path.join(WORKSPACE_SITE_DIR, '404.html'));
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
    if (isWorkspacePath(pathname)) return serveWorkspace(req, res, pathname);
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
      `[e2e] ${OUT_DIR} missing — run \`pnpm --filter @livehuddle/editor build\` first`,
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
  if (!existsSync(WORKSPACE_SITE_DIR)) {
    console.warn(
      `[e2e] liveworkspace's site is not built (${WORKSPACE_SITE_DIR}): /explorer answers 404 until it is`,
    );
  }
  console.log('[e2e] applying the index local D1 migrations…');
  rmSync(INDEX_STATE, { recursive: true, force: true });
  await waitForExit(
    run(
      'pnpm',
      [
        'exec',
        'wrangler',
        'd1',
        'migrations',
        'apply',
        'liveworkspace-index',
        '--local',
        '--persist-to',
        INDEX_STATE,
      ],
      { cwd: INDEX_DIR },
    ),
  );
  console.log('[e2e] starting the index…');
  run(
    'pnpm',
    [
      'exec',
      'wrangler',
      'dev',
      '--local',
      '--port',
      String(INDEX_PORT),
      '--inspector-port',
      String(INDEX_PORT + 1000),
      '--persist-to',
      INDEX_STATE,
      // Everything it trusts and calls is this stack, never what a developer's .dev.vars names: the accounts the
      // api trusts (the stand-in), this api's audience and key, and this api's origin.
      '--var',
      'ENVIRONMENT:development',
      '--var',
      `ACCOUNTS_URL:${ACCOUNTS_ORIGIN}`,
      '--var',
      `INDEX_AUDIENCES:${API_RESOURCE}`,
      '--var',
      `INDEX_KEY_LIVEHUDDLE:${INDEX_KEY}`,
      '--var',
      `APP_ORIGIN_LIVEHUDDLE:http://127.0.0.1:${API_PORT}`,
      '--var',
      `MERGE_KEY:${MERGE_KEY}`,
    ],
    { cwd: INDEX_DIR },
  );
  const mediaUrl = await startE2EMedia({
    run,
    waitForExit,
    port: MEDIA_PORT,
    state: MEDIA_STATE,
    apps: [MEDIA_APP],
    // Previews end to end: the stack's index decides who sees one, this api's export door draws it.
    indexUrl: `http://127.0.0.1:${INDEX_PORT}/api/index`,
    appOrigins: { [MEDIA_APP]: `http://127.0.0.1:${API_PORT}` },
  });
  console.log('[e2e] starting api worker…');
  run(
    'pnpm',
    [
      '--filter',
      '@livehuddle/api',
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
      // Verify access and guest tokens against the stack's own key (the accounts stand-in above), never a
      // real accounts Worker a developer's .dev.vars may name. The client id and secret also turn the
      // guest handoff (/api/auth/guest) on, to the stand-in's.
      '--var',
      `ACCOUNTS_URL:${ACCOUNTS_ORIGIN}`,
      '--var',
      `API_RESOURCE:${API_RESOURCE}`,
      '--var',
      `ACCOUNTS_CLIENT_ID:${ACCOUNTS_CLIENT.id}`,
      '--var',
      `ACCOUNTS_CLIENT_SECRET:${ACCOUNTS_CLIENT.secret}`,
      // The stack's index, never one a developer's .dev.vars names.
      '--var',
      `INDEX_ORIGIN:http://127.0.0.1:${INDEX_PORT}`,
      '--var',
      `INDEX_KEY:${INDEX_KEY}`,
      // The stack's media, never one a developer's .dev.vars names.
      '--var',
      `MEDIA_URL:${mediaUrl}`,
      '--var',
      `MEDIA_KEY:${e2eMediaKey(MEDIA_APP)}`,
      ...(WORKBENCH ? ['--var', `APP_BASE_URL:http://localhost:${EDITOR_PORT}`] : []),
    ],
    {
      cwd: ROOT,
    },
  );
  await waitForPort(INDEX_PORT, 'index');
  await waitForPort(MEDIA_PORT, 'media');
  await waitForPort(API_PORT, 'api worker');
  console.log('[e2e] api worker up; starting live static server…');
  startLiveServer();
}

main().catch((err) => {
  console.error('[e2e] stack failed:', err);
  shutdown(1);
});
