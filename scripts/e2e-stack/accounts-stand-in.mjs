// The e2e stacks' accounts stand-in (every product's scripts/e2e-stack.mjs, through ./stack.mjs, and their
// docs/specs/003-system-architecture/e2e-smoke.md): the stack acts as the liveworkspace accounts Worker, its key made
// at boot, its JWKS, the guest handoff, minted access and guest tokens, the API tokens and profiles
// (packages/auth-client e2e-token-stand-in.ts) and, where a product's specs seed them (`records`), the rest of the
// account API the api calls with its client credentials, all from its own records. Test-only: nothing outside the
// stack trusts the key or the records. Dependency-free (node builtins), as the stacks are.

import { generateKeyPairSync, randomUUID, sign, verify } from 'node:crypto';
import { createTokenStandIn } from '../../packages/auth-client/src/e2e-token-stand-in.ts';

// `editorPort` is the live origin's port, `apiResource` the api's audience, `clientId` the api's accounts client,
// and `mergeKey` what the index's teams call carries. `records: false` keeps no teams, settings or sightings: the
// account API answers API tokens and profiles only, and tokens carry no teams claim (livedesign, livedocuments,
// liveplanner, whose specs seed none).
export function createAccountsStandIn({
  editorPort,
  apiResource,
  clientId,
  mergeKey,
  records = true,
}) {
  const EDITOR_PORT = editorPort;
  const API_RESOURCE = apiResource;
  const MERGE_KEY = mergeKey;
  const accountsKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const ACCOUNTS_KID = 'e2e-accounts-stub';
  // What the api worker is started with (below): its issuer is `${ACCOUNTS_URL}/api/auth`, and the
  // audience is its own API_RESOURCE, exactly as against the real accounts Worker.
  const ACCOUNTS_PATH = '/e2e/accounts';
  // The accounts origin the api and the index both trust: the stand-in on this live origin.
  const ACCOUNTS_ORIGIN = `http://127.0.0.1:${EDITOR_PORT}${ACCOUNTS_PATH}`;

  const b64url = (buf) => Buffer.from(buf).toString('base64url');

  // The client the api worker is started with (below), as register-client.ts would make it.
  const ACCOUNTS_CLIENT = { id: clientId, secret: 'e2e-client-secret' };

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
  const accountTokens = records
    ? createTokenStandIn(ACCOUNTS_PATH, teamsClaim)
    : createTokenStandIn(ACCOUNTS_PATH);

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
        ...(records ? { teams: teamsClaim(sub) } : {}),
      }),
    );
    const signature = sign('sha256', Buffer.from(`${header}.${payload}`), accountsKey.privateKey);
    return `${header}.${payload}.${b64url(signature)}`;
  }

  // A guest token shaped like the accounts Worker's (liveworkspace/apps/accounts/src/guests.ts): 45 days long,
  // told apart from an access token by `kind: "guest"`.
  const GUEST_TOKEN_TTL_SECONDS = 45 * 24 * 60 * 60;
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
    // Without records, only the shared API tokens and profiles answer the account API (and seed a token).
    if (!records && accountTokens.serve(req, res, pathname)) return true;
    if (records && (pathname.startsWith(internal) || pathname.startsWith(seed))) {
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
    if (
      records &&
      pathname === `${ACCOUNTS_PATH}/api/account/index/teams` &&
      req.method === 'POST'
    ) {
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

  return { ACCOUNTS_ORIGIN, ACCOUNTS_CLIENT, serveAccountsStandIn };
}
