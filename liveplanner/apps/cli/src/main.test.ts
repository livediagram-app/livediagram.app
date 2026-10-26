import { describe, expect, it } from 'vitest';
import { renderSkill } from '@liveplanner/agent-verbs';
import { run } from './main';
import { capabilities, fakeIo, NOW, TOKEN, type Route } from './testing/fake-io';
import { CLI_VERSION } from './config/version';

const DOC = 'aaaa1111-0000-4000-8000-000000000001';
const CREDENTIALS = '/home/agent/.config/liveplanner/credentials.json';
const current = {
  accountId: 'u1',
  accountName: 'Ada',
  tokenId: 't1',
  tokenName: 'cli',
  role: 'full',
  expiresAt: NOW + 30 * 86_400_000,
};

const library: Route = (_, url) => {
  if (url.pathname === '/api/projects')
    return Response.json({
      projects: [{ id: DOC, name: 'Auth flow', savedAt: NOW, ownerId: 'u1' }],
    });
  if (url.pathname === '/api/teams') return Response.json({ teams: [] });
  if (url.pathname === `/api/projects/${DOC}`)
    return Response.json({
      project: {
        id: DOC,
        name: 'Auth flow',
        tabs: [{ id: 'tab1-0000', name: 'Overview', orderIndex: 0 }],
      },
    });
  if (url.pathname === `/api/projects/${DOC}/tabs/tab1-0000` && url.searchParams.get('json'))
    return Response.json({ nodes: [] });
  return undefined;
};

const tokens: Route = (request, url) => {
  if (url.pathname !== '/api/tokens/current') return undefined;
  if (request.headers.get('Authorization') === 'Bearer lwt_revoked_00000000000000000000')
    return Response.json({ error: 'token_revoked' }, { status: 401 });
  return request.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json(current);
};

const signedIn = (more: Parameters<typeof fakeIo>[0] = {}) =>
  fakeIo({ env: { LIVEPLANNER_TOKEN: TOKEN }, routes: [capabilities, library, tokens], ...more });

async function cli(argv: string[], io = signedIn()) {
  const code = await run(argv, io);
  return { code, out: io.out(), err: io.err(), io };
}

