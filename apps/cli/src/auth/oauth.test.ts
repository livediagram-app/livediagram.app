import { describe, expect, it } from 'vitest';
import { CLI_CLIENT_ID, DEVICE_CODE_GRANT } from '@livediagram/api-schema';
import { run } from '../main';
import { fakeIo, TOKEN, type FakeIo, type Route } from '../testing/fake-io';
import { LOGIN_TIMEOUT_MS } from './oauth';

// Browser and device sign-in through `auth login` (docs/specs/015-api/blueprints/cli.md "The CLI's OAuth client",
// "Credentials", CLI34 to CLI36), on a fake host with an authorization server.

const HOST = 'https://livediagram.app';
const ISSUER = 'https://mcp.livediagram.app';
const NEW = `lvd_${'b'.repeat(43)}`;

type Script = {
  tokenAnswers?: Record<string, unknown>[];
  meta?: Record<string, unknown>;
  noIssuer?: boolean;
};

function host(script: Script = {}) {
  const forms: Record<string, string>[] = [];
  const answers = [...(script.tokenAnswers ?? [])];
  const route: Route = async (request, url) => {
    if (url.pathname === '/api/capabilities')
      return Response.json({
        apiBase: `${HOST}/api`,
        authEnabled: true,
        documentFormat: 2,
        ...(script.noIssuer ? {} : { oauthIssuer: ISSUER }),
      });
    if (url.href === `${ISSUER}/.well-known/oauth-authorization-server`)
      return Response.json(
        script.meta ?? {
          authorization_endpoint: `${ISSUER}/oauth/authorize`,
          token_endpoint: `${ISSUER}/oauth/token`,
          device_authorization_endpoint: `${ISSUER}/oauth/device_authorization`,
        },
      );
    if (url.origin === ISSUER && request.method === 'POST') {
      const fields = Object.fromEntries(new URLSearchParams(await request.text()));
      forms.push({ path: url.pathname, ...fields });
      if (url.pathname === '/oauth/device_authorization')
        return Response.json({
          device_code: 'dev-1',
          user_code: 'BCDF-GHJK',
          verification_uri: 'https://livediagram.app/oauth/device',
          verification_uri_complete: 'https://livediagram.app/oauth/device?code=BCDF-GHJK',
          interval: 5,
        });
      const next = answers.shift() ?? { access_token: NEW, token_type: 'Bearer' };
      return Response.json(next, { status: 'access_token' in next ? 200 : 400 });
    }
    if (url.pathname === '/api/tokens/current') {
      const auth = request.headers.get('Authorization');
      if (request.method === 'DELETE') return new Response(null, { status: 204 });
      return Response.json({
        accountId: 'u1',
        accountName: auth === `Bearer ${NEW}` ? 'Webber' : 'old',
        tokenId: auth === `Bearer ${NEW}` ? 'tok_new' : 'tok_old',
        role: 'full',
        expiresAt: null,
      });
    }
    return undefined;
  };
  return { route, forms };
}

async function start(argv: string[], script: Script = {}, io?: FakeIo) {
  const h = host(script);
  const used = io ?? fakeIo({ routes: [h.route] });
  const exit = run(argv, used);
  return { ...h, io: used, exit };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
async function opened(io: FakeIo): Promise<URL> {
  for (let i = 0; i < 50 && io.opened.length === 0; i++) await tick();
  return new URL(io.opened[0]!);
}

describe('auth login through the browser', () => {
  it('opens the authorize URL with PKCE, takes the callback, and stores the token it exchanges', async () => {
    const { io, exit, forms } = await start(['auth', 'login']);
    const url = await opened(io);
    expect(url.origin + url.pathname).toBe(`${ISSUER}/oauth/authorize`);
    const q = url.searchParams;
    expect([
      q.get('client_id'),
      q.get('redirect_uri'),
      q.get('response_type'),
      q.get('code_challenge_method'),
    ]).toEqual([CLI_CLIENT_ID, 'http://127.0.0.1:4321/callback', 'code', 'S256']);
    expect(q.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(io.err()).toContain(
      `Opening ${url.href} in your browser. If it does not open, open it yourself.`,
    );
    expect((await io.visit('http://127.0.0.1:4321/favicon.ico')).status).toBe(404);
    expect((await io.visit('http://127.0.0.1:4321/callback?state=wrong&code=x')).status).toBe(404);
    const page = await io.visit(`http://127.0.0.1:4321/callback?state=${q.get('state')}&code=c1`);
    expect([page.status, page.html]).toEqual([200, expect.stringContaining("You're signed in")]);
    expect(await exit).toBe(0);
    expect(io.out()).toBe('signed in to https://livediagram.app as Webber\n');
    expect(forms[0]).toMatchObject({
      grant_type: 'authorization_code',
      code: 'c1',
      client_id: CLI_CLIENT_ID,
      redirect_uri: 'http://127.0.0.1:4321/callback',
    });
    expect(forms[0]!.code_verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect([...io.fileMap.values()].some((f) => f.data.includes(NEW))).toBe(true);
  });

  it('ends on a cancelled browser, a refused code, and a browser that never comes back', async () => {
    const cancelled = await start(['auth', 'login']);
    const q = (await opened(cancelled.io)).searchParams;
    const page = await cancelled.io.visit(
      `http://127.0.0.1:4321/callback?state=${q.get('state')}&error=access_denied`,
    );
    expect([page.status, page.html]).toEqual([403, expect.stringContaining('Sign-in cancelled')]);
    expect(await cancelled.exit).toBe(4);
    expect(cancelled.io.err()).toContain('sign-in was cancelled in the browser (access_denied)');
    const refused = await start(['auth', 'login'], { tokenAnswers: [{ error: 'invalid_grant' }] });
    const r = (await opened(refused.io)).searchParams;
    await refused.io.visit(`http://127.0.0.1:4321/callback?state=${r.get('state')}&code=c`);
    expect(await refused.exit).toBe(4);
    expect(refused.io.err()).toContain('refused the code (invalid_grant)');
    const idle = await start(['auth', 'login']);
    await opened(idle.io);
    await idle.io.advance(LOGIN_TIMEOUT_MS);
    expect(await idle.exit).toBe(4);
    expect(idle.io.err()).toContain('livediagram auth login --device');
  });

  it('notes a browser that did not open, and refuses metadata that points elsewhere', async () => {
    const io = fakeIo({ routes: [host().route] });
    io.openUrl = async (u) => {
      io.opened.push(u);
      return false;
    };
    const quiet = await start(['auth', 'login'], {}, io);
    const q = (await opened(io)).searchParams;
    await io.visit(`http://127.0.0.1:4321/callback?state=${q.get('state')}&code=c`);
    expect(await quiet.exit).toBe(0);
    const elsewhere = await start(['auth', 'login'], {
      meta: {
        authorization_endpoint: 'https://evil.test/authorize',
        token_endpoint: `${ISSUER}/oauth/token`,
      },
    });
    expect(await elsewhere.exit).toBe(4);
    expect(elsewhere.io.err()).toContain('points elsewhere (https://evil.test/authorize)');
    expect(await (await start(['auth', 'login'], { meta: {} })).exit).toBe(4);
  });
});

describe('auth login --device', () => {
  it('shows the code, polls at the interval, slows down when told, and stores the token', async () => {
    const { io, exit, forms } = await start(['auth', 'login', '--device'], {
      tokenAnswers: [
        { error: 'authorization_pending' },
        { error: 'slow_down' },
        { error: 'authorization_pending' },
      ],
    });
    expect(await exit).toBe(0);
    expect(io.err()).toContain(
      'Open https://livediagram.app/oauth/device and enter BCDF-GHJK. Waiting for approval…',
    );
    expect(io.slept).toEqual([5000, 5000, 10000, 10000]);
    expect(
      forms
        .filter((f) => f.path === '/oauth/token')
        .every((f) => f.grant_type === DEVICE_CODE_GRANT && f.device_code === 'dev-1'),
    ).toBe(true);
    expect(io.out()).toBe('signed in to https://livediagram.app as Webber\n');
  });

  it('ends on a refusal, an expired code and any other error, each with its words', async () => {
    for (const [error, words] of [
      ['access_denied', 'sign-in was refused on the device page'],
      ['expired_token', 'the code expired before it was approved'],
      ['invalid_client', 'device sign-in failed (invalid_client)'],
    ]) {
      const { io, exit } = await start(['auth', 'login', '--device'], {
        tokenAnswers: [{ error }],
      });
      expect(await exit).toBe(4);
      expect(io.err()).toContain(words);
    }
  });

  it('needs a device endpoint, and a host whose server starts one', async () => {
    const none = await start(['auth', 'login', '--device'], {
      meta: { authorization_endpoint: `${ISSUER}/a`, token_endpoint: `${ISSUER}/t` },
    });
    expect(await none.exit).toBe(4);
    expect(none.io.err()).toContain('offers no device sign-in');
    const broken = host();
    const io = fakeIo({
      routes: [
        (r, u) =>
          u.pathname === '/oauth/device_authorization'
            ? Response.json({ error: 'rate_limited' }, { status: 429 })
            : broken.route(r, u),
      ],
    });
    expect(await run(['auth', 'login', '--device'], io)).toBe(4);
    expect(io.err()).toContain('device sign-in could not start (rate_limited)');
  });

  it('refuses a host whose sign-in server is down', async () => {
    const io = fakeIo({
      routes: [
        (r, u) =>
          u.pathname.startsWith('/.well-known')
            ? new Response('', { status: 503 })
            : host().route(r, u),
      ],
    });
    expect(await run(['auth', 'login'], io)).toBe(4);
    expect(io.err()).toContain('has no sign-in server (HTTP 503)');
  });

  it('replaces a stored token and revokes the old one', async () => {
    const io = fakeIo({ routes: [host().route] });
    io.readStdin = async () => TOKEN;
    expect(await run(['auth', 'login', '--with-token'], io)).toBe(0);
    expect(await run(['auth', 'login', '--device'], io)).toBe(0);
    expect(
      io.requests.some(
        (r) => r.method === 'DELETE' && r.headers.get('Authorization') === `Bearer ${TOKEN}`,
      ),
    ).toBe(true);
  });
});

describe('a sign-in server that answers badly', () => {
  it('names what is missing rather than failing obscurely', async () => {
    const base = host();
    let polls = 0;
    const odd: Route = async (r, u) => {
      if (u.pathname === '/oauth/device_authorization') return Response.json({ device_code: 'd' });
      if (u.pathname === '/oauth/token')
        return ++polls === 1
          ? new Response('not json', { status: 500 })
          : Response.json(null, { status: 400 });
      return base.route(r, u);
    };
    const device = fakeIo({ routes: [odd] });
    expect(await run(['auth', 'login', '--device'], device)).toBe(4);
    expect(device.slept).toEqual([5000]);
    expect(device.err()).toContain('device sign-in failed (unknown)');
    const nullBody = fakeIo({ routes: [odd] });
    expect(await run(['auth', 'login', '--device'], nullBody)).toBe(4);
    expect(nullBody.err()).toContain('device sign-in failed (unknown)');
    const silent = fakeIo({
      routes: [
        (r, u) =>
          u.pathname === '/oauth/device_authorization'
            ? new Response('', { status: 500 })
            : base.route(r, u),
      ],
    });
    expect(await run(['auth', 'login', '--device'], silent)).toBe(4);
    expect(silent.err()).toContain('could not start (no code)');
    const noCode = await start(['auth', 'login']);
    const q = (await opened(noCode.io)).searchParams;
    await noCode.io.visit(`http://127.0.0.1:4321/callback?state=${q.get('state')}`);
    expect(await noCode.exit).toBe(4);
    expect(noCode.io.err()).toContain('cancelled in the browser (no code)');
    const empty = await start(['auth', 'login'], { tokenAnswers: [{}] });
    const e = (await opened(empty.io)).searchParams;
    await empty.io.visit(`http://127.0.0.1:4321/callback?state=${e.get('state')}&code=c`);
    expect(await empty.exit).toBe(4);
    expect(empty.io.err()).toContain('refused the code (no token)');
  });
});