describe('run', () => {
  it('prints help at each level and the version, reaching no host', async () => {
    const io = fakeIo();
    expect((await cli([], io)).out).toContain('Usage: liveplanner <resource> <verb>');
    expect((await cli(['tab'], fakeIo())).out).toContain('liveplanner tab: ');
    expect((await cli(['tab', 'view', '--help'], fakeIo())).out).toContain(
      'Usage: liveplanner tab view <project>',
    );
    expect(await cli(['--version'], fakeIo())).toMatchObject({ code: 0, out: `${CLI_VERSION}\n` });
    expect(io.requests).toEqual([]);
  });

  it('reads with the token, the CLI headers, and the compact text on stdout', async () => {
    const { code, out, err, io } = await cli(['project', 'ls']);
    expect({ code, out, err }).toEqual({
      code: 0,
      out: `aaaa  "Auth flow"  personal  2026-10-05\n`,
      err: '',
    });
    const request = io.requests.at(-1)!;
    expect(request.headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(request.headers.get('X-Liveplanner-Client')).toBe('cli');
    expect(request.headers.get('User-Agent')).toBe(
      `liveplanner-cli/${CLI_VERSION} node/24.0.0 linux`,
    );
  });

  it('picks fields of each listed row, and asks the api for JSON when a verb takes --json', async () => {
    const ls = await cli(['project', 'ls', 'auth', '--json=id,name']);
    expect(ls.code).toBe(0);
    expect(JSON.parse(ls.out)).toHaveProperty('projects', [{ id: DOC, name: 'Auth flow' }]);
    const view = await cli(['tab', 'view', 'auth flow', '--json']);
    expect(view.io.requests.some((r) => /view=outline&json=1$/.test(r.url))).toBe(true);
  });

  it("sends a share link's code with every request after it resolves", async () => {
    const share: Route = (_, url) =>
      url.pathname === '/api/share/abc'
        ? Response.json({ project: { id: DOC, name: 'Auth flow' } })
        : undefined;
    const io = signedIn({ routes: [capabilities, share, library, tokens] });
    expect(
      (await cli(['tab', 'ls', 'https://www.liveplanner.app/project/shared?s=abc'], io)).code,
    ).toBe(0);
    expect(io.requests.at(-1)!.headers.get('X-Share-Code')).toBe('abc');
    expect(io.requests[1]!.headers.get('X-Share-Code')).toBeNull();
  });

  it('refuses usage with exit 2, a missing project with exit 3, as text or JSON on stderr', async () => {
    expect(await cli(['tab', 'vew'])).toMatchObject({ code: 2, out: '' });
    const missing = await cli(['tab', 'ls', 'nope']);
    expect(missing).toMatchObject({
      code: 3,
      out: '',
      err: 'error: no plan matches "nope"\nhint: liveplanner project ls\n',
    });
    const json = await cli(['tab', 'ls', 'nope', '--json']);
    expect(JSON.parse(json.err)).toEqual({
      error: 'not_found',
      message: 'no plan matches "nope"',
      hint: 'liveplanner project ls',
    });
  });

  it('needs a credential and a host with sign-in', async () => {
    const none = await cli(['project', 'ls'], fakeIo({ routes: [capabilities] }));
    expect(none).toMatchObject({
      code: 4,
      err: expect.stringContaining('not signed in to https://www.liveplanner.app'),
    });
    const guestOnly = fakeIo({
      env: { LIVEPLANNER_TOKEN: TOKEN },
      routes: [() => Response.json({ aiEnabled: false })],
    });
    expect(await cli(['project', 'ls'], guestOnly)).toMatchObject({
      code: 4,
      err: expect.stringContaining('has no sign-in'),
    });
  });

  it('names the real host when it cannot be reached', async () => {
    const io = fakeIo({
      env: { LIVEPLANNER_HOST: 'https://diagrams.example' },
      routes: [
        () => {
          throw new TypeError('fetch failed');
        },
      ],
    });
    expect(await cli(['project', 'ls'], io)).toMatchObject({
      code: 7,
      err: expect.stringContaining('could not reach https://diagrams.example (fetch failed)'),
    });
  });

  it("refuses writes below the host's version floor, but not reads", async () => {
    const floor: Route = (_, url) =>
      url.pathname === '/api/capabilities'
        ? Response.json({ aiEnabled: false, authEnabled: true, cli: { minVersion: '99.0.0' } })
        : undefined;
    const routes = [floor, library, tokens];
    const io = fakeIo({ env: { LIVEPLANNER_TOKEN: TOKEN }, routes });
    expect((await cli(['api', 'POST', '/projects'], io)).code).toBe(1);
    expect(io.err()).toContain('accepts writes from liveplanner 99.0.0 or later');
    expect(
      (
        await cli(
          ['api', 'GET', '/projects'],
          fakeIo({ env: { LIVEPLANNER_TOKEN: TOKEN }, routes }),
        )
      ).code,
    ).toBe(0);
    expect(
      (await cli(['project', 'ls'], fakeIo({ env: { LIVEPLANNER_TOKEN: TOKEN }, routes }))).code,
    ).toBe(0);
  });

  it('prints the debug lines under LIVEPLANNER_DEBUG=1 only', async () => {
    const io = signedIn({ env: { LIVEPLANNER_TOKEN: TOKEN, LIVEPLANNER_DEBUG: '1' } });
    await cli(['tab', 'ls', 'Auth flow'], io);
    expect(io.err().split('\n').filter(Boolean)).toEqual([
      '[cli] command tab.ls',
      '[cli] profile default host https://www.liveplanner.app source default',
      '[cli] capabilities miss',
      '[cli] credential env',
      '[cli] request GET /api/projects 200 0',
      '[cli] request GET /api/teams 200 0',
      '[cli] address project name 1 matches',
      `[cli] request GET /api/projects/${DOC} 200 0`,
      '[cli] exit 0',
      '[cli] telemetry skipped env',
    ]);
    const failing = signedIn({ env: { LIVEPLANNER_TOKEN: TOKEN, LIVEPLANNER_DEBUG: '1' } });
    await cli(['tab', 'ls', 'nope'], failing);
    expect(failing.err()).toContain('[cli] exit 3 not_found');
  });
});

describe('a profile on another host', () => {
  it('never contacts liveplanner.app across a session of commands', async () => {
    const OTHER = 'https://planner.example';
    const config = '/home/agent/.config/liveplanner/config.toml';
    const otherHost: Route = (request, url) => {
      if (url.origin !== OTHER) return undefined;
      const path = url.pathname;
      if (path === '/api/capabilities')
        return Response.json({ aiEnabled: false, apiBase: `${OTHER}/api`, authEnabled: true });
      return (
        library(request, new URL(`https://www.liveplanner.app${path}${url.search}`)) ??
        tokens(request, url)
      );
    };
    const files = {
      [config]: 'default_profile = "other"\n[profiles.other]\nhost = "https://planner.example"',
    };
    const io = fakeIo({ env: { LIVEPLANNER_TOKEN: TOKEN }, routes: [otherHost], files });
    for (const argv of [
      ['project', 'ls'],
      ['tab', 'ls', 'Auth flow'],
      ['tab', 'view', 'Auth flow'],
      ['auth', 'status'],
    ])
      await run(argv, io);
    expect(io.requests.length).toBeGreaterThan(5);
    expect(new Set(io.requests.map((r) => new URL(r.url).origin))).toEqual(new Set([OTHER]));
  });
});

describe('the local verbs', () => {
  it('print the guides and the skill without a host', async () => {
    expect((await cli(['guide'], fakeIo())).out).toContain('Guides: liveplanner guide <topic>');
    expect((await cli(['guide', 'edit'], fakeIo())).out).toContain('Edit a tab');
    expect((await cli(['skill', 'print'], fakeIo())).out).toBe(renderSkill());
  });

  it('install the skill, overwriting only a liveplanner skill', async () => {
    const io = fakeIo();
    expect(await cli(['skill', 'install', '--to', '~/.claude/skills'], io)).toMatchObject({
      code: 0,
      out: '/home/agent/.claude/skills/liveplanner/SKILL.md\n',
    });
    expect(io.fileMap.get('/home/agent/.claude/skills/liveplanner/SKILL.md')?.data).toBe(
      renderSkill(),
    );
    expect((await cli(['skill', 'install', '--to', '~/.claude/skills'], io)).code).toBe(0);
    const other = fakeIo({ files: { './skills/liveplanner/SKILL.md': '---\nname: other\n---\n' } });
    expect(await cli(['skill', 'install', '--to', './skills'], other)).toMatchObject({
      code: 1,
      err: expect.stringContaining('holds another skill'),
    });
    expect(await cli(['skill', 'install'], fakeIo())).toMatchObject({
      code: 2,
      err: expect.stringContaining('~/.claude/skills'),
    });
  });

  it('call any api path, printing the body and exiting by its status', async () => {
    const echo: Route = async (request, url) =>
      url.pathname.startsWith('/api/echo')
        ? Response.json(
            { method: request.method, body: await request.text() },
            { status: url.searchParams.get('s') ? 409 : 200 },
          )
        : undefined;
    const io = signedIn({ routes: [capabilities, echo], stdin: '{"a":1}' });
    expect(await cli(['api', 'post', 'api/echo', '--body', '-'], io)).toMatchObject({ code: 0 });
    expect(io.out()).toBe('{"method":"POST","body":"{\\"a\\":1}"}\n');
    const conflict = signedIn({
      routes: [capabilities, echo],
      files: { '/work/b.json': '{"b":2}' },
    });
    expect(await cli(['api', 'PATCH', '/echo?s=1', '--body', 'b.json'], conflict)).toMatchObject({
      code: 5,
      out: '{"method":"PATCH","body":"{\\"b\\":2}"}\n',
    });
  });

  it('refuse a bad method, a URL, a whole-tab save and a missing body file', async () => {
    expect((await cli(['api', 'FETCH', '/projects'])).err).toContain(
      'FETCH is not one of GET, POST, PUT, PATCH, DELETE',
    );
    expect((await cli(['api', 'GET', 'https://evil.example/x'])).err).toContain('is a URL');
    expect((await cli(['api', 'GET', '//evil.example/x'])).err).toContain('is a URL');
    expect((await cli(['api', 'PUT', '/projects//tabs/main'])).code).toBe(2);
    expect(await cli(['api', 'PUT', '/projects/d/tabs/t'])).toMatchObject({
      code: 2,
      err: expect.stringContaining('never saves a whole tab'),
    });
    expect((await cli(['api', 'POST', '/projects', '--body', 'nope.json'])).err).toContain(
      'no file nope.json',
    );
  });
});

const storedAs = (token: string, tokenId: string) =>
  JSON.stringify({
    version: 1,
    profiles: {
      default: {
        host: 'https://www.liveplanner.app',
        token,
        tokenId,
        accountName: null,
        role: 'full',
        expiresAt: null,
      },
    },
  });

describe('auth', () => {
  // A newer `auth login` revokes the token a long command started with: the command reads the store again and goes on.
  it('fails as signed out when the store was emptied while the command ran', async () => {
    const io = fakeIo({
      routes: [
        capabilities,
        (_request, url) => {
          if (url.pathname !== '/api/tokens/current') return undefined;
          io.fileMap.delete(CREDENTIALS);
          return Response.json({ error: 'invalid_token' }, { status: 401 });
        },
      ],
      files: { [CREDENTIALS]: storedAs('lwt_old_0000000000000000000000', 't0') },
    });

    const { code } = await cli(['auth', 'status'], io);

    expect(code).toBe(4);
    expect(
      io.requests.filter((r) => new URL(r.url).pathname === '/api/tokens/current'),
    ).toHaveLength(1);
  });

  it('reads the stored credential again when the api refuses the one it started with', async () => {
    const rotated = 'lwt_rotated_000000000000000000000';
    const io = fakeIo({
      routes: [capabilities, (request, url) => rotating(request, url)],
      files: { [CREDENTIALS]: storedAs('lwt_old_0000000000000000000000', 't0') },
    });
    const rotating: Route = (request, url) => {
      if (url.pathname !== '/api/tokens/current') return undefined;
      if (request.headers.get('Authorization') === `Bearer ${rotated}`)
        return Response.json(current);
      // The first answer is a refusal, and meanwhile another login has stored a new token.
      io.fileMap.set(CREDENTIALS, { data: storedAs(rotated, 't2'), mode: 0o600 });
      return Response.json({ error: 'invalid_token' }, { status: 401 });
    };

    const { code, out } = await cli(['auth', 'status'], io);

    expect(code).toBe(0);
    expect(out).toContain('account  Ada');
    expect(io.requests.map((r) => r.headers.get('Authorization')).slice(-2)).toEqual([
      'Bearer lwt_old_0000000000000000000000',
      `Bearer ${rotated}`,
    ]);
  });

  it('logs in with a token from stdin, checks it, stores it, and revokes the one it replaces', async () => {
    const io = fakeIo({
      routes: [capabilities, tokens],
      stdin: `${TOKEN}\n`,
      files: { [CREDENTIALS]: storedAs('lwt_old_0000000000000000000000', 't0') },
    });
    expect(await cli(['auth', 'login', '--with-token'], io)).toMatchObject({
      code: 0,
      out: 'signed in to https://www.liveplanner.app as Ada\n',
    });
    expect(JSON.parse(io.fileMap.get(CREDENTIALS)!.data)).toHaveProperty(
      'profiles.default',
      expect.objectContaining({ token: TOKEN, tokenId: 't1' }),
    );
    expect(io.requests.at(-1)).toMatchObject({ method: 'DELETE' });
    expect(io.requests.at(-1)!.headers.get('Authorization')).toBe(
      'Bearer lwt_old_0000000000000000000000',
    );
  });

  it('warns when the replaced token cannot be revoked, and replaces the same token quietly', async () => {
    const revoked = fakeIo({
      routes: [capabilities, tokens],
      stdin: TOKEN,
      files: { [CREDENTIALS]: storedAs('lwt_revoked_00000000000000000000', 't0') },
    });
    await cli(['auth', 'login', '--with-token'], revoked);
    expect(revoked.err()).toContain('the previous token could not be revoked');
    const down: Route = (request, url) => {
      if (url.pathname === '/api/tokens/current' && request.method === 'DELETE')
        throw new TypeError('down');
      return tokens(request, url);
    };
    const offline = fakeIo({
      routes: [capabilities, down],
      stdin: TOKEN,
      files: { [CREDENTIALS]: storedAs('lwt_old_0000000000000000000000', 't0') },
    });
    await cli(['auth', 'login', '--with-token'], offline);
    expect(offline.err()).toContain('could not be revoked');
    const same = fakeIo({
      routes: [capabilities, tokens],
      stdin: TOKEN,
      files: { [CREDENTIALS]: storedAs(TOKEN, 't1') },
    });
    await cli(['auth', 'login', '--with-token'], same);
    expect(same.requests.every((r) => r.method === 'GET')).toBe(true);
  });

  it('names the account by id when it has no name', async () => {
    const nameless: Route = (_, url) =>
      url.pathname === '/api/tokens/current'
        ? Response.json({ ...current, accountName: null })
        : undefined;
    expect(
      (
        await cli(
          ['auth', 'login', '--with-token'],
          fakeIo({ routes: [capabilities, nameless], stdin: TOKEN }),
        )
      ).out,
    ).toBe('signed in to https://www.liveplanner.app as u1\n');
  });

  it('refuses browser sign-in on a host without one, and a token from a terminal or that is not a token', async () => {
    const bare = await cli(['auth', 'login'], fakeIo({ routes: [capabilities] }));
    expect([bare.code, bare.err]).toEqual([
      4,
      expect.stringContaining('offers no browser sign-in'),
    ]);
    expect(
      (await cli(['auth', 'login', '--with-token', '--device'], fakeIo({ routes: [capabilities] })))
        .code,
    ).toBe(2);
    expect(
      (
        await cli(
          ['auth', 'login', '--with-token'],
          fakeIo({ routes: [capabilities], stdinIsTTY: true }),
        )
      ).err,
    ).toContain('not a terminal');
    expect(
      await cli(
        ['auth', 'login', '--with-token'],
        fakeIo({ routes: [capabilities], stdin: 'hello' }),
      ),
    ).toMatchObject({ code: 1, err: 'error: that is not an API token (lwt_…)\n' });
    expect(
      (
        await cli(
          ['auth', 'login', '--with-token'],
          fakeIo({ routes: [capabilities, tokens], stdin: 'lwt_revoked_00000000000000000000' }),
        )
      ).code,
    ).toBe(4);
  });

  it('shows the status, warning near expiry, and an expiry of never', async () => {
    const { out, err } = await cli(['auth', 'status']);
    expect(out).toContain('account  Ada');
    expect(out).toContain('expires  2026-11-04 (in 30 days)');
    expect(err).toBe('');
    const soon =
      (expiresAt: number | null): Route =>
      (_, url) =>
        url.pathname === '/api/tokens/current'
          ? Response.json({ ...current, accountName: null, tokenName: null, expiresAt })
          : undefined;
    const near = await cli(
      ['auth', 'status'],
      signedIn({ routes: [capabilities, soon(NOW + 3 * 86_400_000)] }),
    );
    expect(near.err).toBe('this token expires in 3 days: liveplanner auth login to renew\n');
    expect(near.out).toContain('account  u1');
    expect(near.out).toContain('token    t1');
    expect(
      (await cli(['auth', 'status'], signedIn({ routes: [capabilities, soon(null)] }))).out,
    ).toContain('expires  never');
  });

  it("logs out: revokes and forgets a stored token, forgets a revoked one, refuses the environment's", async () => {
    const io = fakeIo({
      routes: [capabilities, tokens],
      files: { [CREDENTIALS]: storedAs(TOKEN, 't1') },
    });
    expect(await cli(['auth', 'logout'], io)).toMatchObject({
      code: 0,
      out: 'signed out of https://www.liveplanner.app\n',
    });
    expect(JSON.parse(io.fileMap.get(CREDENTIALS)!.data)).toHaveProperty('profiles', {});
    expect((await cli(['auth', 'logout'])).code).toBe(2);
    const gone = fakeIo({
      routes: [capabilities, tokens],
      files: { [CREDENTIALS]: storedAs('lwt_revoked_00000000000000000000', 't1') },
    });
    expect((await cli(['auth', 'logout'], gone)).code).toBe(0);
    const failing: Route = (_, url) =>
      url.pathname === '/api/tokens/current' ? new Response('', { status: 500 }) : undefined;
    const broken = fakeIo({
      routes: [capabilities, failing],
      files: { [CREDENTIALS]: storedAs(TOKEN, 't1') },
    });
    expect((await cli(['auth', 'logout'], broken)).code).toBe(7);
    expect(JSON.parse(broken.fileMap.get(CREDENTIALS)!.data)).toHaveProperty('profiles.default');
  });
});
